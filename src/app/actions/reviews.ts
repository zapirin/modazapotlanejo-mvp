"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "./auth";
import { revalidatePath } from "next/cache";

// Verificar si el comprador puede calificar (tiene orden completada con ese vendedor)
export async function canReviewSeller(sellerId: string) {
    const user = await getSessionUser();
    if (!user) return { can: false, reason: 'not_logged' };

    const completedOrder = await prisma.order.findFirst({
        where: {
            buyerId: user.id,
            sellerId,
            status: 'COMPLETED',
            review: null, // No ha calificado aún
        },
        orderBy: { createdAt: 'desc' },
    });

    if (!completedOrder) {
        const alreadyReviewed = await prisma.order.findFirst({
            where: { buyerId: user.id, sellerId, status: 'COMPLETED' },
        });
        if (alreadyReviewed) return { can: false, reason: 'already_reviewed' };
        return { can: false, reason: 'no_completed_order' };
    }

    return { can: true, orderId: completedOrder.id };
}

// Crear una reseña
export async function createReview(data: {
    sellerId: string;
    orderId: string;
    rating: number;
    title?: string;
    body: string;
}) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: 'No autenticado' };

        if (data.rating < 1 || data.rating > 5) return { success: false, error: 'Calificación inválida' };
        if (!data.body.trim()) return { success: false, error: 'La reseña no puede estar vacía' };

        // Verificar que la orden existe y es del comprador
        const order = await prisma.order.findFirst({
            where: { id: data.orderId, buyerId: user.id, sellerId: data.sellerId, status: 'COMPLETED' },
        });
        if (!order) return { success: false, error: 'No puedes calificar esta compra' };

        await (prisma as any).sellerReview.create({
            data: {
                sellerId: data.sellerId,
                buyerId: user.id,
                orderId: data.orderId,
                rating: data.rating,
                title: data.title || null,
                body: data.body,
            }
        });

        revalidatePath(`/vendor/${data.sellerId}`);
        return { success: true };
    } catch (e: any) {
        if (e.code === 'P2002') return { success: false, error: 'Ya calificaste esta compra' };
        return { success: false, error: e.message };
    }
}

// Obtener reseñas de un vendedor
export async function getSellerReviews(sellerId: string) {
    try {
        const reviews = await (prisma as any).sellerReview.findMany({
            where: { sellerId, isVisible: true },
            include: {
                buyer: { select: { name: true, businessName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const total = reviews.length;
        const avg = total > 0 ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / total : 0;
        const dist = [5,4,3,2,1].map(n => ({
            stars: n,
            count: reviews.filter((r: any) => r.rating === n).length
        }));

        return { reviews, avg: Math.round(avg * 10) / 10, total, distribution: dist };
    } catch { return { reviews: [], avg: 0, total: 0, distribution: [] }; }
}

// Vendedor responde a una reseña
export async function replyToReview(reviewId: string, reply: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: 'No autenticado' };

        const review = await (prisma as any).sellerReview.findUnique({ where: { id: reviewId } });
        if (!review || review.sellerId !== user.id) return { success: false, error: 'No autorizado' };

        await (prisma as any).sellerReview.update({
            where: { id: reviewId },
            data: { sellerReply: reply, repliedAt: new Date() }
        });

        revalidatePath(`/vendor/${user.id}`);
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// Admin oculta/muestra una reseña
export async function toggleReviewVisibility(reviewId: string) {
    try {
        const review = await (prisma as any).sellerReview.findUnique({ where: { id: reviewId } });
        if (!review) return { success: false, error: 'No encontrada' };
        await (prisma as any).sellerReview.update({
            where: { id: reviewId },
            data: { isVisible: !review.isVisible }
        });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// Obtener reseñas recibidas por el vendedor (para su dashboard)
export async function getMyReceivedReviews() {
    try {
        const user = await getSessionUser();
        if (!user) return [];
        return await (prisma as any).sellerReview.findMany({
            where: { sellerId: user.id },
            include: { buyer: { select: { name: true, businessName: true } } },
            orderBy: { createdAt: 'desc' },
        });
    } catch { return []; }
}
