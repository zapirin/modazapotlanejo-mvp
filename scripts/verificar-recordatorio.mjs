// Utilidad de verificación del recordatorio de pago pendiente.
//
// Corre CONTRA LA BASE REAL, así que `preparar` exige el número de pedido de
// forma explícita: nunca elige uno por su cuenta. Úsalo solo con un pedido de
// prueba que hayas creado tú, jamás con el de un cliente.
//
// Uso:
//   node scripts/verificar-recordatorio.mjs estado
//   node scripts/verificar-recordatorio.mjs preparar <numeroDePedido> <horas>
import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();
const [comando, arg1, arg2] = process.argv.slice(2);

const resumen = (o) =>
    `#${o.orderNumber} ${o.status} creada=${o.createdAt.toISOString()} recordatorio=${o.paymentReminderSentAt?.toISOString() ?? 'null'}`;

if (comando === 'estado') {
    const ordenes = await prisma.order.findMany({
        where: { status: 'PENDING_PAYMENT' },
        select: { id: true, orderNumber: true, status: true, createdAt: true, paymentReminderSentAt: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
    });
    console.log(`Pedidos en PENDING_PAYMENT (${ordenes.length}):`);
    ordenes.forEach(o => console.log('  ' + resumen(o)));

} else if (comando === 'preparar') {
    const numero = Number(arg1);
    const horas = Number(arg2);
    if (!Number.isInteger(numero) || !Number.isFinite(horas)) {
        console.error('Uso: node scripts/verificar-recordatorio.mjs preparar <numeroDePedido> <horas>');
        process.exit(1);
    }

    const orden = await prisma.order.findFirst({
        where: { orderNumber: numero },
        select: { id: true, orderNumber: true, status: true, buyerId: true },
    });
    if (!orden) {
        console.error(`No existe el pedido #${numero}.`);
        process.exit(1);
    }
    if (orden.status !== 'PENDING_PAYMENT') {
        console.error(`El pedido #${numero} está en ${orden.status}, no en PENDING_PAYMENT. Abortado.`);
        process.exit(1);
    }

    const actualizada = await prisma.order.update({
        where: { id: orden.id },
        data: {
            createdAt: new Date(Date.now() - horas * 60 * 60 * 1000),
            paymentReminderSentAt: null,
        },
        select: { id: true, orderNumber: true, status: true, createdAt: true, paymentReminderSentAt: true },
    });
    console.log('Preparado: ' + resumen(actualizada));

} else {
    console.error('Comandos: estado | preparar <numeroDePedido> <horas>');
    process.exit(1);
}

await prisma.$disconnect();
