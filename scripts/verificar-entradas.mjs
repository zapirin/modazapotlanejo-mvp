// Chequeo de consistencia de las entradas de mercancía.
// SOLO LECTURA: no escribe nada. Pensado para correrse EN EL SERVIDOR,
// donde sí hay acceso a la base de datos.
//   node scripts/verificar-entradas.mjs
import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

let fallas = 0;

const entradas = await prisma.stockEntry.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
});

console.log(`Revisando ${entradas.length} entradas…\n`);

for (const e of entradas) {
    const suma = e.items.reduce((s, it) => s + it.quantity, 0);
    if (suma !== e.totalItems) {
        fallas++;
        console.log(`FALLA  E-${String(e.folio).padStart(6, '0')}: totalItems=${e.totalItems} pero los renglones suman ${suma}`);
    }
    if (e.items.some(it => it.quantity <= 0)) {
        fallas++;
        console.log(`FALLA  E-${String(e.folio).padStart(6, '0')}: tiene renglones con cantidad menor o igual a cero`);
    }
}

// Invariante global: el stock total de cada variante debe ser la suma de sus sucursales.
const variantIds = [...new Set(entradas.flatMap(e => e.items.map(it => it.variantId)))];
const variantes = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, stock: true, inventoryLevels: { select: { stock: true } } },
});

for (const v of variantes) {
    const suma = v.inventoryLevels.reduce((s, l) => s + l.stock, 0);
    if (v.stock !== suma) {
        fallas++;
        console.log(`FALLA  Variante ${v.id}: Variant.stock=${v.stock} pero las sucursales suman ${suma}`);
    }
}

console.log(fallas === 0 ? '\nOK: sin inconsistencias.' : `\n${fallas} inconsistencia(s).`);
await prisma.$disconnect();
process.exit(fallas === 0 ? 0 : 1);
