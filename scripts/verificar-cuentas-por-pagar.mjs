// Chequeo de consistencia de las compras a proveedor y sus abonos.
// SOLO LECTURA: no escribe nada. Pensado para correrse EN EL SERVIDOR,
// donde sí hay acceso a la base de datos.
//   node scripts/verificar-cuentas-por-pagar.mjs
//
// Este script es el sustituto de las pruebas automatizadas, que el proyecto
// no tiene. El dinero de cuentas por pagar vive en tres lugares que deben
// concordar SIEMPRE: PurchaseNote.total, PurchaseNote.paidAmount/balance, y
// la suma de los SupplierPayment activos.
import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

// Medio centavo: el dinero es Float, así que nunca se compara con === 0.
const CENTAVO = 0.005;

let fallas = 0;

function folioText(folio) {
    return `C-${String(folio).padStart(6, '0')}`;
}

function pesos(n) {
    return `$${(n || 0).toFixed(2)}`;
}

const notas = await prisma.purchaseNote.findMany({
    include: {
        items: true,
        payments: true,
    },
    orderBy: { createdAt: 'desc' },
});

console.log(`Revisando ${notas.length} notas de compra…\n`);

// 1) El total de la nota debe ser la suma de sus renglones.
console.log('--- 1) El total cuadra con los renglones ---');
for (const n of notas) {
    const suma = n.items.reduce((s, it) => s + it.lineTotal, 0);
    if (Math.abs(suma - n.total) > CENTAVO) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: total=${pesos(n.total)} pero los renglones suman ${pesos(suma)}`);
    }
}

// 2) paidAmount debe ser la suma de los abonos ACTIVOS.
// Es el invariante central: si esto falla, la deuda que ve el dueño es falsa.
console.log('--- 2) Lo abonado cuadra con los abonos activos ---');
for (const n of notas) {
    if (n.status === 'CANCELLED') continue; // una nota cancelada se pone en 0 a propósito
    const activos = n.payments.filter(p => p.status === 'ACTIVE');
    const suma = activos.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(suma - n.paidAmount) > CENTAVO) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: paidAmount=${pesos(n.paidAmount)} pero los ${activos.length} abonos activos suman ${pesos(suma)}`);
    }
}

// 3) balance = total - paidAmount.
console.log('--- 3) El saldo cuadra con total menos abonado ---');
for (const n of notas) {
    if (n.status === 'CANCELLED') continue;
    const esperado = n.total - n.paidAmount;
    if (Math.abs(esperado - n.balance) > CENTAVO) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: balance=${pesos(n.balance)} pero total-abonado=${pesos(esperado)}`);
    }
}

// 4) Nadie debe de más ni de menos: 0 <= paidAmount <= total, balance >= 0.
console.log('--- 4) Rangos válidos ---');
for (const n of notas) {
    if (n.balance < -CENTAVO) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: saldo negativo (${pesos(n.balance)})`);
    }
    if (n.paidAmount < -CENTAVO) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: abonado negativo (${pesos(n.paidAmount)})`);
    }
    if (n.status !== 'CANCELLED' && n.paidAmount > n.total + CENTAVO) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: abonado ${pesos(n.paidAmount)} es mayor que el total ${pesos(n.total)}`);
    }
}

// 5) Una nota cancelada no debe nada y no puede tener abonos MANUALES activos.
console.log('--- 5) Notas canceladas ---');
for (const n of notas) {
    if (n.status !== 'CANCELLED') continue;
    if (Math.abs(n.balance) > CENTAVO || Math.abs(n.paidAmount) > CENTAVO) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: cancelada pero con saldo=${pesos(n.balance)} abonado=${pesos(n.paidAmount)}`);
    }
    const manualesVivos = n.payments.filter(p => p.status === 'ACTIVE' && p.source === 'MANUAL');
    if (manualesVivos.length > 0) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: cancelada pero tiene ${manualesVivos.length} abono(s) manual(es) activo(s)`);
    }
}

// 6) Una nota saldada debe tener fecha de pago, y una con saldo no debe tenerla.
console.log('--- 6) Coherencia de la fecha de saldado ---');
for (const n of notas) {
    if (n.status === 'CANCELLED') continue;
    const saldada = n.balance <= CENTAVO;
    if (saldada && !n.paidAt) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: saldo en cero pero sin fecha de pago`);
    }
    if (!saldada && n.paidAt) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: todavía debe ${pesos(n.balance)} pero está marcada como pagada`);
    }
}

// 7) Aislamiento por vendedor: el abono, la nota y el proveedor deben ser del
// mismo dueño. Un cruce aquí significa que alguien ve el dinero de otro.
console.log('--- 7) Aislamiento por vendedor ---');
const proveedores = new Map(
    (await prisma.supplier.findMany({ select: { id: true, sellerId: true, name: true } }))
        .map(s => [s.id, s])
);
for (const n of notas) {
    const prov = proveedores.get(n.supplierId);
    if (prov && prov.sellerId !== n.sellerId) {
        fallas++;
        console.log(`FALLA  ${folioText(n.folio)}: la nota es del vendedor ${n.sellerId} pero el proveedor "${prov.name}" es de ${prov.sellerId}`);
    }
    for (const p of n.payments) {
        if (p.sellerId !== n.sellerId) {
            fallas++;
            console.log(`FALLA  ${folioText(n.folio)}: un abono quedó con vendedor ${p.sellerId} y la nota es de ${n.sellerId}`);
        }
        if (p.supplierId !== n.supplierId) {
            fallas++;
            console.log(`FALLA  ${folioText(n.folio)}: un abono quedó con proveedor distinto al de la nota`);
        }
    }
}

console.log('');
if (fallas === 0) {
    console.log('TODO CORRECTO: las cuentas por pagar cuadran.');
} else {
    console.log(`${fallas} FALLA(S) ENCONTRADA(S).`);
}

await prisma.$disconnect();
process.exit(fallas === 0 ? 0 : 1);
