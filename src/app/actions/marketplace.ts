"use server";
import { DEFAULT_PLANS } from '@/lib/plans';

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

async function checkAdmin() {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
        throw new Error("No autorizado");
    }
    return user;
}

export async function getMarketplaceSettings() {
    try {
        let settings = await prisma.marketplaceSettings.findFirst();
        if (!settings) {
            settings = await prisma.marketplaceSettings.create({
                data: {
                    title: "Moda Zapotlanejo"
                }
            });
        }
        const brands = await prisma.brandConfig.findMany({
            where: { isActive: true },
            orderBy: { domain: 'asc' }
        });
        return { success: true, data: { ...settings, brandsConfig: brands } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateMarketplaceSettings(data: {
    title?: string;
    heroImage?: string;
    featuredSellerIds?: string[];
    featuredProductIds?: string[];
}) {
    try {
        await checkAdmin();
        
        const settings = await prisma.marketplaceSettings.findFirst();
        
        let result;
        if (settings) {
            result = await prisma.marketplaceSettings.update({
                where: { id: settings.id },
                data
            });
        } else {
            result = await prisma.marketplaceSettings.create({
                data: {
                    title: data.title || "Moda Zapotlanejo",
                    ...data
                }
            });
        }
        
        revalidatePath('/');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSellersList() {
    try {
        const sellers = await prisma.user.findMany({
            where: { role: 'SELLER', isActive: true },
            select: { id: true, name: true, email: true }
        });
        return { success: true, data: sellers };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getProductsSearch(query: string) {
    try {
        const products = await prisma.product.findMany({
            where: {
                isActive: true,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { sku: { contains: query, mode: 'insensitive' } }
                ]
            },
            select: { id: true, name: true, sku: true },
            take: 10
        });
        return { success: true, data: products };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// GESTIÓN DE VENDEDORES — ADMIN
// ---------------------------------------------------------------------------

export async function deleteSellerPermanently(sellerId: string) {
    try {
        await checkAdmin();
        // Desactivar vendedor y ocultar todos sus productos del marketplace
        await prisma.$transaction([
            prisma.user.update({
                where: { id: sellerId },
                data: { isActive: false, role: 'BUYER' as any }
            }),
            prisma.product.updateMany({
                where: { sellerId },
                data: { isOnline: false }
            }),
        ]);
        revalidatePath('/admin/costs');
        revalidatePath('/');
        revalidatePath('/catalog');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getInactiveSellers() {
    try {
        await checkAdmin();
        return await (prisma.user as any).findMany({
            where: { isActive: false, role: 'SELLER' },
            select: {
                id: true, name: true, email: true, businessName: true,
                isActive: true, planName: true, createdAt: true,
                _count: { select: { ownedProducts: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch { return []; }
}

export async function deleteSellerForever(sellerId: string) {
    try {
        await checkAdmin();
        // Eliminar productos primero (cascade no siempre alcanza todo)
        const products = await prisma.product.findMany({
            where: { sellerId },
            select: { id: true }
        });
        for (const p of products) {
            // Borrar variantes e ítems relacionados antes del producto
            await prisma.variant.deleteMany({ where: { productId: p.id } });
            await prisma.product.delete({ where: { id: p.id } });
        }
        // Eliminar el vendedor
        await prisma.user.delete({ where: { id: sellerId } });
        revalidatePath('/');
        revalidatePath('/catalog');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function reactivateSeller(sellerId: string) {
    try {
        await checkAdmin();
        // Reactivar vendedor y volver a publicar sus productos
        await prisma.$transaction([
            (prisma.user as any).update({
                where: { id: sellerId },
                data: { isActive: true }
            }),
            prisma.product.updateMany({
                where: { sellerId },
                data: { isOnline: true }
            }),
        ]);
        revalidatePath('/admin/marketplace');
        revalidatePath('/');
        revalidatePath('/catalog');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSellerPermissions(sellerId: string, data: {
    posEnabled?: boolean;
    maxProducts?: number | null;
    posRequested?: boolean;
    planName?: string;
    maxLocations?: number;
    maxCashiers?: number;
    commission?: number;
    fixedFee?: number;
}) {
    try {
        await checkAdmin();
        await (prisma.user as any).update({
            where: { id: sellerId },
            data
        });
        revalidatePath('/admin/costs');
        revalidatePath('/admin/marketplace');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSellersWithPermissions() {
    try {
        await checkAdmin();
        return await (prisma.user as any).findMany({
            where: { role: 'SELLER' },
            select: {
                id: true, name: true, email: true, businessName: true, phone: true, whatsapp: true,
                isActive: true, adminNotes: true, commission: true, fixedFee: true,
                posEnabled: true, maxProducts: true, posRequested: true, logoUrl: true,
                planName: true, maxLocations: true, maxCashiers: true,
                sellerSlug: true, createdAt: true,
                _count: { select: { ownedProducts: true, cashiers: true, ownedLocations: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error: any) {
        return [];
    }
}

export async function getPhotographyRequests() {
    try {
        await checkAdmin();
        return await prisma.photographyRequest.findMany({
            include: { user: { select: { name: true, email: true, businessName: true } } },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error: any) {
        return [];
    }
}

export async function updatePhotographyRequest(id: string, status: string) {
    try {
        await checkAdmin();
        await prisma.photographyRequest.update({
            where: { id },
            data: { status }
        });
        revalidatePath('/admin/marketplace');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateAdminEmail(newEmail: string) {
    try {
        const user = await checkAdmin();
        const existing = await prisma.user.findFirst({ where: { email: newEmail } });
        if (existing && existing.id !== user.id) {
            return { success: false, error: 'Ese correo ya está en uso' };
        }
        await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateMarketplaceSettingsFull(data: {
    title?: string;
    heroImage?: string;
    heroImages?: string[];
    logoUrl?: string;
    adminEmail?: string;
    sellerLabel?: string;
    featuredSellerIds?: string[];
    featuredProductIds?: string[];
    privacyUrl?: string;
    termsUrl?: string;
    photographyPrices?: any;
    photographyEnabled?: boolean;
    brandColors?: Record<string, string>;
}) {
    try {
        await checkAdmin();
        const settings = await prisma.marketplaceSettings.findFirst();
        let result;
        if (settings) {
            result = await (prisma.marketplaceSettings as any).update({
                where: { id: settings.id },
                data
            });
        } else {
            result = await (prisma.marketplaceSettings as any).create({ data });
        }
        revalidatePath('/', 'layout');
        revalidatePath('/catalog');
        revalidatePath('/admin/marketplace');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// SLUG DEL VENDEDOR
// ---------------------------------------------------------------------------

function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
}

export async function assignSellerSlug(sellerId: string) {
    try {
        await checkAdmin();
        const seller = await prisma.user.findUnique({
            where: { id: sellerId },
            select: { businessName: true, name: true, sellerSlug: true }
        });
        if (!seller) return { success: false, error: 'Vendedor no encontrado' };
        if ((seller as any).sellerSlug) return { success: true, slug: (seller as any).sellerSlug };

        const base = generateSlug((seller as any).businessName || seller.name);
        let slug = base;
        let counter = 1;
        while (true) {
            const existing = await (prisma.user as any).findFirst({ where: { sellerSlug: slug } });
            if (!existing) break;
            slug = `${base}-${counter++}`;
        }
        await (prisma.user as any).update({ where: { id: sellerId }, data: { sellerSlug: slug } });
        revalidatePath('/admin/marketplace');
        return { success: true, slug };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getFeaturedContent() {
    try {
        const settings = await prisma.marketplaceSettings.findFirst();
        if (!settings) return { sellers: [], products: [] };

        const sellerIds = (settings as any).featuredSellerIds || [];
        const productIds = (settings as any).featuredProductIds || [];

        const [sellers, products] = await Promise.all([
            sellerIds.length > 0 ? prisma.user.findMany({
                where: { id: { in: sellerIds }, role: 'SELLER', isActive: true },
                select: { id: true, name: true, businessName: true, logoUrl: true, sellerSlug: true,
                    _count: { select: { ownedProducts: { where: { isOnline: true, isActive: true } } } }
                }
            }) : Promise.resolve([]),
            productIds.length > 0 ? prisma.product.findMany({
                where: { id: { in: productIds }, isOnline: true, isActive: true },
                include: { brand: true, category: true, seller: { select: { id: true, name: true, businessName: true, sellerSlug: true } } }
            }) : Promise.resolve([]),
        ]);

        return { sellers, products };
    } catch { return { sellers: [], products: [] }; }
}


export async function getPlans() {
    try {
        const settings = await prisma.marketplaceSettings.findFirst();
        if (settings && (settings as any).plans) {
            return (settings as any).plans as typeof DEFAULT_PLANS;
        }
        return DEFAULT_PLANS;
    } catch { return DEFAULT_PLANS; }
}

export async function savePlans(plans: any[]) {
    try {
        const settings = await prisma.marketplaceSettings.findFirst();
        if (settings) {
            await prisma.marketplaceSettings.update({
                where: { id: settings.id },
                data: { plans } as any
            });
        } else {
            await prisma.marketplaceSettings.create({ data: { plans } as any });
        }
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function updateBrandConfig(domain: string, data: {
    name?: string;
    tagline?: string;
    description?: string;
    logoUrl?: string;
    heroImage?: string;
    primaryColor?: string;
}) {
    try {
        await checkAdmin();
        const result = await prisma.brandConfig.upsert({
            where: { domain },
            update: data,
            create: {
                domain,
                name: data.name || domain,
                ...data
            }
        });
        revalidatePath('/', 'layout');
        revalidatePath('/catalog');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
