"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

/**
 * Get all sellers with pending (non-settled) earnings from completed orders.
 */
export async function getPendingSettlements() {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'ADMIN') {
            throw new Error("No autorizado");
        }

        const pendingOrders = await prisma.order.findMany({
            where: {
                status: 'COMPLETED',
                isSettled: false,
            },
            include: {
                seller: {
                    select: {
                        id: true,
                        name: true,
                        businessName: true,
                        email: true
                    }
                }
            }
        });

        // Group by seller
        const sellersMap = new Map();

        pendingOrders.forEach(order => {
            if (!sellersMap.has(order.sellerId)) {
                sellersMap.set(order.sellerId, {
                    sellerId: order.sellerId,
                    sellerName: order.seller.businessName || order.seller.name,
                    sellerEmail: order.seller.email,
                    totalPending: 0,
                    commissionTotal: 0,
                    orders: []
                });
            }

            const data = sellersMap.get(order.sellerId);
            const isDirectPayment = order.paymentMethod && 
                ['transferencia', 'efectivo', 'depósito', 'deposito', 'transfer', 'cash'].some(m => order.paymentMethod!.toLowerCase().includes(m));

            if (isDirectPayment) {
                // Seller received full amount. They owe the marketplace the commission.
                data.totalPending -= order.commissionAmount;
            } else {
                // Marketplace received full amount. Marketplace owes seller the earnings.
                data.totalPending += order.sellerEarnings;
            }
            
            data.commissionTotal += order.commissionAmount;
            data.orders.push(order);
        });

        return Array.from(sellersMap.values());
    } catch (error) {
        console.error("Error fetching pending settlements:", error);
        return [];
    }
}

/**
 * Create a settlement record and mark associated orders as settled.
 */
export async function createSettlement(data: {
    sellerId: string;
    orderIds: string[];
    amount: number;
    commissionTotal: number;
    paymentMethod?: string;
    reference?: string;
}) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'ADMIN') {
            return { success: false, error: "No autorizado" };
        }

        await prisma.$transaction(async (tx) => {
            // Create settlement
            const settlement = await tx.settlement.create({
                data: {
                    sellerId: data.sellerId,
                    amount: data.amount,
                    commissionTotal: data.commissionTotal,
                    ordersCount: data.orderIds.length,
                    status: 'COMPLETED',
                    paymentMethod: data.paymentMethod,
                    reference: data.reference,
                    orders: {
                        connect: data.orderIds.map(id => ({ id }))
                    }
                }
            });

            // Mark orders as settled
            await tx.order.updateMany({
                where: {
                    id: { in: data.orderIds }
                },
                data: {
                    isSettled: true
                }
            });

            return settlement;
        });

        revalidatePath("/admin/settlements");
        return { success: true };
    } catch (error: any) {
        console.error("Error creating settlement:", error);
        return { success: false, error: "No se pudo procesar la liquidación." };
    }
}

/**
 * Get settlement history for a seller.
 */
export async function getSellerSettlements(sellerId?: string) {
    try {
        const user = await getSessionUser();
        if (!user) return [];

        const targetSellerId = sellerId || user.id;

        // Security check: only ADMIN can see other sellers
        if (targetSellerId !== user.id && user.role !== 'ADMIN') {
            return [];
        }

        return await prisma.settlement.findMany({
            where: { sellerId: targetSellerId },
            include: {
                orders: {
                    select: {
                        orderNumber: true,
                        total: true,
                        commissionAmount: true,
                        sellerEarnings: true,
                        createdAt: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        console.error("Error fetching settlements:", error);
        return [];
    }
}

/**
 * Get overall balance for the current seller.
 */
export async function getSellerBalance() {
    try {
        const user = await getSessionUser();
        if (!user) return null;

        const pendingOrders = await prisma.order.findMany({
            where: {
                sellerId: user.id,
                status: 'COMPLETED',
                isSettled: false
            },
            select: {
                id: true,
                sellerEarnings: true,
                commissionAmount: true,
                paymentMethod: true
            }
        });

        let availableBalance = 0;
        pendingOrders.forEach(order => {
            const isDirectPayment = order.paymentMethod && 
                ['transferencia', 'efectivo', 'depósito', 'deposito', 'transfer', 'cash'].some(m => order.paymentMethod!.toLowerCase().includes(m));
            
            if (isDirectPayment) {
                availableBalance -= order.commissionAmount;
            } else {
                availableBalance += order.sellerEarnings;
            }
        });

        const settled = await prisma.settlement.aggregate({
            where: {
                sellerId: user.id
            },
            _sum: {
                amount: true
            }
        });

        return {
            availableBalance,
            pendingOrdersCount: pendingOrders.length,
            totalPaid: settled._sum.amount || 0
        };
    } catch (error) {
        console.error("Error fetching seller balance:", error);
        return null;
    }
}
