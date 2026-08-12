"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

// Prefijo para distinguir errores de negocio (mensaje seguro para el usuario)
// de errores internos/de Prisma que no deben mostrarse tal cual.
const ERROR_USUARIO = 'ERR_USR: ';

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

function serializeEntry(entry: any) {
    return {
        id: entry.id,
        folio: folioText(entry.folio),
        createdAt: entry.createdAt,
        productId: entry.productId,
        productName: entry.productName,
        supplierName: entry.supplierName,
        locationName: entry.location?.name || '—',
        userName: entry.user?.name || null,
        totalItems: entry.totalItems,
        notes: entry.notes,
        status: entry.status,
        cancelledAt: entry.cancelledAt,
        cancelledByName: entry.cancelledByName,
        items: (entry.items || []).map((it: any) => ({
            id: it.id,
            variantInfo: it.variantInfo,
            quantity: it.quantity,
        })),
    };
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

export async function getEntrySuppliers() {
    const access: any = await resolveEntryAccess();
    if (access.error) return [];
    return await (prisma as any).supplier.findMany({
        where: { sellerId: access.sellerId, isActive: true },
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

    const location = await prisma.storeLocation.findFirst({
        where: { id: locationId, sellerId: access.sellerId },
        select: { id: true },
    });
    if (!location) return null;
    if (access.allowedLocationIds && !access.allowedLocationIds.includes(locationId)) return null;

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
        if (items.some(i => i.quantity > 100000)) {
            return { success: false, error: 'Alguna cantidad es demasiado grande. Revisa lo que capturaste.' };
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

export async function getProductStockEntries(productId: string) {
    try {
        const access: any = await resolveEntryAccess();
        if (access.error) return { success: false, error: access.error, entries: [] };

        const where: any = { sellerId: access.sellerId, productId };
        if (access.allowedLocationIds) where.locationId = { in: access.allowedLocationIds };

        const entries = await (prisma as any).stockEntry.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                items: { select: { id: true, variantInfo: true, quantity: true } },
                location: { select: { name: true } },
                user: { select: { name: true } },
            },
        });

        return { success: true, entries: entries.map(serializeEntry) };
    } catch (error: any) {
        console.error('Error al cargar el historial de entradas:', error);
        return { success: false, error: 'No se pudo cargar el historial.', entries: [] };
    }
}

export async function getStockEntries(params: {
    from?: string;
    to?: string;
    locationId?: string;
    supplierId?: string;
    page?: number;
}) {
    try {
        const access: any = await resolveEntryAccess();
        if (access.error) {
            return { success: false, error: access.error, rows: [], total: 0, page: 1, totalPages: 1 };
        }

        const pageSize = 25;
        const page = Math.max(1, params.page || 1);

        const where: any = { sellerId: access.sellerId };
        if (access.allowedLocationIds) where.locationId = { in: access.allowedLocationIds };
        if (params.supplierId) where.supplierId = params.supplierId;
        if (params.from || params.to) {
            where.createdAt = {};
            if (params.from) {
                const [y, m, d] = params.from.split('-').map(Number);
                where.createdAt.gte = new Date(y, m - 1, d, 0, 0, 0, 0);
            }
            if (params.to) {
                const [y, m, d] = params.to.split('-').map(Number);
                where.createdAt.lte = new Date(y, m - 1, d, 23, 59, 59, 999);
            }
        }

        if (params.locationId && access.allowedLocationIds && !access.allowedLocationIds.includes(params.locationId)) {
            return { success: true, rows: [], total: 0, page, totalPages: 1 };
        }
        if (params.locationId) where.locationId = params.locationId;

        const [total, entries] = await Promise.all([
            (prisma as any).stockEntry.count({ where }),
            (prisma as any).stockEntry.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    items: { select: { id: true, variantInfo: true, quantity: true } },
                    location: { select: { name: true } },
                    user: { select: { name: true } },
                },
            }),
        ]);

        return {
            success: true,
            rows: entries.map(serializeEntry),
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
    } catch (error: any) {
        console.error('Error al cargar las entradas:', error);
        return { success: false, error: 'No se pudieron cargar las entradas.', rows: [], total: 0, page: 1, totalPages: 1 };
    }
}

export async function cancelStockEntry(entryId: string) {
    try {
        const user: any = await getSessionUser();
        if (!user || user.role !== 'SELLER') {
            return { success: false, error: 'Solo el dueño de la tienda puede cancelar una entrada.' };
        }

        await prisma.$transaction(async (tx) => {
            // Toma el candado de la fila: solo una transacción concurrente gana.
            const claimed = await (tx as any).stockEntry.updateMany({
                where: { id: entryId, sellerId: user.id, status: 'ACTIVE' },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancelledByName: user.name || null,
                },
            });
            if (claimed.count !== 1) throw new Error(ERROR_USUARIO + 'Esta entrada ya está cancelada.');

            const entry: any = await (tx as any).stockEntry.findFirst({
                where: { id: entryId, sellerId: user.id },
                include: { items: true },
            });
            if (!entry) throw new Error(ERROR_USUARIO + 'Entrada no encontrada.');

            // Primero se revisa TODO: si una sola variante no alcanza, no se toca nada.
            for (const item of entry.items) {
                const level = await tx.inventoryLevel.findUnique({
                    where: {
                        variantId_locationId: {
                            variantId: item.variantId,
                            locationId: entry.locationId,
                        },
                    },
                });
                if (!level || level.stock < item.quantity) {
                    throw new Error(ERROR_USUARIO + 'No se puede cancelar: ya se vendieron piezas de esta entrada. Corrige con Ajustar Stock.');
                }
            }

            for (const item of entry.items) {
                await tx.inventoryLevel.update({
                    where: {
                        variantId_locationId: {
                            variantId: item.variantId,
                            locationId: entry.locationId,
                        },
                    },
                    data: { stock: { decrement: item.quantity } },
                });

                await tx.variant.update({
                    where: { id: item.variantId },
                    data: { stock: { decrement: item.quantity } },
                });

                await tx.inventoryMovement.create({
                    data: {
                        variantId: item.variantId,
                        locationId: entry.locationId,
                        type: 'ADJUSTMENT',
                        quantity: -item.quantity,
                        reason: `Cancelación de entrada ${folioText(entry.folio)}. Usuario: ${user.name || 'Sistema'}`,
                    },
                });
            }
        });

        revalidatePath('/inventory');
        revalidatePath('/inventory/entries');
        revalidatePath('/pos');
        return { success: true };
    } catch (error: any) {
        console.error('Error al cancelar la entrada:', error);
        const msg = String(error?.message || '');
        return { success: false, error: msg.startsWith(ERROR_USUARIO) ? msg.slice(ERROR_USUARIO.length) : 'No se pudo cancelar la entrada.' };
    }
}
