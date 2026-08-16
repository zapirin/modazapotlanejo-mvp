// Corrige los puntos que se otorgaron por pedidos que nunca se pagaron.
// Se corre EN EL SERVIDOR, donde sí hay acceso a la base de datos.
//   node scripts/corregir-puntos-no-pagados.mjs            (solo muestra)
//   node scripts/corregir-puntos-no-pagados.mjs --aplicar  (escribe)
import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');
const SIN_PAGAR = ['PENDING', 'PENDING_PAYMENT'];

const earns = await prisma.loyaltyTransaction.findMany({
    where: { type: 'EARN', orderId: { not: null } },
    select: { id: true, points: true, orderId: true, accountId: true },
});

const ids = [...new Set(earns.map(e => e.orderId))];
const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: { id: true, orderNumber: true, status: true },
});
const porId = new Map(orders.map(o => [o.id, o]));

const aCorregir = earns.filter(e => {
    const o = porId.get(e.orderId);
    return o && SIN_PAGAR.includes(o.status);
});

if (aCorregir.length === 0) {
    console.log('No hay puntos otorgados por pedidos sin pagar. Nada que hacer.');
    await prisma.$disconnect();
    process.exit(0);
}

console.log(`${aCorregir.length} movimiento(s) de puntos por pedidos sin pagar:\n`);
for (const e of aCorregir) {
    const o = porId.get(e.orderId);
    const acc = await prisma.loyaltyAccount.findUnique({
        where: { id: e.accountId },
        select: { balance: true, buyer: { select: { name: true } } },
    });
    console.log(`  pedido ${o.orderNumber} (${o.status})  ${e.points} pts  comprador: ${acc?.buyer?.name || '?'}  saldo actual: ${acc?.balance ?? '?'}`);
}

if (!aplicar) {
    console.log('\nEsto fue solo una vista previa. Para aplicarlo, vuelve a correrlo con --aplicar');
    await prisma.$disconnect();
    process.exit(0);
}

let corregidos = 0;
for (const e of aCorregir) {
    const o = porId.get(e.orderId);
    await prisma.$transaction(async (tx) => {
        const acc = await tx.loyaltyAccount.findUnique({ where: { id: e.accountId } });
        if (!acc) return;
        const quitar = Math.min(acc.balance, e.points);
        if (quitar > 0) {
            await tx.loyaltyAccount.update({
                where: { id: acc.id },
                data: { balance: acc.balance - quitar },
            });
            await tx.loyaltyTransaction.create({
                data: {
                    accountId: acc.id,
                    type: 'ADJUST',
                    points: -quitar,
                    reason: `Corrección: el pedido ${o.orderNumber} nunca se pagó, los puntos no debieron otorgarse.`,
                },
            });
        }
        await tx.loyaltyTransaction.delete({ where: { id: e.id } });
        corregidos++;
    });
}
console.log(`\nListo: ${corregidos} corregido(s).`);
await prisma.$disconnect();
