"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";
import {
  sendNewOrderToSeller,
  sendNewOrderToBuyer,
  sendOrderConfirmedToBuyer,
  sendOrderRejectedToBuyer,
  sendLowInventoryAlert,
  sendOrderUpdatedToBuyer,
} from "@/lib/email/templates";
import { redeemPoints, pointsToMXN, getProgram, earnPointsForDeliveredOrder, revertOrderLoyalty } from "@/lib/loyalty";
import { calculateAutoDiscount } from "@/lib/discountUtils";

interface OrderItemInput {
    variantId: string;
    quantity: number;
    price: number;
    productName: string;
    color?: string;
    size?: string;
}

// Create a new order from the buyer's cart (one order per seller)
export async function createOrder(data: {
    sellerId: string;
    items: OrderItemInput[];
    notes?: string;
    priceTierId?: string;
    discount?: number;
    status?: string;
    shippingAddressId?: string;
    shippingCost?: number;
    skydropxRateId?: string;
    skydropxQuotationId?: string;
    shippingCarrier?: string;
    shippingServiceName?: string;
    paymentMethod?: string;
    domain?: string;
    loyaltyRedeemPoints?: number;
}) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "Debes iniciar sesión para realizar un pedido." };

        // === Recalcular precios desde la BD para prevenir manipulación desde el cliente ===
        const variantIds = data.items.map(i => i.variantId);
        const variants = await prisma.variant.findMany({
            where: { id: { in: variantIds } },
            include: {
                product: { select: { price: true, sellByPackage: true, onlinePriceLocationId: true } },
                inventoryLevels: { select: { locationId: true, price: true } }
            }
        });
        const variantMap = new Map(variants.map(v => [v.id, v]));

        const serverItems = data.items.map(item => {
            const variant = variantMap.get(item.variantId) as any;
            if (!variant) return null;
            const product = variant.product;
            let basePrice: number;
            if (product.onlinePriceLocationId) {
                const level = variant.inventoryLevels?.find((l: any) => l.locationId === product.onlinePriceLocationId);
                basePrice = (level?.price != null) ? level.price : (variant.price ?? product.price);
            } else {
                basePrice = variant.price ?? product.price;
            }
            return { ...item, basePrice, sellByPackage: !!product.sellByPackage };
        }).filter(Boolean) as any[];

        if (serverItems.length !== data.items.length) {
            return { success: false, error: "Algunas variantes ya no están disponibles." };
        }

        // Aplicar descuento por volumen en el servidor si se proporcionó priceTierId
        if (data.priceTierId) {
            const tier = await (prisma as any).priceTier.findUnique({ where: { id: data.priceTierId } });
            if (tier) {
                const looseItems = serverItems.filter(i => !i.sellByPackage);
                const looseQty = looseItems.reduce((s: number, i: any) => s + i.quantity, 0);
                const looseTotal = looseItems.reduce((s: number, i: any) => s + i.basePrice * i.quantity, 0);
                const discountResult = calculateAutoDiscount([tier], looseQty, looseTotal);
                if (discountResult && discountResult.discount > 0) {
                    const unitDiscount = discountResult.discount / looseQty;
                    serverItems.forEach(item => {
                        if (!item.sellByPackage && unitDiscount > 0) {
                            item.price = Math.max(0, Math.round((item.basePrice - unitDiscount) * 100) / 100);
                        } else {
                            item.price = item.basePrice;
                        }
                    });
                } else {
                    serverItems.forEach(item => { item.price = item.basePrice; });
                }
            } else {
                serverItems.forEach(item => { item.price = item.basePrice; });
            }
        } else {
            serverItems.forEach(item => { item.price = item.basePrice; });
        }

        const total = Math.round(serverItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
        const discount = Math.round((data.discount || 0) * 100) / 100;

        // Loyalty discount calculation
        let loyaltyDiscount = 0;
        const requestedRedeemPoints = Math.floor(data.loyaltyRedeemPoints || 0);
        if (requestedRedeemPoints > 0) {
            const program = await getProgram(data.sellerId);
            if (program?.isActive) {
                loyaltyDiscount = Math.round(pointsToMXN(requestedRedeemPoints, program.redeemRate) * 100) / 100;
            }
        }

        const finalTotal = Math.round(Math.max(0, total - discount - loyaltyDiscount) * 100) / 100;

        // Fetch seller's commission rate
        const seller = await prisma.user.findUnique({
            where: { id: data.sellerId },
            select: { commission: true }
        });

        const commissionRate = seller?.commission ?? 5; // Default 5% if not set
        const commissionAmount = Math.round((finalTotal * commissionRate / 100) * 100) / 100;
        const sellerEarnings = Math.round((finalTotal - commissionAmount) * 100) / 100;

        const order = await prisma.order.create({
            data: {
                buyerId: user.id,
                sellerId: data.sellerId,
                status: data.status || "PENDING",
                total: finalTotal + (data.shippingCost || 0),
                commissionRate,
                commissionAmount,
                sellerEarnings,
                notes: data.notes || null,
                paymentMethod: data.paymentMethod || null,
                priceTierId: data.priceTierId || null,
                shippingAddressId: data.shippingAddressId || null,
                shippingCost: data.shippingCost || 0,
                skydropxRateId: data.skydropxRateId || null,
                skydropxQuotationId: data.skydropxQuotationId || null,
                shippingCarrier: data.shippingCarrier || null,
                shippingServiceName: data.shippingServiceName || null,
                sourceDomain: data.domain || null,
                discount: discount,
                loyaltyDiscount,
                items: {
                    create: serverItems.map(item => ({
                        variantId: item.variantId,
                        quantity: item.quantity,
                        price: item.price,
                        productName: item.productName,
                        color: item.color || null,
                        size: item.size || null,
                    }))
                }
            }
        });

        // Notificar al vendedor por email (async, no bloquea la respuesta)
        const isKalexaDomain = data.domain?.includes('kalexa');
        prisma.user.findUnique({
            where: { id: data.sellerId },
            select: { email: true, name: true },
        }).then(seller => {
            if (seller) {
                sendNewOrderToSeller({
                    sellerEmail: seller.email,
                    sellerName: seller.name,
                    buyerName: user.name,
                    orderNumber: order.orderNumber,
                    orderId: order.id,
                    items: serverItems,
                    total: finalTotal,
                    notes: data.notes,
                    brandName: isKalexaDomain ? 'Kalexa Fashion' : undefined,
                    brandColor: isKalexaDomain ? '#8124E3' : undefined,
                }).catch(console.error);
            }
        }).catch(console.error);

        // Notificar al comprador por email
        if (user.email) {
            const isKalexa = data.domain?.includes('kalexa');
            prisma.user.findUnique({
                where: { id: data.sellerId },
                select: { name: true, businessName: true },
            }).then(seller => {
                sendNewOrderToBuyer({
                    buyerEmail: user.email!,
                    buyerName: user.name,
                    sellerName: seller?.businessName || seller?.name || 'Kalexa Fashion',
                    orderNumber: order.orderNumber,
                    items: serverItems,
                    total: finalTotal,
                    notes: data.notes,
                    brandName: isKalexa ? 'Kalexa Fashion' : undefined,
                    brandColor: isKalexa ? '#8124E3' : undefined,
                    paymentMethod: data.paymentMethod,
                }).catch(console.error);
            }).catch(console.error);
        }

        // Loyalty: redeem first, then earn (based on finalTotal post all discounts)
        if (requestedRedeemPoints > 0) {
            try {
                await redeemPoints({
                    sellerId: data.sellerId,
                    customer: { buyerId: user.id },
                    points: requestedRedeemPoints,
                    orderId: order.id,
                });
            } catch (e) {
                console.error("Loyalty redeem failed:", e);
            }
        }

        revalidatePath("/orders");
        return { success: true, orderId: order.id, orderNumber: order.orderNumber };
    } catch (error: any) {
        console.error("Error creating order:", error);
        return { success: false, error: "No se pudo crear el pedido." };
    }
}

// Get orders for the current buyer
export async function getMyOrders() {
    try {
        const user = await getSessionUser();
        if (!user) return [];

        return await prisma.order.findMany({
            where: { buyerId: user.id },
            include: {
                items: true,
                seller: { select: { name: true, businessName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        console.error("Error fetching buyer orders:", error);
        return [];
    }
}

// Get orders received by the current seller
export async function getSellerOrders() {
    try {
        const user = await getSessionUser();
        if (!user) return [];

        let sellerId = user.id;
        // If cashier/manager, get the seller from their location
        if (user.role !== 'SELLER' && user.role !== 'ADMIN' && user.locationId) {
            const loc = await prisma.storeLocation.findUnique({
                where: { id: user.locationId },
                select: { sellerId: true }
            });
            if (loc?.sellerId) sellerId = loc.sellerId;
        }

        return await prisma.order.findMany({
            where: user.role === 'ADMIN' ? {} : { sellerId },
            include: {
                items: true,
                buyer: { select: { name: true, email: true, businessName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        console.error("Error fetching seller orders:", error);
        return [];
    }
}

// Update order status (seller action)
export async function updateOrderStatus(orderId: string, status: string, sellerNotes?: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado" };

        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return { success: false, error: "Pedido no encontrado" };

        // Only the seller or admin can update
        if (user.role !== 'ADMIN' && order.sellerId !== user.id) {
            return { success: false, error: "No tienes permiso para modificar este pedido." };
        }

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                status,
                sellerNotes: sellerNotes || undefined
            },
            include: {
                buyer: { select: { email: true, name: true } },
                seller: { select: { name: true } },
                items: true,
            }
        });

        // Notificar al comprador según el nuevo status
        if (status === 'ACCEPTED' || status === 'REJECTED') {
            const buyer = updatedOrder.buyer;
            const sellerName = updatedOrder.seller?.name || 'El vendedor';

            if (status === 'ACCEPTED') {
                // Descontar inventario y verificar stock bajo
                const lowStockItems: any[] = [];
                
                // Usamos una transacción para asegurar consistencia
                await prisma.$transaction(async (tx) => {
                    for (const item of updatedOrder.items) {
                        const variant = await tx.variant.update({
                            where: { id: item.variantId },
                            data: { stock: { decrement: item.quantity } },
                            include: { product: true }
                        });

                        await tx.inventoryMovement.create({
                            data: {
                                variantId: item.variantId,
                                type: 'SALE',
                                quantity: -item.quantity,
                                reason: `Orden #${updatedOrder.orderNumber} aceptada`,
                                // Nota: En el marketplace no siempre tenemos un locationId fijo, 
                                // podrías asignar uno predeterminado del vendedor si fuera necesario.
                            }
                        });

                        if (variant.stock <= 1) {
                            lowStockItems.push({
                                productName: variant.product.name,
                                variantName: `${variant.color || ''} ${variant.size || ''}`.trim(),
                                stock: variant.stock
                            });
                        }
                    }
                });

                if (lowStockItems.length > 0) {
                    const seller = await prisma.user.findUnique({
                        where: { id: updatedOrder.sellerId },
                        select: { email: true, name: true }
                    });
                    if (seller?.email) {
                        sendLowInventoryAlert({
                            sellerEmail: seller.email,
                            sellerName: seller.name || 'Vendedor',
                            items: lowStockItems
                        }).catch(console.error);
                    }
                }

                sendOrderConfirmedToBuyer({
                    buyerEmail: buyer.email,
                    buyerName: buyer.name,
                    sellerName,
                    orderNumber: updatedOrder.orderNumber,
                    items: updatedOrder.items,
                    total: updatedOrder.total,
                    sellerNotes: sellerNotes,
                }).catch(console.error);
            } else {
                sendOrderRejectedToBuyer({
                    buyerEmail: buyer.email,
                    buyerName: buyer.name,
                    sellerName,
                    orderNumber: updatedOrder.orderNumber,
                    sellerNotes: sellerNotes,
                }).catch(console.error);
            }
        }

        // Los puntos se ganan hasta que el pedido se entrega.
        if (status === 'COMPLETED') {
            try {
                await earnPointsForDeliveredOrder({
                    id: updatedOrder.id,
                    sellerId: updatedOrder.sellerId,
                    buyerId: updatedOrder.buyerId,
                    total: updatedOrder.total,
                    shippingCost: updatedOrder.shippingCost,
                });
            } catch (e) {
                console.error("Loyalty earn on delivery failed:", e);
            }
        }

        // Si el pedido se cae, se deshace todo lo de puntos: se quita lo ganado
        // (si ya se había entregado) y se devuelve lo que el comprador canjeó.
        if (status === 'CANCELLED' || status === 'REJECTED' || status === 'REFUNDED') {
            try {
                await revertOrderLoyalty(updatedOrder.id);
            } catch (e) {
                console.error("Loyalty revert failed:", e);
            }
        }

        revalidatePath("/orders");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error: any) {
        console.error("Error updating order status:", error);
        return { success: false, error: "No se pudo actualizar el pedido." };
    }
}

export async function deleteOrder(orderId: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado" };

        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return { success: false, error: "Pedido no encontrado" };

        // Solo se pueden borrar pedidos cancelados/rechazados
        if (!["CANCELLED", "REJECTED"].includes(order.status)) {
            return { success: false, error: "Solo se pueden eliminar pedidos cancelados o rechazados" };
        }

        // Solo el vendedor o admin puede borrar
        if (user.role !== "ADMIN" && order.sellerId !== user.id) {
            return { success: false, error: "Sin permiso" };
        }

        // Antes de borrar, deshacer los puntos para no dejar movimientos
        // apuntando a un pedido que ya no existe.
        try {
            await revertOrderLoyalty(orderId);
        } catch (e) {
            console.error("Loyalty revert on delete failed:", e);
        }

        await prisma.order.delete({ where: { id: orderId } });
        revalidatePath("/orders");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Busca variantes del vendedor para reemplazar artículos en un pedido
export async function searchOrderVariants(sellerId: string, query: string) {
    try {
        const variants = await prisma.variant.findMany({
            where: {
                stock: { gt: 0 },
                product: {
                    sellerId,
                    isActive: true,
                    OR: query.trim()
                        ? [
                            { name: { contains: query, mode: 'insensitive' } },
                            { sku: { contains: query, mode: 'insensitive' } },
                          ]
                        : undefined,
                },
            },
            include: {
                product: {
                    select: { id: true, name: true, images: true, price: true, wholesalePrice: true }
                }
            },
            orderBy: { product: { name: 'asc' } },
            take: 30,
        });

        return { success: true, variants };
    } catch (e: any) {
        return { success: false, error: e.message, variants: [] };
    }
}

// Actualiza los artículos de un pedido (reemplazos acordados con el comprador)
export async function updateOrderItems(orderId: string, items: {
    variantId: string;
    quantity: number;
    price: number;
    productName: string;
    color?: string;
    size?: string;
}[], options?: { notifyBuyer?: boolean; sellerNotes?: string }) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado" };

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                buyer:  { select: { email: true, name: true } },
                seller: { select: { name: true, businessName: true } },
            }
        });
        if (!order) return { success: false, error: "Pedido no encontrado" };

        if (user.role !== 'ADMIN' && order.sellerId !== user.id)
            return { success: false, error: "Sin permiso" };

        if (["SHIPPED", "COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"].includes(order.status))
            return { success: false, error: "No se puede editar un pedido que ya fue enviado, completado o cancelado" };

        if (items.length === 0)
            return { success: false, error: "El pedido debe tener al menos un artículo" };

        const newTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const commissionAmount = (newTotal * order.commissionRate) / 100;
        const sellerEarnings = newTotal - commissionAmount;

        await prisma.$transaction(async (tx) => {
            await tx.orderItem.deleteMany({ where: { orderId } });
            await tx.orderItem.createMany({
                data: items.map(i => ({
                    orderId,
                    variantId: i.variantId,
                    quantity: i.quantity,
                    price: i.price,
                    productName: i.productName,
                    color: i.color || null,
                    size: i.size || null,
                }))
            });
            await tx.order.update({
                where: { id: orderId },
                data: { total: newTotal, commissionAmount, sellerEarnings }
            });
        });

        // Notificar al comprador si se solicitó
        if (options?.notifyBuyer && order.buyer?.email) {
            const sellerName = (order.seller as any)?.businessName || (order.seller as any)?.name || 'El vendedor';
            sendOrderUpdatedToBuyer({
                buyerEmail: order.buyer.email,
                buyerName:  order.buyer.name || 'Cliente',
                sellerName,
                orderNumber: order.orderNumber,
                items,
                total: newTotal,
                sellerNotes: options.sellerNotes,
            }).catch(console.error);
        }

        revalidatePath("/orders");
        return { success: true, newTotal };
    } catch (e: any) {
        console.error("Error updating order items:", e);
        return { success: false, error: e.message };
    }
}
