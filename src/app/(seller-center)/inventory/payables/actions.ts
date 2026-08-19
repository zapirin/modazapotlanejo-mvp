"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { round2, CENTAVO } from "@/lib/money";
import { getSessionUser } from "@/app/actions/auth";

// Mismo prefijo que usa `purchases/actions.ts`: distingue el error de negocio
// (mensaje seguro para el usuario) del error interno de Prisma.
const ERROR_USUARIO = 'ERR_USR: ';

// Techo del abono: arriba de esto es un dedazo, no un pago.
const MAX_ABONO = 1000000;

function folioText(folio: number): string {
    return `C-${String(folio).padStart(6, '0')}`;
}

// Cuentas por Pagar es dinero que sale de la tienda, no captura de mercancía:
// aquí no entra el cajero aunque tenga el permiso de registrar compras. Ese
// permiso deja crear la deuda, no pagarla ni cancelar pagos.
async function resolvePayablesAccess(): Promise<any> {
    const user: any = await getSessionUser();
    if (!user) return { error: 'No autorizado.' };
    if (user.role !== 'SELLER') {
        return { error: 'Solo el dueño de la tienda puede ver y registrar pagos a proveedores.' };
    }
    return { user, sellerId: user.id };
}

// El día del calendario en México, como número de días, sin la hora. El
// servidor corre en UTC y México va 6 horas atrás: de las 6 de la tarde a la
// medianoche, `new Date()` ya cae en el día siguiente allá. Sin esto, cada
// noche las notas que vencen hoy aparecerían como vencidas desde ayer.
// Misma convención que usa el panel de control.
function diaEnMexico(d: Date): number {
    // 'en-CA' entrega la fecha como AAAA-MM-DD.
    const [y, m, dia] = d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
        .split('-').map(Number);
    return Date.UTC(y, m - 1, dia) / 86400000;
}

// Días de atraso de una nota respecto a HOY, contados por día de calendario:
// una nota que vence hoy tiene 0 días de atraso hasta mañana.
function diasVencida(dueDate: Date | null): number {
    if (!dueDate) return 0;
    const dias = diaEnMexico(new Date()) - diaEnMexico(dueDate);
    return dias > 0 ? dias : 0;
}

// Las cinco cajas de antigüedad que se copiaron de PHPPOS, más el desborde.
// Una nota sin fecha de vencimiento cuenta como corriente: no se le puede
// reclamar atraso a algo que nunca tuvo plazo.
const CAJAS = [
    { key: 'corriente', label: 'Corriente', min: 0, max: 0 },
    { key: 'd30', label: '1 – 30 días', min: 1, max: 30 },
    { key: 'd60', label: '31 – 60 días', min: 31, max: 60 },
    { key: 'd90', label: '61 – 90 días', min: 61, max: 90 },
    { key: 'd120', label: '91 – 120 días', min: 91, max: 120 },
    { key: 'mas120', label: 'Más de 120 días', min: 121, max: Infinity },
];

function cajaDe(dias: number): string {
    const caja = CAJAS.find(c => dias >= c.min && dias <= c.max);
    return caja ? caja.key : 'corriente';
}

// Vista principal: cuánto se debe en total, repartido por antigüedad, y el
// desglose por proveedor. Todo se calcula sobre notas ACTIVAS con saldo — una
// nota cancelada tiene saldo 0 y no debe nada.
export async function getPayablesSummary() {
    try {
        const access: any = await resolvePayablesAccess();
        if (access.error) return { success: false, error: access.error, buckets: [], suppliers: [], totalDeuda: 0, totalNotas: 0 };

        const notes: any[] = await (prisma as any).purchaseNote.findMany({
            where: {
                sellerId: access.sellerId,
                status: 'ACTIVE',
                balance: { gt: CENTAVO },
            },
            select: {
                id: true, folio: true, supplierId: true, supplierName: true,
                noteDate: true, dueDate: true, total: true, paidAmount: true, balance: true,
            },
        });

        const bucketTotals: Record<string, { monto: number; notas: number }> = {};
        for (const c of CAJAS) bucketTotals[c.key] = { monto: 0, notas: 0 };

        const porProveedor = new Map<string, {
            supplierId: string; supplierName: string;
            saldo: number; notas: number; vencido: number; masVieja: number;
        }>();

        for (const n of notes) {
            const dias = diasVencida(n.dueDate);
            const caja = cajaDe(dias);
            bucketTotals[caja].monto = round2(bucketTotals[caja].monto + n.balance);
            bucketTotals[caja].notas += 1;

            const prev = porProveedor.get(n.supplierId) || {
                supplierId: n.supplierId,
                supplierName: n.supplierName,
                saldo: 0, notas: 0, vencido: 0, masVieja: 0,
            };
            prev.saldo = round2(prev.saldo + n.balance);
            prev.notas += 1;
            if (dias > 0) prev.vencido = round2(prev.vencido + n.balance);
            if (dias > prev.masVieja) prev.masVieja = dias;
            porProveedor.set(n.supplierId, prev);
        }

        const totalDeuda = round2(notes.reduce((s, n) => s + n.balance, 0));

        return {
            success: true,
            totalDeuda,
            totalNotas: notes.length,
            buckets: CAJAS.map(c => ({
                key: c.key,
                label: c.label,
                monto: bucketTotals[c.key].monto,
                notas: bucketTotals[c.key].notas,
            })),
            // El que más debe primero: es a quien hay que pagarle o llamarle.
            suppliers: Array.from(porProveedor.values()).sort((a, b) => b.saldo - a.saldo),
        };
    } catch (error: any) {
        console.error('Error al cargar cuentas por pagar:', error);
        return { success: false, error: 'No se pudieron cargar las cuentas por pagar.', buckets: [], suppliers: [], totalDeuda: 0, totalNotas: 0 };
    }
}

// Detalle de un proveedor: sus notas con saldo, de la más vencida a la más
// nueva, para decidir cuál pagar primero.
export async function getSupplierPayables(supplierId: string) {
    try {
        const access: any = await resolvePayablesAccess();
        if (access.error) return { success: false, error: access.error, rows: [], supplierName: '' };
        // Un id vacío borraría la condición del WHERE y traería las notas de
        // todos los proveedores mezcladas.
        if (!supplierId) return { success: false, error: 'Proveedor no encontrado.', rows: [], supplierName: '' };

        const supplier: any = await (prisma as any).supplier.findFirst({
            where: { id: supplierId, sellerId: access.sellerId },
            select: { id: true, name: true },
        });
        if (!supplier) return { success: false, error: 'Proveedor no encontrado.', rows: [], supplierName: '' };

        const notes: any[] = await (prisma as any).purchaseNote.findMany({
            where: {
                sellerId: access.sellerId,
                supplierId,
                status: 'ACTIVE',
                balance: { gt: CENTAVO },
            },
            orderBy: [{ dueDate: 'asc' }, { folio: 'asc' }],
            include: {
                payments: {
                    where: { status: 'ACTIVE' },
                    include: { paymentMethod: { select: { name: true } } },
                    orderBy: { paidAt: 'asc' },
                },
            },
        });

        return {
            success: true,
            supplierName: supplier.name,
            rows: notes.map((n: any) => ({
                id: n.id,
                folio: folioText(n.folio),
                noteDate: n.noteDate,
                invoiceNumber: n.invoiceNumber,
                dueDate: n.dueDate,
                diasVencida: diasVencida(n.dueDate),
                total: n.total,
                paidAmount: n.paidAmount,
                balance: n.balance,
                payments: n.payments.map((p: any) => ({
                    id: p.id,
                    amount: p.amount,
                    paidAt: p.paidAt,
                    paymentMethodName: p.paymentMethod?.name || null,
                    source: p.source,
                    notes: p.notes,
                })),
            })),
        };
    } catch (error: any) {
        console.error('Error al cargar las notas del proveedor:', error);
        return { success: false, error: 'No se pudieron cargar las notas del proveedor.', rows: [], supplierName: '' };
    }
}

// Métodos de pago para el formulario de abono. Los globales (sellerId null,
// el Efectivo universal) también se ofrecen, igual que en la captura de compra.
export async function getPaymentMethodsForPayables() {
    const access: any = await resolvePayablesAccess();
    if (access.error) return [];
    return prisma.paymentMethod.findMany({
        where: { isActive: true, OR: [{ sellerId: access.sellerId }, { sellerId: null }] },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
}

export async function addSupplierPayment(input: {
    purchaseNoteId: string;
    amount: number;
    paidAt?: string;
    paymentMethodId?: string;
    notes?: string;
}) {
    try {
        const access: any = await resolvePayablesAccess();
        if (access.error) return { success: false, error: access.error };
        if (!input.purchaseNoteId) return { success: false, error: 'Nota no encontrada.' };

        const amount = round2(Number(input.amount));
        if (!isFinite(amount) || amount <= 0) {
            return { success: false, error: 'El abono debe ser mayor a cero.' };
        }
        if (amount > MAX_ABONO) {
            return { success: false, error: 'El abono excede el máximo permitido.' };
        }

        // La fecha del abono se captura (puede ser de ayer), pero nunca del
        // futuro: un pago que "ya se hizo" no puede tener fecha por venir.
        let paidAt = new Date();
        if (input.paidAt) {
            const [y, m, d] = input.paidAt.split('-').map(Number);
            if (!y || !m || !d) return { success: false, error: 'La fecha del abono no es válida.' };
            const capturada = new Date(y, m - 1, d, 12, 0, 0, 0);
            const hoy = new Date();
            if (capturada.getTime() > hoy.getTime()) {
                return { success: false, error: 'La fecha del abono no puede ser futura.' };
            }
            paidAt = capturada;
        }

        // Un método de pago de otro vendedor no se acepta: se valida antes de
        // guardarlo, no se confía en lo que mande el navegador.
        if (input.paymentMethodId) {
            const metodo = await prisma.paymentMethod.findFirst({
                where: {
                    id: input.paymentMethodId, isActive: true,
                    OR: [{ sellerId: access.sellerId }, { sellerId: null }],
                },
                select: { id: true },
            });
            if (!metodo) return { success: false, error: 'El método de pago no es válido.' };
        }

        await prisma.$transaction(async (tx) => {
            // Candado atómico: la condición del saldo va DENTRO del WHERE, no
            // en un `if` de JavaScript. Dos abonos simultáneos de $600 contra
            // un saldo de $1000 leerían ambos 1000 y pasarían ambos; así,
            // Postgres reevalúa el saldo ya actualizado y el segundo devuelve
            // count 0.
            const claimed = await (tx as any).purchaseNote.updateMany({
                where: {
                    id: input.purchaseNoteId,
                    sellerId: access.sellerId,
                    status: 'ACTIVE',
                    balance: { gte: amount - CENTAVO },
                },
                data: {
                    paidAmount: { increment: amount },
                    balance: { decrement: amount },
                },
            });
            if (claimed.count !== 1) {
                const actual: any = await (tx as any).purchaseNote.findFirst({
                    where: { id: input.purchaseNoteId, sellerId: access.sellerId },
                    select: { status: true, balance: true },
                });
                if (!actual) throw new Error(ERROR_USUARIO + 'Esa nota de compra no existe.');
                if (actual.status === 'CANCELLED') throw new Error(ERROR_USUARIO + 'Esta nota está cancelada: ya no debe nada.');
                throw new Error(ERROR_USUARIO + `El abono excede el saldo pendiente, que es de $${actual.balance.toFixed(2)}.`);
            }

            const note: any = await (tx as any).purchaseNote.findFirst({
                where: { id: input.purchaseNoteId, sellerId: access.sellerId },
                select: { id: true, supplierId: true },
            });
            if (!note) throw new Error(ERROR_USUARIO + 'Nota no encontrada.');

            await (tx as any).supplierPayment.create({
                data: {
                    sellerId: access.sellerId,
                    supplierId: note.supplierId,
                    purchaseNoteId: note.id,
                    amount,
                    paidAt,
                    paymentMethodId: input.paymentMethodId || null,
                    source: 'MANUAL',
                    notes: input.notes?.trim() || null,
                    userId: access.user.id,
                },
            });

            // Cierra el residuo de coma flotante: 1000 − 333.33 − 333.33 − 333.34
            // no da cero exacto, y sin esto la nota nunca quedaría marcada como
            // pagada. La condición va en el WHERE para no pisar un saldo real.
            await (tx as any).purchaseNote.updateMany({
                where: { id: note.id, sellerId: access.sellerId, balance: { lte: CENTAVO } },
                data: { balance: 0, paidAt: new Date() },
            });
        });

        revalidatePath('/inventory/payables');
        revalidatePath('/inventory/purchases');
        return { success: true };
    } catch (error: any) {
        console.error('Error al registrar el abono:', error);
        const msg = String(error?.message || '');
        return { success: false, error: msg.startsWith(ERROR_USUARIO) ? msg.slice(ERROR_USUARIO.length) : 'No se pudo registrar el abono.' };
    }
}

export async function cancelSupplierPayment(paymentId: string) {
    try {
        const access: any = await resolvePayablesAccess();
        if (access.error) return { success: false, error: access.error };
        if (!paymentId) return { success: false, error: 'Abono no encontrado.' };

        await prisma.$transaction(async (tx) => {
            // Candado atómico sobre el abono: solo una cancelación gana. Sin
            // esto, dos clics seguidos devolverían el saldo dos veces.
            const claimed = await (tx as any).supplierPayment.updateMany({
                where: { id: paymentId, sellerId: access.sellerId, status: 'ACTIVE' },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancelledByName: access.user.name || null,
                },
            });
            if (claimed.count !== 1) {
                throw new Error(ERROR_USUARIO + 'Ese abono no existe o ya estaba cancelado.');
            }

            const pago: any = await (tx as any).supplierPayment.findFirst({
                where: { id: paymentId, sellerId: access.sellerId },
                select: { amount: true, purchaseNoteId: true },
            });
            if (!pago) throw new Error(ERROR_USUARIO + 'Abono no encontrado.');

            // La deuda vuelve a subir. Solo sobre notas ACTIVAS: una nota
            // cancelada tiene saldo 0 a propósito y devolverle el abono la
            // dejaría debiendo dinero que ya no debe.
            const devuelto = await (tx as any).purchaseNote.updateMany({
                where: { id: pago.purchaseNoteId, sellerId: access.sellerId, status: 'ACTIVE' },
                data: {
                    paidAmount: { decrement: pago.amount },
                    balance: { increment: pago.amount },
                    // Si estaba saldada, deja de estarlo.
                    paidAt: null,
                },
            });
            if (devuelto.count !== 1) {
                throw new Error(ERROR_USUARIO + 'La nota de esta compra está cancelada: no se puede cancelar su abono.');
            }
        });

        revalidatePath('/inventory/payables');
        revalidatePath('/inventory/purchases');
        return { success: true };
    } catch (error: any) {
        console.error('Error al cancelar el abono:', error);
        const msg = String(error?.message || '');
        return { success: false, error: msg.startsWith(ERROR_USUARIO) ? msg.slice(ERROR_USUARIO.length) : 'No se pudo cancelar el abono.' };
    }
}
