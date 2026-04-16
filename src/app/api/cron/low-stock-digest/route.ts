import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendLowInventoryAlert } from '@/lib/email/templates';

const LOW_STOCK_THRESHOLD = 1; // Enviar alerta si stock <= este número

export async function GET(req: NextRequest) {
    // Verificar secret para proteger el endpoint
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Obtener todos los vendedores activos con correo
        const sellers = await (prisma.user as any).findMany({
            where: { role: 'SELLER', isActive: true, email: { not: null } },
            select: { id: true, email: true, name: true }
        });

        let totalSent = 0;

        for (const seller of sellers) {
            // Buscar variantes con stock bajo para este vendedor
            const lowVariants = await (prisma.variant as any).findMany({
                where: {
                    stock: { lte: LOW_STOCK_THRESHOLD },
                    product: {
                        sellerId: seller.id,
                        isActive: true
                    }
                },
                include: {
                    product: { select: { name: true } },
                    inventoryLevels: {
                        include: { location: { select: { name: true } } }
                    }
                }
            });

            if (lowVariants.length === 0) continue;

            // Construir lista de items para el correo
            const items = lowVariants.map((v: any) => {
                const variantName = [v.color, v.size].filter(Boolean).join(' / ') ||
                    (v.attributes && typeof v.attributes === 'object'
                        ? Object.values(v.attributes as Record<string, string>).join(' / ')
                        : '');

                // Si tiene múltiples sucursales, incluir el nombre de la sucursal con menor stock
                const locationName = v.inventoryLevels?.length > 0
                    ? v.inventoryLevels.map((il: any) => `${il.location.name}: ${il.stock} pz`).join(', ')
                    : undefined;

                return {
                    productName: v.product.name,
                    variantName,
                    stock: v.stock,
                    locationName
                };
            });

            // Ordenar: agotados primero, luego por stock ascendente
            items.sort((a: any, b: any) => a.stock - b.stock);

            await sendLowInventoryAlert({
                sellerEmail: seller.email,
                sellerName: seller.name || 'Vendedor',
                items
            });

            totalSent++;
        }

        console.log(`[low-stock-digest] Enviado a ${totalSent} vendedores`);
        return NextResponse.json({ ok: true, sellersSent: totalSent });
    } catch (error: any) {
        console.error('[low-stock-digest] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
