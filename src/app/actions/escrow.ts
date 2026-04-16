"use server";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

// Libera el pago al vendedor (comprador confirmó recepción o admin lo aprueba)
export async function releasePayment(orderId: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado" };

        const order = await (prisma.order as any).findUnique({
            where: { id: orderId },
            select: {
                id: true, status: true, buyerId: true, sellerId: true,
                total: true, shippingCost: true, commissionAmount: true,
                sellerEarnings: true, stripePaymentIntentId: true,
                paymentReleasedAt: true,
                seller: { select: { stripeAccountId: true, stripeConnectStatus: true, commission: true } }
            }
        });

        if (!order) return { success: false, error: "Pedido no encontrado" };

        // Solo el comprador del pedido o un admin puede liberar
        if (user.role !== "ADMIN" && order.buyerId !== user.id) {
            return { success: false, error: "No autorizado" };
        }

        if (order.status !== "PAID") {
            return { success: false, error: "El pedido no está en estado PAID" };
        }

        if (order.paymentReleasedAt) {
            return { success: false, error: "El pago ya fue liberado anteriormente" };
        }

        // Calcular lo que recibe el vendedor
        const commissionPct = order.seller?.commission || 5;
        const commissionAmt = order.commissionAmount > 0
            ? order.commissionAmount
            : order.total * (commissionPct / 100);
        const earnings = order.sellerEarnings > 0
            ? order.sellerEarnings
            : order.total - commissionAmt;

        // Transferir al vendedor si tiene Stripe Connect activo
        if (order.seller?.stripeAccountId && order.seller?.stripeConnectStatus === "active") {
            const transferAmount = Math.round(earnings * 100); // centavos
            if (transferAmount > 0) {
                await stripe.transfers.create({
                    amount: transferAmount,
                    currency: "mxn",
                    destination: order.seller.stripeAccountId,
                    source_transaction: order.stripePaymentIntentId || undefined,
                    metadata: { orderId, sellerId: order.sellerId },
                });
            }
        }

        // Actualizar el pedido
        await (prisma.order as any).update({
            where: { id: orderId },
            data: {
                status: "COMPLETED",
                paymentReleasedAt: new Date(),
                commissionAmount: commissionAmt,
                sellerEarnings: earnings,
            }
        });

        revalidatePath("/orders");
        revalidatePath("/dashboard");
        revalidatePath("/admin/marketplace");
        return { success: true };
    } catch (error: any) {
        console.error("releasePayment error:", error);
        return { success: false, error: error.message };
    }
}

// Reembolsa el pago completo al comprador
export async function refundPayment(orderId: string) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "ADMIN") return { success: false, error: "Solo el administrador puede reembolsar" };

        const order = await (prisma.order as any).findUnique({
            where: { id: orderId },
            select: {
                id: true, status: true, stripePaymentIntentId: true,
                paymentReleasedAt: true, refundedAt: true, total: true
            }
        });

        if (!order) return { success: false, error: "Pedido no encontrado" };
        if (order.refundedAt) return { success: false, error: "Ya fue reembolsado" };
        if (order.paymentReleasedAt) return { success: false, error: "El pago ya fue liberado al vendedor, no se puede reembolsar" };
        if (!["PAID", "PENDING_PAYMENT"].includes(order.status)) {
            return { success: false, error: "El pedido no tiene un pago activo para reembolsar" };
        }

        // Hacer el reembolso en Stripe
        if (order.stripePaymentIntentId) {
            await stripe.refunds.create({
                payment_intent: order.stripePaymentIntentId,
            });
        }

        await (prisma.order as any).update({
            where: { id: orderId },
            data: { status: "REFUNDED", refundedAt: new Date() }
        });

        revalidatePath("/orders");
        revalidatePath("/dashboard");
        revalidatePath("/admin/marketplace");
        return { success: true };
    } catch (error: any) {
        console.error("refundPayment error:", error);
        return { success: false, error: error.message };
    }
}

// Obtener pedidos del comprador
export async function getBuyerOrders() {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, data: [] };

        const orders = await prisma.order.findMany({
            where: { buyerId: user.id },
            include: {
                items: {
                    include: {
                        variant: {
                            include: {
                                product: { select: { id: true, name: true, images: true, slug: true } }
                            }
                        }
                    }
                },
                seller: { select: { id: true, name: true, businessName: true, logoUrl: true } },
                shippingAddress: true,
                shipment: true,
            },
            orderBy: { createdAt: "desc" }
        });

        return { success: true, data: orders };
    } catch (error: any) {
        return { success: false, data: [], error: error.message };
    }
}
