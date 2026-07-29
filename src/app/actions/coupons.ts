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
    discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING' | 'PERCENTAGE_FREE_SHIPPING' | 'FIXED_FREE_SHIPPING';
    discountValue: number;
    minPurchase?: number;
    maxUses?: number | null;
    maxUsesPerBuyer?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    applicableProductIds?: string[];
    applicableCategoryIds?: string[];
    applicableSubcategoryIds?: string[];
}) {
    const user = await getSessionUser();
    if (!user || !['SELLER', 'ADMIN'].includes(user.role))
        return { error: 'Sin permisos' };

    const code = data.code.toUpperCase().trim();
    if (!code) return { error: 'El código es requerido' };
    if (data.discountType !== 'FREE_SHIPPING' && data.discountValue <= 0)
        return { error: 'El descuento debe ser mayor a 0' };
    if ((data.discountType === 'PERCENTAGE' || data.discountType === 'PERCENTAGE_FREE_SHIPPING') && data.discountValue > 100)
        return { error: 'El porcentaje no puede ser mayor a 100' };
    if (data.discountType === 'FREE_SHIPPING') data.discountValue = 0;

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
                applicableProductIds: data.applicableProductIds || [],
                applicableCategoryIds: data.applicableCategoryIds || [],
                applicableSubcategoryIds: data.applicableSubcategoryIds || [],
            },
        });
        revalidatePath('/coupons');
        return { success: true, coupon };
    } catch (e: any) {
        if (e.code === 'P2002') return { error: 'Ya tienes un cupón con ese código' };
        console.error("Coupon creation error:", e);
        return { error: 'Error al crear el cupón: ' + (e.message || String(e)) };
    }
}

// ── SELLER: actualizar cupón ────────────────────────────────────────────────
export async function updateCoupon(id: string, data: {
    code?: string;
    discountType?: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING' | 'PERCENTAGE_FREE_SHIPPING' | 'FIXED_FREE_SHIPPING';
    discountValue?: number;
    minPurchase?: number;
    maxUses?: number | null;
    maxUsesPerBuyer?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    isActive?: boolean;
    applicableProductIds?: string[];
    applicableCategoryIds?: string[];
    applicableSubcategoryIds?: string[];
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
                ...(data.applicableProductIds !== undefined && { applicableProductIds: data.applicableProductIds }),
                ...(data.applicableCategoryIds !== undefined && { applicableCategoryIds: data.applicableCategoryIds }),
                ...(data.applicableSubcategoryIds !== undefined && { applicableSubcategoryIds: data.applicableSubcategoryIds }),
            },
        });
        revalidatePath('/coupons');
        return { success: true, coupon: updated };
    } catch (e: any) {
        if (e.code === 'P2002') return { error: 'Ya tienes un cupón con ese código' };
        console.error("Coupon update error:", e);
        return { error: 'Error al actualizar el cupón: ' + (e.message || String(e)) };
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
export async function validateCoupon(code: string, sellerId: string, items: any[], effectiveTotal?: number) {
    if (!code || !sellerId || !items || items.length === 0) return { error: 'Datos incompletos' };

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

    // Filtrar items elegibles basados en products/categories
    const hasProductFilters = coupon.applicableProductIds && coupon.applicableProductIds.length > 0;
    const hasCategoryFilters = coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0;
    const hasSubcategoryFilters = coupon.applicableSubcategoryIds && coupon.applicableSubcategoryIds.length > 0;

    let eligibleSubtotal = 0;

    if (!hasProductFilters && !hasCategoryFilters && !hasSubcategoryFilters) {
        // Aplica a todos los items del vendedor — usar el total efectivo (post descuentos de volumen) si se proporcionó
        eligibleSubtotal = effectiveTotal ?? items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    } else {
        // Necesitamos consultar las categorías de los productos en el carrito para evaluarlos
        const productIds = items.map(i => i.productId);
        const productsInCart = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, categoryId: true, subcategoryId: true }
        });

        const productMap = new Map(productsInCart.map(p => [p.id, p]));

        items.forEach(item => {
            const prod = productMap.get(item.productId);
            if (!prod) return;

            const isProductAllowed = hasProductFilters ? coupon.applicableProductIds.includes(prod.id) : false;
            const isCategoryAllowed = hasCategoryFilters && prod.categoryId ? coupon.applicableCategoryIds.includes(prod.categoryId) : false;
            const isSubcategoryAllowed = hasSubcategoryFilters && prod.subcategoryId ? coupon.applicableSubcategoryIds.includes(prod.subcategoryId) : false;

            let applies = false;
            
            if (hasProductFilters) {
                if (isProductAllowed) applies = true;
            } else if (hasSubcategoryFilters) {
                // Si seleccionaron subcategorías específicas, solo esas subcategorías aplican (ignora la categoría general)
                if (isSubcategoryAllowed) applies = true;
            } else if (hasCategoryFilters) {
                // Si seleccionaron una categoría pero ninguna subcategoría, aplica a toda la categoría
                if (isCategoryAllowed) applies = true;
            }

            if (applies) {
                eligibleSubtotal += (item.price * item.quantity);
            }
        });
    }

    if (eligibleSubtotal === 0) {
        return { error: 'Este cupón no aplica para los productos en tu carrito' };
    }

    if (eligibleSubtotal < coupon.minPurchase)
        return { error: `Compra mínima de $${coupon.minPurchase.toFixed(2)} requerida en productos aplicables` };

    const isFreeShipping = ['FREE_SHIPPING', 'PERCENTAGE_FREE_SHIPPING', 'FIXED_FREE_SHIPPING'].includes(coupon.discountType);

    if (coupon.discountType === 'FREE_SHIPPING') {
        return {
            success: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                discountType: 'FREE_SHIPPING' as const,
                discountValue: 0,
                discountAmount: 0,
                freeShipping: true,
            },
        };
    }

    const isPercentage = coupon.discountType === 'PERCENTAGE' || coupon.discountType === 'PERCENTAGE_FREE_SHIPPING';
    const discountAmount = isPercentage
            ? Math.round(Math.min(eligibleSubtotal * (coupon.discountValue / 100), eligibleSubtotal) * 100) / 100
            : Math.round(Math.min(coupon.discountValue, eligibleSubtotal) * 100) / 100;

    return {
        success: true,
        coupon: {
            id: coupon.id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount,
            freeShipping: isFreeShipping,
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
