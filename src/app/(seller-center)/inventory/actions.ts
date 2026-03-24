"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/app/actions/auth";

export async function adjustProductStock(productId: string, adjustments: { variantId: string, quantity: number }[]) {
    try {
        const user = await getSessionUser();
        
        // Use a transaction to ensure all variants and movements are recorded atomically
        await prisma.$transaction(async (tx) => {
            for (const adj of adjustments) {
                // Determine whether it's an addition or subtraction based on the sign
                const movementType = adj.quantity > 0 ? "RESTOCK" : "ADJUSTMENT";
                
                // Security check: Ensure the variant belongs to the seller
                if (user?.role !== 'ADMIN') {
                    const variant = await tx.variant.findUnique({
                        where: { id: adj.variantId },
                        include: { product: true }
                    });
                    if (!variant || variant.product.sellerId !== user?.id) {
                        throw new Error("No tienes permiso para ajustar el stock de este producto.");
                    }
                }

                // Only process if quantity is not 0
                if (adj.quantity !== 0) {
                    await tx.inventoryMovement.create({
                        data: {
                            variantId: adj.variantId,
                            type: movementType,
                            quantity: adj.quantity,
                            reason: `Ajuste manual de inventario directo. Creado por ${user?.name || "Administrador"}`,
                            locationId: user?.locationId
                        }
                    });

                    await tx.variant.update({
                        where: { id: adj.variantId },
                        data: {
                            stock: {
                                increment: adj.quantity
                            }
                        }
                    });
                }
            }
        });

        revalidatePath("/inventory");
        revalidatePath("/pos");
        return { success: true };
    } catch (error: any) {
        console.error("Error al ajustar el inventario:", error);
        return { success: false, error: "No se pudo ajustar el inventario." };
    }
}
