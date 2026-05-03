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

export async function adjustProductStockGrid(
    productId: string,
    adjustments: { variantId: string, locationId: string, quantity: number }[]
) {
    try {
        const user = await getSessionUser();
        
        await prisma.$transaction(async (tx) => {
            for (const adj of adjustments) {
                // Determine old quantity to calculate difference
                const existingLevel = await tx.inventoryLevel.findUnique({
                    where: {
                        variantId_locationId: {
                            variantId: adj.variantId,
                            locationId: adj.locationId
                        }
                    }
                });

                const oldStock = existingLevel?.stock || 0;
                const difference = adj.quantity - oldStock;

                // Security check
                if (user?.role !== 'ADMIN') {
                    const variant = await tx.variant.findUnique({
                        where: { id: adj.variantId },
                        include: { product: true }
                    });
                    if (!variant || variant.product.sellerId !== user?.id) {
                        throw new Error("No tienes permiso.");
                    }
                }

                // If nothing changed for this cell, skip
                if (difference === 0) continue;

                const movementType = difference > 0 ? "RESTOCK" : "ADJUSTMENT";

                await tx.inventoryMovement.create({
                    data: {
                        variantId: adj.variantId,
                        type: movementType,
                        quantity: difference,
                        reason: `Actualización de inventario multi-sucursal. Creado por ${user?.name || "Administrador"}`,
                        locationId: adj.locationId
                    }
                });

                // Upsert InventoryLevel mapping
                await tx.inventoryLevel.upsert({
                    where: {
                        variantId_locationId: {
                            variantId: adj.variantId,
                            locationId: adj.locationId
                        }
                    },
                    create: {
                        variantId: adj.variantId,
                        locationId: adj.locationId,
                        stock: adj.quantity
                    },
                    update: {
                        stock: adj.quantity
                    }
                });

                // Compute global Variant stock
                await tx.variant.update({
                    where: { id: adj.variantId },
                    data: { stock: { increment: difference } }
                });
            }
        });

        revalidatePath("/inventory");
        revalidatePath("/pos");
        return { success: true };
    } catch (error: any) {
        console.error("Error al ajustar el inventario multi-sucursal:", error);
        return { success: false, error: error.message };
    }
}

// ─── Historial de ventas de un producto (solo SELLER) ──────────────────────
export async function getProductSalesHistory(
    productId: string,
    page: number = 1,
    status: string = 'all'
) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'SELLER') {
            return { success: false, error: 'No autorizado.' };
        }

        const pageSize = 20;
        const skip = (Math.max(1, page) - 1) * pageSize;

        // Filtro: ventas del seller que contengan al menos un item del producto
        const baseWhere: any = {
            sellerId: user.id,
            items: { some: { variant: { productId } } },
        };
        if (status && status !== 'all') {
            baseWhere.status = status;
        }

        const [total, sales] = await Promise.all([
            prisma.sale.count({ where: baseWhere }),
            prisma.sale.findMany({
                where: baseWhere,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
                include: {
                    items: {
                        where: { variant: { productId } },
                        include: {
                            variant: { select: { id: true, color: true, size: true } },
                        },
                    },
                    location: { select: { id: true, name: true } },
                    soldBy: { select: { id: true, name: true } },
                    salesperson: { select: { id: true, name: true } },
                    paymentMethod: { select: { id: true, name: true } },
                    client: { select: { id: true, name: true } },
                },
            }),
        ]);

        const rows = sales.map((s: any) => ({
            id: s.id,
            receiptNumber: s.receiptNumber,
            createdAt: s.createdAt,
            status: s.status,
            total: s.total,
            locationName: s.location?.name || null,
            cashierName: s.soldBy?.name || null,
            salespersonName: s.salesperson?.name || null,
            paymentMethodName: s.paymentMethod?.name || null,
            clientName: s.client?.name || null,
            items: s.items.map((it: any) => ({
                id: it.id,
                quantity: it.quantity,
                price: it.price,
                variantInfo: [it.variant?.color, it.variant?.size].filter(Boolean).join(' / ') || null,
            })),
        }));

        return {
            success: true,
            rows,
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
    } catch (error: any) {
        console.error('Error fetching product sales history:', error);
        return { success: false, error: error.message || 'Error al cargar el historial.' };
    }
}

// Obtener una venta completa para reimpresión (con aislamiento por seller)
export async function getSaleForReprint(saleId: string) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'SELLER') return null;

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: {
                items: {
                    include: {
                        variant: {
                            include: { product: { select: { id: true, name: true } } },
                        },
                    },
                },
                client: { select: { id: true, name: true } },
                paymentMethod: { select: { id: true, name: true } },
                location: { select: { id: true, name: true, address: true, ticketHeader: true, ticketFooter: true } },
                soldBy: { select: { id: true, name: true } },
                salesperson: { select: { id: true, name: true } },
            },
        });

        if (!sale) return null;
        if (sale.sellerId && sale.sellerId !== user.id) return null;
        return sale;
    } catch (error) {
        console.error('Error fetching sale for reprint:', error);
        return null;
    }
}
