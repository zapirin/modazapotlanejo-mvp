"use server";

import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';

export async function toggleWishlist(productId: string) {
    const user = await getSessionUser();
    if (!user) return { error: 'Debes iniciar sesión' };

    const existing = await prisma.wishlist.findUnique({
        where: { userId_productId: { userId: user.id, productId } }
    });

    if (existing) {
        await prisma.wishlist.delete({ where: { id: existing.id } });
        return { added: false };
    } else {
        // Guardar precio actual para detectar bajadas después
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { price: true, variants: { select: { stock: true } } }
        });
        const totalStock = product?.variants.reduce((s: number, v: any) => s + (v.stock || 0), 0) ?? 0;
        await (prisma.wishlist as any).create({
            data: {
                userId: user.id,
                productId,
                lastKnownPrice: product?.price ?? null,
                lastKnownStock: totalStock,
                notifyOnRestock: true,
                notifyOnPriceDown: true,
            }
        });
        return { added: true };
    }
}

export async function getMyWishlist() {
    const user = await getSessionUser();
    if (!user) return [];

    return (prisma.wishlist as any).findMany({
        where: { userId: user.id },
        include: {
            product: {
                include: {
                    brand: true,
                    category: true,
                    seller: { select: { id: true, name: true, businessName: true } },
                    variants: { select: { stock: true } }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

export async function isInWishlist(productId: string) {
    const user = await getSessionUser();
    if (!user) return false;

    const item = await prisma.wishlist.findUnique({
        where: { userId_productId: { userId: user.id, productId } }
    });
    return !!item;
}

export async function updateWishlistNotifications(
    wishlistId: string,
    data: { notifyOnRestock?: boolean; notifyOnPriceDown?: boolean }
) {
    const user = await getSessionUser();
    if (!user) return { success: false };
    await (prisma.wishlist as any).update({
        where: { id: wishlistId },
        data
    });
    revalidatePath('/wishlist');
    return { success: true };
}
