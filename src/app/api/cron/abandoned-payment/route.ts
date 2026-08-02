import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPendingPaymentReminder } from '@/lib/email/templates';

const GRACIA_HORAS = 4;   // no molestar antes de esto
const VENTANA_HORAS = 48; // ni después: evita escribirle al historial viejo

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Modo ensayo: reporta a quién se le escribiría, sin enviar ni marcar nada.
    const ensayo = req.nextUrl.searchParams.get('dryRun') === '1';

    try {
        const ahora = Date.now();
        const masNuevaQue = new Date(ahora - VENTANA_HORAS * 60 * 60 * 1000);
        const masViejaQue = new Date(ahora - GRACIA_HORAS * 60 * 60 * 1000);

        const orders = await prisma.order.findMany({
            where: {
                status: 'PENDING_PAYMENT',
                paymentReminderSentAt: null,
                createdAt: { lte: masViejaQue, gte: masNuevaQue },
            },
            include: {
                buyer: { select: { id: true, email: true, name: true } },
                seller: { select: { name: true, businessName: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Un checkout genera una orden por vendedor: agrupar para mandar un
        // solo correo por comprador, no uno por vendedor.
        const porComprador = new Map<string, typeof orders>();
        for (const order of orders) {
            if (!order.buyer?.email) continue;
            const lista = porComprador.get(order.buyerId) ?? [];
            lista.push(order);
            porComprador.set(order.buyerId, lista);
        }

        if (ensayo) {
            const destinatarios = [...porComprador.values()].map(ordenes => ({
                email: ordenes[0].buyer.email,
                pedidos: ordenes.map(o => o.orderNumber),
            }));
            return NextResponse.json({ ok: true, dryRun: true, destinatarios });
        }

        let enviados = 0;

        for (const ordenes of porComprador.values()) {
            const comprador = ordenes[0].buyer;
            try {
                const res = await sendPendingPaymentReminder({
                    buyerEmail: comprador.email,
                    buyerName: comprador.name || 'comprador',
                    orders: ordenes.map(o => ({
                        orderNumber: o.orderNumber,
                        total: o.total,
                        sellerName: o.seller?.businessName || o.seller?.name || 'Vendedor',
                    })),
                    domain: ordenes[0].sourceDomain || undefined,
                });

                // Solo se marca si el envío salió bien, para que un fallo
                // temporal de Resend se reintente en la siguiente corrida.
                if (!res?.success) {
                    console.error('[abandoned-payment] Envío fallido a', comprador.email, res?.error);
                    continue;
                }

                await prisma.order.updateMany({
                    where: { id: { in: ordenes.map(o => o.id) } },
                    data: { paymentReminderSentAt: new Date() },
                });
                enviados++;
            } catch (e) {
                console.error('[abandoned-payment] Error con', comprador.email, e);
            }
        }

        console.log(`[abandoned-payment] Recordatorios enviados: ${enviados}`);
        return NextResponse.json({ ok: true, remindersSent: enviados });
    } catch (error: any) {
        console.error('[abandoned-payment] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
