'use server';

import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';

// ── SELLER: listar sus cupones ──────────────────────────────────────────────
export async function getSellerCoupons() {
    const user = await getSessionUser();
    if (!user || !['SELLER', 'ADMIN'].includes(user.role)) return [];
    return prisma.discountCoupon.findMany({
        where: { sellerId: user.id },
        orderBy: { createdAt: 'desc' },
    });
}

// ── SELLER: crear cupón ─────────────────────────────────────────────────────
export async function createCoupon(data: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    minPurchase?: number;
    maxUses?: number | null;
    maxUsesPerBuyer?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
}) {
    const user = await getSessionUser();
    if (!user || !['SELLER', 'ADMIN'].includes(user.role))
        return { error: 'Sin permisos' };

    const code = data.code.toUpperCase().trim();
    if (!code) return { error: 'El código es requerido' };
    if (data.discountValue <= 0) return { error: 'El descuento debe ser mayor a 0' };
    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100)
        return { error: 'El porcentaje no puede ser mayor a 100' };

    try {
        const coupon = await prisma.discountCoupon.create({
            data: {
                code,
                sellerId: user.id,
                discountType: data.discountType,
                discountValue: data.discountValue,
                minPurchase: data.minPurchase ?? 0,
                maxUses: data.maxUses ?? null,
                maxUsesPerBuyer: data.maxUsesPerBuyer ?? null,
                startsAt: data.startsAt ? new Date(data.startsAt) : null,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
                isActive: true,
            },
        });
        revalidatePath('/coupons');
        return { success: true, coupon };
    } catch (e: any) {
        if (e.code === 'P2002') return { error: 'Ya tienes un cupón con ese código' };
        return { error: 'Error al crear el cupón' };
    }
}

// ── SELLER: actualizar cupón ────────────────────────────────────────────────
export async function updateCoupon(id: string, data: {
    code?: string;
    discountType?: 'PERCENTAGE' | 'FIXED';
    discountValue?: number;
    minPurchase?: number;
    maxUses?: number | null;
    maxUsesPerBuyer?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    isActive?: boolean;
}) {
    const user = await getSessionUser();
    if (!user || !['SELLER', 'ADMIN'].includes(user.role))
        return { error: 'Sin permisos' };

    const coupon = await prisma.discountCoupon.findFirst({ where: { id, sellerId: user.id } });
    if (!coupon) return { error: 'Cupón no encontrado' };

    try {
        const updated = await prisma.discountCoupon.update({
            where: { id },
            data: {
                ...(data.code && { code: data.code.toUpperCase().trim() }),
                ...(data.discountType && { discountType: data.discountType }),
                ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
                ...(data.minPurchase !== undefined && { minPurchase: data.minPurchase }),
                ...(data.maxUses !== undefined && { maxUses: data.maxUses }),
                ...(data.maxUsesPerBuyer !== undefined && { maxUsesPerBuyer: data.maxUsesPerBuyer }),
                ...(data.startsAt !== undefined && { startsAt: data.startsAt ? new Date(data.startsAt) : null }),
                ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
        });
        revalidatePath('/coupons');
        return { success: true, coupon: updated };
    } catch (e: any) {
        if (e.code === 'P2002') return { error: 'Ya tienes un cupón con ese código' };
        return { error: 'Error al actualizar el cupón' };
    }
}

// ── SELLER: eliminar cupón ──────────────────────────────────────────────────
export async function deleteCoupon(id: string) {
    const user = await getSessionUser();
    if (!user || !['SELLER', 'ADMIN'].includes(user.role))
        return { error: 'Sin permisos' };

    const coupon = await prisma.discountCoupon.findFirst({ where: { id, sellerId: user.id } });
    if (!coupon) return { error: 'Cupón no encontrado' };

    await prisma.discountCoupon.delete({ where: { id } });
    revalidatePath('/coupons');
    return { success: true };
}

// ── BUYER: validar cupón en carrito ─────────────────────────────────────────
export async function validateCoupon(code: string, sellerId: string, subtotal: number) {
    if (!code || !sellerId) return { error: 'Datos incompletos' };

    const now = new Date();
    const coupon = await prisma.discountCoupon.findFirst({
        where: {
            code: code.toUpperCase().trim(),
            sellerId,
            isActive: true,
        },
    });

    if (!coupon) return { error: 'Cupón no válido' };
    if (!coupon.isActive) return { error: 'Cupón inactivo' };
    if (coupon.startsAt && coupon.startsAt > now) return { error: 'Cupón aún no es válido' };
    if (coupon.expiresAt && coupon.expiresAt < now) return { error: 'Cupón expirado' };
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses)
        return { error: 'Cupón agotado' };
    if (subtotal < coupon.minPurchase)
        return { error: `Compra mínima de $${coupon.minPurchase.toFixed(2)} requerida` };

    // Verificar límite por comprador (si el usuario está autenticado)
    if (coupon.maxUsesPerBuyer !== null) {
        const { getSessionUser } = await import('@/app/actions/auth');
        const buyer = await getSessionUser();
        if (buyer) {
            const buyerUsages = await prisma.couponUsage.count({
                where: { couponId: coupon.id, buyerId: buyer.id },
            });
            if (buyerUsages >= coupon.maxUsesPerBuyer!) {
                return { error: `Ya usaste este cupón ${coupon.maxUsesPerBuyer === 1 ? 'una vez' : `${coupon.maxUsesPerBuyer} veces`}` };
            }
        }
    }

    const discountAmount =
        coupon.discountType === 'PERCENTAGE'
            ? Math.min(subtotal * (coupon.discountValue / 100), subtotal)
            : Math.min(coupon.discountValue, subtotal);

    return {
        success: true,
        coupon: {
            id: coupon.id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount,
        },
    };
}

// ── SISTEMA: incrementar uso al confirmar orden ─────────────────────────────
export async function incrementCouponUsage(couponId: string) {
    try {
        // Incrementar contador global
        await prisma.discountCoupon.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } },
        });
        // Registrar uso por comprador (si hay sesión)
        const { getSessionUser } = await import('@/app/actions/auth');
        const buyer = await getSessionUser();
        if (buyer) {
            await prisma.couponUsage.create({
                data: { couponId, buyerId: buyer.id },
            });
        }
    } catch { /* silencioso */ }
}
