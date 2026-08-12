// Chequeo de consistencia de las entradas de mercancía.
// SOLO LECTURA: no escribe nada. Pensado para correrse EN EL SERVIDOR,
// donde sí hay acceso a la base de datos.
//   node scripts/verificar-entradas.mjs
import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

let fallas = 0;

function folioText(folio) {
    return `E-${String(folio).padStart(6, '0')}`;
}

const entradas = await prisma.stockEntry.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
});

console.log(`Revisando ${entradas.length} entradas…\n`);

// 1) Coherencia de cada entrada: los renglones deben sumar totalItems
// y ningún renglón puede tener cantidad <= 0.
console.log('--- 1) Coherencia de renglones ---');
for (const e of entradas) {
    const suma = e.items.reduce((s, it) => s + it.quantity, 0);
    if (suma !== e.totalItems) {
        fallas++;
        console.log(`FALLA  ${folioText(e.folio)}: totalItems=${e.totalItems} pero los renglones suman ${suma}`);
    }
    if (e.items.some(it => it.quantity <= 0)) {
        fallas++;
        console.log(`FALLA  ${folioText(e.folio)}: tiene renglones con cantidad menor o igual a cero`);
    }
}
console.log('Listo.\n');

// 2) Doble reverso de cancelaciones: por cada entrada cancelada debe existir
// exactamente un movimiento de ajuste de cancelación por renglón. Si hay más,
// el stock se restó de más (el defecto de la doble cancelación).
console.log('--- 2) Doble reverso de cancelaciones ---');
const canceladas = entradas.filter(e => e.status === 'CANCELLED');
for (const e of canceladas) {
    const marcador = `Cancelación de entrada ${folioText(e.folio)}.`;
    const movimientos = await prisma.inventoryMovement.count({
        where: {
            type: 'ADJUSTMENT',
            reason: { contains: marcador },
        },
    });
    const esperados = e.items.length;
    if (movimientos !== esperados) {
        fallas++;
        console.log(`FALLA  ${folioText(e.folio)}: se esperaban ${esperados} movimiento(s) de reverso y hay ${movimientos}`);
    }
}
console.log('Listo.\n');

// 3) Deriva histórica (informativo, NO cuenta como falla): Variant.stock debería
// ser la suma de sus InventoryLevel por sucursal. Este invariante NO lo garantiza
// el código preexistente (p. ej. "Ajustar Stock" en Inventario incrementa
// Variant.stock sin tocar InventoryLevel), así que aquí puede haber diferencias
// que no tienen nada que ver con el registro de entradas.
console.log('--- 3) Deriva histórica Variant.stock vs. InventoryLevel (informativo, no es falla) ---');
const variantIds = [...new Set(entradas.flatMap(e => e.items.map(it => it.variantId)))];
const variantes = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, stock: true, inventoryLevels: { select: { stock: true } } },
});

let deriva = 0;
for (const v of variantes) {
    const suma = v.inventoryLevels.reduce((s, l) => s + l.stock, 0);
    if (v.stock !== suma) {
        deriva++;
        console.log(`INFO   Variante ${v.id}: Variant.stock=${v.stock} pero las sucursales suman ${suma} (puede venir de ajustes manuales anteriores a este módulo, no lo causa el registro de entradas)`);
    }
}
console.log(`Listo (${deriva} con deriva).\n`);

console.log(fallas === 0 ? 'OK: sin fallas.' : `${fallas} falla(s).`);
await prisma.$disconnect();
process.exit(fallas === 0 ? 0 : 1);
