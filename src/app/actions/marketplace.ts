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
                sellerSlug: true, createdAt: true, updatedAt: true, registeredDomain: true,
                _count: { select: { ownedProducts: true, cashiers: true, ownedLocations: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error: any) {
        return [];
    }
}

export async function getSellerMetrics() {
    try {
        await checkAdmin();
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Get monthly sales grouped by seller (POS sales)
        const posSales = await prisma.sale.groupBy({
            by: ['sellerId'],
            where: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
            _sum: { total: true },
            _count: true
        });

        // Get monthly orders grouped by seller (marketplace)
        const orders = await prisma.order.groupBy({
            by: ['sellerId'],
            where: { createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
            _sum: { total: true },
            _count: true
        });

        const metrics: Record<string, { salesTotal: number; salesCount: number; ordersTotal: number; ordersCount: number }> = {};
        for (const s of posSales) {
            if (!s.sellerId) continue;
            metrics[s.sellerId] = { salesTotal: s._sum.total || 0, salesCount: s._count, ordersTotal: 0, ordersCount: 0 };
        }
        for (const o of orders) {
            if (!metrics[o.sellerId]) metrics[o.sellerId] = { salesTotal: 0, salesCount: 0, ordersTotal: 0, ordersCount: 0 };
            metrics[o.sellerId].ordersTotal = o._sum.total || 0;
            metrics[o.sellerId].ordersCount = o._count;
        }
        return metrics;
    } catch { return {}; }
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
    showPricesPublicly?: boolean;
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


export async function getPlans(includeHidden = false) {
    try {
        const settings = await prisma.marketplaceSettings.findFirst();
        if (settings && (settings as any).plans) {
            const all = (settings as any).plans as typeof DEFAULT_PLANS;
            return includeHidden ? all : (all as any[]).filter((p: any) => !p.hidden);
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
        revalidatePath('/register/seller');
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function toggleBrandActive(domain: string, isActive: boolean) {
    try {
        await checkAdmin();
        await (prisma.brandConfig as any).update({
            where: { domain },
            data: { isActive }
        });
        revalidatePath('/', 'layout');
        revalidatePath('/catalog');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteBrandConfig(domain: string) {
    try {
        await checkAdmin();
        await prisma.brandConfig.delete({ where: { domain } });
        revalidatePath('/', 'layout');
        revalidatePath('/catalog');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateBrandConfig(domain: string, data: {
    name?: string;
    tagline?: string;
    description?: string;
    logoUrl?: string;
    heroImage?: string;
    heroImages?: string[];
    primaryColor?: string;
    isSingleVendor?: boolean;
    sellerId?: string;
    showPricesPublicly?: boolean;
    announcementEnabled?: boolean;
    announcementText?: string | null;
    announcementMode?: string;
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

export async function getBrandMetrics() {
    try {
        await checkAdmin();
        const brands = await prisma.brandConfig.findMany({ select: { domain: true } });
        const metrics: Record<string, { sellers: number; products: number }> = {};

        for (const b of brands) {
            const sellers = await prisma.user.count({
                where: { registeredDomain: b.domain, role: 'SELLER', isActive: true }
            });
            const sellerIds = await prisma.user.findMany({
                where: { registeredDomain: b.domain, role: 'SELLER', isActive: true },
                select: { id: true }
            });
            const products = sellerIds.length > 0
                ? await prisma.product.count({
                    where: { sellerId: { in: sellerIds.map(s => s.id) }, isActive: true, isOnline: true }
                })
                : 0;
            metrics[b.domain] = { sellers, products };
        }
        return metrics;
    } catch { return {}; }
}

// ─── Suscripciones ─────────────────────────────────────────────────────────
function computeSubscriptionStatus(start: Date | null, lastPaid: Date | null): { nextPaymentAt: Date | null; status: 'unset' | 'ok' | 'soon' | 'overdue'; daysToNext: number | null } {
    const anchor = lastPaid ?? start;
    if (!anchor) return { nextPaymentAt: null, status: 'unset', daysToNext: null };
    const next = new Date(anchor);
    next.setMonth(next.getMonth() + 1);
    const now = new Date();
    const diffMs = next.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    let status: 'ok' | 'soon' | 'overdue';
    if (days < 0) status = 'overdue';
    else if (days <= 7) status = 'soon';
    else status = 'ok';
    return { nextPaymentAt: next, status, daysToNext: days };
}

export async function getSubscriptions() {
    try {
        await checkAdmin();
        const sellers = await (prisma.user as any).findMany({
            where: { role: 'SELLER', isActive: true },
            select: {
                id: true,
                name: true,
                businessName: true,
                email: true,
                planName: true,
                createdAt: true,
                subscriptionStartedAt: true,
                lastPaidAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const rows = sellers.map((s: any) => {
            const calc = computeSubscriptionStatus(s.subscriptionStartedAt, s.lastPaidAt);
            return { ...s, ...calc };
        });

        const counters = {
            overdue: rows.filter((r: any) => r.status === 'overdue').length,
            soon: rows.filter((r: any) => r.status === 'soon').length,
            unset: rows.filter((r: any) => r.status === 'unset').length,
        };

        return { success: true, rows, counters };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function markSellerPaid(sellerId: string) {
    try {
        await checkAdmin();
        const now = new Date();
        const seller = await (prisma.user as any).findUnique({ where: { id: sellerId }, select: { subscriptionStartedAt: true } });
        await (prisma.user as any).update({
            where: { id: sellerId },
            data: {
                lastPaidAt: now,
                subscriptionStartedAt: seller?.subscriptionStartedAt ?? now,
            },
        });
        revalidatePath('/admin/marketplace');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function setSubscriptionStartDate(sellerId: string, isoDate: string) {
    try {
        await checkAdmin();
        const start = new Date(isoDate);
        if (isNaN(start.getTime())) throw new Error('Fecha inválida');
        await (prisma.user as any).update({
            where: { id: sellerId },
            data: { subscriptionStartedAt: start },
        });
        revalidatePath('/admin/marketplace');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
