"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { createTransfer } from "../../pos/actions";
import { revalidatePath } from "next/cache";

async function resolveSellerId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.role === 'SELLER') return user.id;
    if (user.role === 'CASHIER') {
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true }
        });
        return cashier?.managedBySellerId || null;
    }
    return null;
}

export async function getSellerLocations() {
    const user = await getSessionUser();
    const sellerId = await resolveSellerId(user);
    if (!sellerId) return [];
    return await prisma.storeLocation.findMany({
        where: { sellerId },
        select: { id: true, name: true, address: true },
        orderBy: { name: 'asc' },
    });
}

export async function getRestockSuggestions(sourceId: string, destId?: string) {
    const user = await getSessionUser();
    const sellerId = await resolveSellerId(user);
    if (!sellerId) return { destinations: [] };

    const source = await prisma.storeLocation.findFirst({
        where: { id: sourceId, sellerId },
        select: { id: true }
    });
    if (!source) return { destinations: [] };

    if (destId === sourceId) return { destinations: [] };
    const destWhere: any = { sellerId };
    if (destId) destWhere.id = destId;
    else destWhere.id = { not: sourceId };

    const destLocations = await prisma.storeLocation.findMany({
        where: destWhere,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
    if (destLocations.length === 0) return { destinations: [] };

    const variants = await prisma.variant.findMany({
        where: {
            product: { sellerId, isActive: true },
        },
        select: {
            id: true,
            color: true,
            size: true,
            targetStockPerLocation: true,
            product: { select: { id: true, name: true, images: true } } as any,
            inventoryLevels: {
                where: { locationId: { in: [sourceId, ...destLocations.map(d => d.id)] } },
                select: { locationId: true, stock: true },
            },
        },
        orderBy: [
            { product: { name: 'asc' } as any },
            { color: 'asc' },
            { size: 'asc' },
        ],
    });

    const destBuckets: Record<string, {
        locationId: string;
        locationName: string;
        items: any[];
    }> = {};
    for (const d of destLocations) {
        destBuckets[d.id] = { locationId: d.id, locationName: d.name, items: [] };
    }

    for (const v of variants) {
        const sourceLevel = v.inventoryLevels.find(l => l.locationId === sourceId);
        const sourceStock = sourceLevel?.stock || 0;
        if (sourceStock <= 0) continue;
        const target = v.targetStockPerLocation ?? 1;

        for (const d of destLocations) {
            const destLevel = v.inventoryLevels.find(l => l.locationId === d.id);
            const currentStock = destLevel?.stock || 0;
            const gap = target - currentStock;
            if (gap <= 0) continue;
            const suggestedQty = Math.min(gap, sourceStock);
            if (suggestedQty <= 0) continue;

            destBuckets[d.id].items.push({
                variantId: v.id,
                productId: (v as any).product.id,
                productName: (v as any).product.name,
                productImage: (v as any).product.images?.[0] || null,
                color: v.color,
                size: v.size,
                currentStock,
                target,
                gap,
                sourceStock,
                suggestedQty,
            });
        }
    }

    const sizeKey = (s: string | null): [number, number, string] => {
        if (!s) return [2, 0, ''];
        const n = parseFloat(s);
        if (!isNaN(n)) return [0, n, s];
        return [1, 0, s.toLowerCase()];
    };
    const compareItems = (a: any, b: any) => {
        const byProduct = a.productName.localeCompare(b.productName, 'es');
        if (byProduct !== 0) return byProduct;
        const byColor = (a.color || '').localeCompare(b.color || '', 'es');
        if (byColor !== 0) return byColor;
        const [aBucket, aNum, aStr] = sizeKey(a.size);
        const [bBucket, bNum, bStr] = sizeKey(b.size);
        if (aBucket !== bBucket) return aBucket - bBucket;
        if (aBucket === 0) return aNum - bNum;
        return aStr.localeCompare(bStr, 'es');
    };

    const destinations = Object.values(destBuckets)
        .filter(d => d.items.length > 0)
        .map(d => ({ ...d, items: d.items.sort(compareItems) }));
    return { destinations };
}

export async function executeRestock(
    sourceId: string,
    destId: string,
    items: { variantId: string; quantity: number; name?: string; color?: string | null; size?: string | null }[]
) {
    const filtered = items.filter(i => i.quantity > 0);
    if (filtered.length === 0) {
        return { success: false, error: 'No hay items con cantidad mayor a 0.' };
    }
    const cart = filtered.map(i => ({
        variantId: i.variantId,
        quantity: i.quantity,
        name: i.name || 'Producto',
        variant: { color: i.color || null, size: i.size || null },
    }));
    const res = await createTransfer(cart, sourceId, destId);
    if (res.success) {
        revalidatePath('/inventory/restock');
    }
    return res;
}

export async function updateVariantTarget(variantId: string, target: number) {
    const user = await getSessionUser();
    const sellerId = await resolveSellerId(user);
    if (!sellerId) return { success: false, error: 'No autorizado' };

    const variant = await prisma.variant.findFirst({
        where: { id: variantId, product: { sellerId } },
        select: { id: true }
    });
    if (!variant) return { success: false, error: 'Variante no encontrada' };

    await prisma.variant.update({
        where: { id: variantId },
        data: { targetStockPerLocation: Math.max(0, Math.floor(target)) }
    });
    revalidatePath('/inventory/restock');
    return { success: true };
}
