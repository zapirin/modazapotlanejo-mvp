"use server";

import { PrismaClient } from '../../../generated/client';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

// Helper para validar vendedor
async function getSellerId() {
    const cookieStore = await cookies();
    const sellerId = cookieStore.get('sellerId')?.value;
    if (!sellerId) throw new Error('No estás autenticado como vendedor.');
    return sellerId;
}

export async function bulkUpdateVisibility(productIds: string[], isOnline: boolean) {
    try {
        const sellerId = await getSellerId();
        await prisma.product.updateMany({
            where: {
                id: { in: productIds },
                sellerId: sellerId // Seguridad extra para no afectar catálogos ajenos
            },
            data: { isOnline }
        });
        
        revalidatePath('/products');
        revalidatePath('/(marketplace)'); // Invalidar tienda pública
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function bulkUpdatePrices(
    productIds: string[],
    actionType: 'increase_percent' | 'decrease_percent' | 'fixed_price' | 'clear_promo',
    value?: number,
    promoStartDate?: Date,
    promoEndDate?: Date
) {
    try {
        const sellerId = await getSellerId();
        
        // Dado que Prisma `updateMany` no permite matemáticas basadas en valor anterior (como precio = precio * 1.10)
        // en PostgreSQL directo sí (ej. `UPDATE... price = price * 1.1`), requerimos ejecutar un loop individual o SQL nativo.
        // Dado que pueden ser miles de productos, usaremos transacciones o SQL Raw.
        
        if (actionType === 'clear_promo') {
            await prisma.product.updateMany({
                where: { id: { in: productIds }, sellerId },
                data: {
                    promotionalPrice: null,
                    promoStartDate: null,
                    promoEndDate: null
                }
            });
        }
        else if (actionType === 'fixed_price' && value !== undefined) {
            // Fijo base
            await prisma.product.updateMany({
                where: { id: { in: productIds }, sellerId },
                data: { price: value }
            });
        }
        else if (actionType === 'increase_percent' && value !== undefined) {
             // Incrementar porcentaje
             await prisma.$executeRawUnsafe(
                 `UPDATE "Product" SET price = ROUND(CAST(price * ${1 + (value / 100)} AS NUMERIC), 2) WHERE id IN (${productIds.map(id => `'${id}'`).join(', ')}) AND "sellerId" = '${sellerId}'`
             );
        }
        else if (actionType === 'decrease_percent' && value !== undefined) {
             // Reducir porcentaje
             await prisma.$executeRawUnsafe(
                 `UPDATE "Product" SET price = ROUND(CAST(price * ${1 - (value / 100)} AS NUMERIC), 2) WHERE id IN (${productIds.map(id => `'${id}'`).join(', ')}) AND "sellerId" = '${sellerId}'`
             );
        }
        
        revalidatePath('/products');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function bulkUpdatePromotionalPrice(
    productIds: string[],
    promoPrice: number,
    startDate: Date | null,
    endDate: Date | null
) {
    try {
        const sellerId = await getSellerId();
        await prisma.product.updateMany({
            where: { id: { in: productIds }, sellerId },
            data: { 
                promotionalPrice: promoPrice,
                promoStartDate: startDate,
                promoEndDate: endDate
            }
        });
        
        revalidatePath('/products');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function bulkUpdateClassification(
    productIds: string[],
    updates: {
        categoryId?: string | null;
        subcategoryId?: string | null;
        brandId?: string | null;
        supplierId?: string | null;
    }
) {
    try {
        const sellerId = await getSellerId();
        
        // Formamos la data a actualizar (undefined se ignora, null limpia la relación)
        const dataToUpdate: any = {};
        if (updates.categoryId !== undefined) dataToUpdate.categoryId = updates.categoryId;
        if (updates.subcategoryId !== undefined) dataToUpdate.subcategoryId = updates.subcategoryId;
        if (updates.brandId !== undefined) dataToUpdate.brandId = updates.brandId;
        if (updates.supplierId !== undefined) dataToUpdate.supplierId = updates.supplierId;

        if (Object.keys(dataToUpdate).length === 0) {
            return { success: true };
        }

        await prisma.product.updateMany({
            where: { id: { in: productIds }, sellerId },
            data: dataToUpdate
        });
        
        revalidatePath('/products');
        revalidatePath('/inventory');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
