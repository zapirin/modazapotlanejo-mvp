"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

// Quién puede tocar entradas y sobre qué sucursales.
// SELLER: todas las suyas (allowedLocationIds = null significa "sin restricción").
// CASHIER: solo si tiene el permiso, y solo sus sucursales asignadas.
async function resolveEntryAccess(): Promise<any> {
    const user: any = await getSessionUser();
    if (!user) return { error: 'No autorizado.' };
    if (user.role === 'SELLER') {
        return { user, sellerId: user.id, allowedLocationIds: null };
    }
    if (user.role === 'CASHIER' && user.canRegisterStockEntry) {
        if (!user.managedBySellerId) return { error: 'No autorizado.' };
        return {
            user,
            sellerId: user.managedBySellerId,
            allowedLocationIds: user.allowedLocationIds || [],
        };
    }
    return { error: 'No autorizado.' };
}

// Mismo criterio de nombre de variante que usa la pantalla de inventario.
function formatVariantLabel(variant: any): string {
    if (variant?.attributes && typeof variant.attributes === 'object') {
        const parts = Object.values(variant.attributes as Record<string, any>);
        if (parts.length > 0) return parts.join(' / ');
    }
    if (variant?.color && variant?.size) return `${variant.color} / ${variant.size}`;
    if (variant?.color) return variant.color;
    if (variant?.size) return variant.size;
    return 'Única';
}

function folioText(folio: number): string {
    return `E-${String(folio).padStart(6, '0')}`;
}

export async function getEntryLocations() {
    const access: any = await resolveEntryAccess();
    if (access.error) return [];
    const where: any = { sellerId: access.sellerId };
    if (access.allowedLocationIds) where.id = { in: access.allowedLocationIds };
    return await prisma.storeLocation.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
}

export async function searchProductsForEntry(query: string) {
    const access: any = await resolveEntryAccess();
    if (access.error) return [];
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const products = await prisma.product.findMany({
        where: {
            sellerId: access.sellerId,
            isActive: true,
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
            ],
        },
        select: {
            id: true,
            name: true,
            sku: true,
            images: true,
            supplier: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
        take: 20,
    });

    return products.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: p.images?.[0] || null,
        supplierName: p.supplier?.name || null,
    }));
}

export async function getProductForEntry(productId: string, locationId: string) {
    const access: any = await resolveEntryAccess();
    if (access.error) return null;

    const product: any = await prisma.product.findFirst({
        where: { id: productId, sellerId: access.sellerId },
        select: {
            id: true,
            name: true,
            supplier: { select: { name: true } },
            variants: {
                select: {
                    id: true,
                    color: true,
                    size: true,
                    attributes: true,
                    inventoryLevels: {
                        where: { locationId },
                        select: { stock: true },
                    },
                },
                orderBy: [{ color: 'asc' }, { size: 'asc' }],
            },
        },
    });
    if (!product) return null;

    return {
        id: product.id,
        name: product.name,
        supplierName: product.supplier?.name || null,
        variants: product.variants.map((v: any) => ({
            id: v.id,
            label: formatVariantLabel(v),
            currentStock: v.inventoryLevels?.[0]?.stock ?? 0,
        })),
    };
}

export async function createStockEntry(input: {
    productId: string;
    locationId: string;
    notes?: string;
    items: { variantId: string; quantity: number }[];
}) {
    try {
        const access: any = await resolveEntryAccess();
        if (access.error) return { success: false, error: access.error };

        const items = (input.items || [])
            .map(i => ({ variantId: i.variantId, quantity: Number(i.quantity) }))
            .filter(i => i.quantity > 0);

        if (items.length === 0) {
            return { success: false, error: 'Captura al menos una cantidad mayor que cero.' };
        }
        if (items.some(i => !Number.isInteger(i.quantity))) {
            return { success: false, error: 'Las cantidades deben ser números enteros.' };
        }

        const location = await prisma.storeLocation.findFirst({
            where: { id: input.locationId, sellerId: access.sellerId },
            select: { id: true },
        });
        if (!location) return { success: false, error: 'Sucursal no válida.' };
        if (access.allowedLocationIds && !access.allowedLocationIds.includes(input.locationId)) {
            return { success: false, error: 'No tienes acceso a esa sucursal.' };
        }

        const product: any = await prisma.product.findFirst({
            where: { id: input.productId, sellerId: access.sellerId },
            select: {
                id: true,
                name: true,
                supplierId: true,
                supplier: { select: { name: true } },
                variants: { select: { id: true, color: true, size: true, attributes: true } },
            },
        });
        if (!product) return { success: false, error: 'Producto no válido.' };

        const variantMap = new Map<string, any>(product.variants.map((v: any) => [v.id, v]));
        if (items.some(i => !variantMap.has(i.variantId))) {
            return { success: false, error: 'Alguna variante no pertenece a este producto.' };
        }

        const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

        const nextFolio = await prisma.$transaction(async (tx) => {
            const last = await (tx as any).stockEntry.findFirst({
                where: { sellerId: access.sellerId },
                orderBy: { folio: 'desc' },
                select: { folio: true },
            });
            const folio = (last?.folio ?? 0) + 1;

            await (tx as any).stockEntry.create({
                data: {
                    sellerId: access.sellerId,
                    productId: product.id,
                    productName: product.name,
                    supplierId: product.supplierId,
                    supplierName: product.supplier?.name || null,
                    locationId: input.locationId,
                    userId: access.user.id,
                    folio,
                    totalItems,
                    notes: input.notes?.trim() || null,
                    items: {
                        create: items.map(i => ({
                            variantId: i.variantId,
                            quantity: i.quantity,
                            variantInfo: formatVariantLabel(variantMap.get(i.variantId)),
                        })),
                    },
                },
            });

            for (const item of items) {
                await tx.inventoryLevel.upsert({
                    where: {
                        variantId_locationId: {
                            variantId: item.variantId,
                            locationId: input.locationId,
                        },
                    },
                    create: {
                        variantId: item.variantId,
                        locationId: input.locationId,
                        stock: item.quantity,
                    },
                    update: { stock: { increment: item.quantity } },
                });

                await tx.variant.update({
                    where: { id: item.variantId },
                    data: { stock: { increment: item.quantity } },
                });

                await tx.inventoryMovement.create({
                    data: {
                        variantId: item.variantId,
                        locationId: input.locationId,
                        type: 'RESTOCK',
                        quantity: item.quantity,
                        reason: `Entrada ${folioText(folio)}. Usuario: ${access.user.name || 'Sistema'}`,
                    },
                });
            }

            return folio;
        });

        revalidatePath('/inventory');
        revalidatePath('/inventory/entries');
        revalidatePath('/pos');
        return { success: true, folio: nextFolio };
    } catch (error: any) {
        console.error('Error al registrar la entrada:', error);
        return { success: false, error: 'No se pudo registrar la entrada.' };
    }
}
