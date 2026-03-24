"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getDeletedInventory() {
    try {
        const products = await prisma.product.findMany({
            where: { isActive: false },
            include: {
                category: true,
                subcategory: true,
                variants: true
            },
            orderBy: { updatedAt: 'desc' }
        });
        return products;
    } catch (error) {
        console.error("Error fetching deleted inventory:", error);
        return [];
    }
}

export async function restoreProduct(productId: string) {
    try {
        await prisma.product.update({
            where: { id: productId },
            data: { isActive: true }
        });
        revalidatePath("/inventory");
        revalidatePath("/inventory/trash");
        revalidatePath("/pos");
        return { success: true };
    } catch (error: any) {
        console.error("Error restoring product:", error);
        return { success: false, error: "No se pudo restaurar el producto." };
    }
}

export async function hardDeleteProduct(productId: string) {
    try {
        await prisma.product.delete({
            where: { id: productId }
        });
        revalidatePath("/inventory/trash");
        return { success: true };
    } catch (error: any) {
        console.error("Error hard deleting product:", error);
        return { success: false, error: "No se pudo eliminar definitivamente. Es posible que el producto tenga ventas o movimientos asociados. Te sugerimos mantenerlo en la papelera." };
    }
}
