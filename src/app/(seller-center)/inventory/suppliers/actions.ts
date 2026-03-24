"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from '@/app/actions/auth';

// Helper: resolver el sellerId efectivo para cajeros
async function getEffectiveSellerId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.role === 'CASHIER') {
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true }
        });
        return cashier?.managedBySellerId || null;
    }
    return user.id;
}


export async function getSuppliers() {
    try {
        const user = await getSessionUser();
        const suppliers = await prisma.supplier.findMany({
            where: { sellerId: await getEffectiveSellerId(user), isActive: true },
            orderBy: { name: 'asc' },
            include: {
                products: {
                    where: { isActive: true },
                    include: {
                        variants: {
                            include: { inventoryLevels: true }
                        }
                    }
                },
                _count: {
                    select: { products: { where: { isActive: true } } }
                }
            }
        });

        // Map data to calculate total stock
        return suppliers.map((supplier: any) => {
            let totalStock = 0;
            supplier.products.forEach((p: any) => {
                p.variants.forEach((v: any) => {
                    v.inventoryLevels.forEach((inv: any) => {
                        totalStock += inv.stock;
                    });
                });
            });

            return {
                ...supplier,
                totalStock
            };
        });
    } catch (error) {
        console.error("Error fetching suppliers:", error);
        return [];
    }
}

export async function createSupplier(data: { name: string; notes?: string }) {
    try {
        const user = await getSessionUser();
        if (!data.name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const existing = await prisma.supplier.findFirst({
            where: { name: { equals: data.name.trim(), mode: 'insensitive' } }
        });

        if (existing) return { success: false, error: "Ya existe un proveedor con este nombre" };

        await prisma.supplier.create({
            data: {
                name: data.name.trim(),
                notes: data.notes || null,
                sellerId: await getEffectiveSellerId(user)
            }
        });

        revalidatePath("/inventory/suppliers");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSupplier(id: string, data: { name: string; notes?: string }) {
    try {
        if (!data.name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const existing = await prisma.supplier.findFirst({
            where: { 
                name: { equals: data.name.trim(), mode: 'insensitive' },
                id: { not: id } 
            }
        });

        if (existing) return { success: false, error: "Ya existe otro proveedor con este nombre" };

        await prisma.supplier.update({
            where: { id },
            data: {
                name: data.name.trim(),
                notes: data.notes || null
            }
        });

        revalidatePath("/inventory/suppliers");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteSupplier(id: string) {
    try {
        // Soft delete
        await prisma.supplier.update({
            where: { id },
            data: { isActive: false }
        });

        // Optionally, detach from products
        // await prisma.product.updateMany({
        //     where: { supplierId: id },
        //     data: { supplierId: null }
        // });

        revalidatePath("/inventory/suppliers");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
