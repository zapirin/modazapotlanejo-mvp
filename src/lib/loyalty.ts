import { prisma } from "@/lib/prisma";

export type CustomerRef =
    | { buyerId: string; posClientId?: never }
    | { posClientId: string; buyerId?: never };

export function mxnToPoints(amount: number, earnRate: number): number {
    if (earnRate <= 0 || amount <= 0) return 0;
    return Math.floor(amount / earnRate);
}

export function pointsToMXN(points: number, redeemRate: number): number {
    if (redeemRate <= 0 || points <= 0) return 0;
    return Math.floor((points / redeemRate) * 100) / 100;
}

export async function getProgram(sellerId: string) {
    return (prisma as any).loyaltyProgram.findUnique({ where: { sellerId } });
}

export async function upsertProgram(
    sellerId: string,
    data: { isActive: boolean; earnRate: number; redeemRate: number; minRedeemPoints?: number }
) {
    if (data.earnRate <= 0) throw new Error("earnRate debe ser mayor a 0");
    if (data.redeemRate <= 0) throw new Error("redeemRate debe ser mayor a 0");
    const minRedeem = Math.max(0, Math.floor(data.minRedeemPoints ?? 0));
    return (prisma as any).loyaltyProgram.upsert({
        where: { sellerId },
        update: {
            isActive: data.isActive,
            earnRate: data.earnRate,
            redeemRate: data.redeemRate,
            minRedeemPoints: minRedeem,
        },
        create: {
            sellerId,
            isActive: data.isActive,
            earnRate: data.earnRate,
            redeemRate: data.redeemRate,
            minRedeemPoints: minRedeem,
        },
    });
}

export async function getOrCreateAccount(sellerId: string, customer: CustomerRef) {
    const where = customer.buyerId
        ? { sellerId_buyerId: { sellerId, buyerId: customer.buyerId } }
        : { sellerId_posClientId: { sellerId, posClientId: customer.posClientId! } };

    const existing = await (prisma as any).loyaltyAccount.findUnique({ where });
    if (existing) return existing;

    return (prisma as any).loyaltyAccount.create({
        data: {
            sellerId,
            buyerId: customer.buyerId ?? null,
            posClientId: customer.posClientId ?? null,
            balance: 0,
        },
    });
}

export async function getAccountBalance(sellerId: string, customer: CustomerRef): Promise<number> {
    const where = customer.buyerId
        ? { sellerId_buyerId: { sellerId, buyerId: customer.buyerId } }
        : { sellerId_posClientId: { sellerId, posClientId: customer.posClientId! } };
    const acc = await (prisma as any).loyaltyAccount.findUnique({ where });
    return acc?.balance ?? 0;
}

export async function getTransactions(accountId: string, limit = 50) {
    return (prisma as any).loyaltyTransaction.findMany({
        where: { accountId },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}

export async function getCustomerTransactions(
    sellerId: string,
    customer: CustomerRef,
    limit = 50
) {
    const acc = await getOrCreateAccount(sellerId, customer);
    return getTransactions(acc.id, limit);
}

export async function earnPoints(args: {
    sellerId: string;
    customer: CustomerRef;
    amountMXN: number;
    orderId?: string;
    saleId?: string;
}) {
    const program = await getProgram(args.sellerId);
    if (!program || !program.isActive) return { earned: 0, skipped: true as const };

    const points = mxnToPoints(args.amountMXN, program.earnRate);
    if (points <= 0) return { earned: 0, skipped: true as const };

    const account = await getOrCreateAccount(args.sellerId, args.customer);

    return prisma.$transaction(async (tx: any) => {
        const updated = await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: { balance: { increment: points } },
        });
        const txn = await tx.loyaltyTransaction.create({
            data: {
                accountId: account.id,
                type: "EARN",
                points,
                amountMXN: args.amountMXN,
                orderId: args.orderId ?? null,
                saleId: args.saleId ?? null,
            },
        });
        return { earned: points, balance: updated.balance, transactionId: txn.id, skipped: false as const };
    });
}

export async function redeemPoints(args: {
    sellerId: string;
    customer: CustomerRef;
    points: number;
    orderId?: string;
    saleId?: string;
}) {
    const points = Math.floor(args.points);
    if (points <= 0) throw new Error("Puntos a canjear debe ser mayor a 0");

    const program = await getProgram(args.sellerId);
    if (!program || !program.isActive) throw new Error("Programa de puntos no disponible");
    if (points < program.minRedeemPoints) {
        throw new Error(`Mínimo de canje: ${program.minRedeemPoints} puntos`);
    }

    const account = await getOrCreateAccount(args.sellerId, args.customer);
    if (account.balance < points) throw new Error("Saldo insuficiente");

    const discountMXN = pointsToMXN(points, program.redeemRate);

    return prisma.$transaction(async (tx: any) => {
        const updated = await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: { balance: { decrement: points } },
        });
        const txn = await tx.loyaltyTransaction.create({
            data: {
                accountId: account.id,
                type: "REDEEM",
                points: -points,
                orderId: args.orderId ?? null,
                saleId: args.saleId ?? null,
            },
        });
        return {
            redeemed: points,
            discountMXN,
            balance: updated.balance,
            transactionId: txn.id,
        };
    });
}

export async function adjustPoints(args: {
    sellerId: string;
    customer: CustomerRef;
    points: number;
    reason: string;
}) {
    const points = Math.floor(args.points);
    if (points === 0) throw new Error("Ajuste no puede ser 0");
    if (!args.reason?.trim()) throw new Error("Motivo es obligatorio");

    const account = await getOrCreateAccount(args.sellerId, args.customer);
    if (points < 0 && account.balance + points < 0) {
        throw new Error("El ajuste dejaría el saldo en negativo");
    }

    return prisma.$transaction(async (tx: any) => {
        const updated = await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: { balance: { increment: points } },
        });
        const txn = await tx.loyaltyTransaction.create({
            data: {
                accountId: account.id,
                type: "ADJUST",
                points,
                reason: args.reason.trim(),
            },
        });
        return { delta: points, balance: updated.balance, transactionId: txn.id };
    });
}

export async function listSellerAccounts(sellerId: string) {
    return (prisma as any).loyaltyAccount.findMany({
        where: { sellerId, balance: { gt: 0 } },
        include: {
            buyer: { select: { id: true, name: true, email: true } },
            posClient: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { updatedAt: "desc" },
    });
}

// Otorga los puntos de un pedido ya entregado.
// Todo ocurre en una sola transacción que primero toma un candado sobre la fila
// del pedido: así, dos "marcar como entregado" simultáneos se serializan y el
// segundo ya ve el movimiento del primero. Por eso no se reutiliza earnPoints:
// esa función abre su propia transacción y Prisma no permite anidarlas.
export async function earnPointsForDeliveredOrder(order: {
    id: string;
    sellerId: string;
    buyerId: string;
    total: number;
    shippingCost: number;
}) {
    // Los puntos se ganan sobre la mercancía, no sobre el envío.
    const base = (order.total || 0) - (order.shippingCost || 0);
    if (base <= 0) return { earned: 0, skipped: true as const };

    const program = await getProgram(order.sellerId);
    if (!program || !program.isActive) return { earned: 0, skipped: true as const };

    const points = mxnToPoints(base, program.earnRate);
    if (points <= 0) return { earned: 0, skipped: true as const };

    return prisma.$transaction(async (tx: any) => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;

        const yaOtorgado = await tx.loyaltyTransaction.findFirst({
            where: { orderId: order.id, type: "EARN" },
            select: { id: true },
        });
        if (yaOtorgado) return { earned: 0, skipped: true as const };

        const account = await tx.loyaltyAccount.upsert({
            where: { sellerId_buyerId: { sellerId: order.sellerId, buyerId: order.buyerId } },
            update: {},
            create: { sellerId: order.sellerId, buyerId: order.buyerId, balance: 0 },
        });

        const updated = await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: { balance: { increment: points } },
        });
        await tx.loyaltyTransaction.create({
            data: {
                accountId: account.id,
                type: "EARN",
                points,
                amountMXN: base,
                orderId: order.id,
            },
        });
        return { earned: points, balance: updated.balance, skipped: false as const };
    });
}

// Deshace todos los movimientos de puntos ligados a un pedido: quita lo ganado
// y devuelve lo canjeado. Funciona para ambos casos con la misma resta porque
// EARN guarda los puntos en positivo y REDEEM en negativo.
// Idempotente: borra los movimientos, así que repetirla no hace nada.
// Deshace los movimientos de puntos que cumplan el filtro, DENTRO de una
// transacción que ya abrió quien llama. Sirve igual para un pedido en línea
// (`{ orderId }`) que para una venta de mostrador (`{ saleId }`).
//
// Acumula el neto por cuenta y aplica el tope de cero UNA sola vez. Hacerlo
// movimiento por movimiento daría resultados distintos según el orden en que
// vinieran de la base, y con saldos bajos llega a inventar puntos: con saldo 30
// y una venta de EARN +100 / REDEEM −50, un orden deja 50 y el otro 0, cuando lo
// correcto es 0.
//
// La convención de signos hace que una sola resta cubra los dos casos:
// `earnPoints` guarda los puntos en positivo y `redeemPoints` en negativo, así
// que restar el neto quita lo ganado y devuelve lo canjeado.
export async function revertLoyaltyMovements(
    tx: any,
    where: { orderId: string } | { saleId: string }
) {
    const txns = await tx.loyaltyTransaction.findMany({ where });
    if (txns.length === 0) return { reverted: 0 };

    const netoPorCuenta = new Map<string, number>();
    for (const t of txns) {
        netoPorCuenta.set(t.accountId, (netoPorCuenta.get(t.accountId) || 0) + t.points);
    }

    for (const [accountId, neto] of netoPorCuenta) {
        const account = await tx.loyaltyAccount.findUnique({ where: { id: accountId } });
        if (!account) continue;
        await tx.loyaltyAccount.update({
            where: { id: accountId },
            data: { balance: Math.max(0, account.balance - neto) },
        });
    }

    await tx.loyaltyTransaction.deleteMany({ where });
    return { reverted: txns.length };
}

export async function revertOrderLoyalty(orderId: string) {
    return prisma.$transaction(async (tx: any) => {
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
        return revertLoyaltyMovements(tx, { orderId });
    });
}

// Estados en los que un pedido ya se pagó pero todavía no se entrega.
// PENDING y PENDING_PAYMENT quedan fuera a propósito: no hay pago confirmado.
const ESTADOS_PAGADO_SIN_ENTREGAR = ["PAID", "ACCEPTED", "SHIPPED"];

// Puntos que el comprador ganará cuando le entreguen lo que ya pagó.
// NO se guardan en ningún lado: se calculan cada vez que se piden. Esa es la
// razón por la que puede verlos sin poder gastarlos — nunca entran a su saldo.
export async function getPendingPointsByBuyer(buyerId: string) {
    const orders = await (prisma as any).order.findMany({
        where: { buyerId, status: { in: ESTADOS_PAGADO_SIN_ENTREGAR } },
        select: {
            id: true,
            sellerId: true,
            total: true,
            shippingCost: true,
            seller: { select: { id: true, name: true, businessName: true, logoUrl: true, sellerSlug: true } },
        },
    });
    if (orders.length === 0) return [];

    // Los pedidos creados antes de este cambio ya tienen sus puntos otorgados:
    // no deben aparecer como "por confirmar" o prometeríamos algo que no llega.
    const yaOtorgados = await (prisma as any).loyaltyTransaction.findMany({
        where: { orderId: { in: orders.map((o: any) => o.id) }, type: "EARN" },
        select: { orderId: true },
    });
    const conPuntosYa = new Set(yaOtorgados.map((t: any) => t.orderId));

    const sellerIds = [...new Set(orders.map((o: any) => o.sellerId))] as string[];
    const programs = await (prisma as any).loyaltyProgram.findMany({
        where: { sellerId: { in: sellerIds }, isActive: true },
        select: { sellerId: true, earnRate: true },
    });
    const tasaPorVendedor = new Map<string, number>(programs.map((p: any) => [p.sellerId, p.earnRate]));

    const acumulado = new Map<string, { sellerId: string; points: number; seller: any }>();
    for (const o of orders) {
        if (conPuntosYa.has(o.id)) continue;
        const tasa = tasaPorVendedor.get(o.sellerId);
        if (!tasa) continue;
        const pts = mxnToPoints((o.total || 0) - (o.shippingCost || 0), tasa);
        if (pts <= 0) continue;
        const previo = acumulado.get(o.sellerId);
        if (previo) previo.points += pts;
        else acumulado.set(o.sellerId, { sellerId: o.sellerId, points: pts, seller: o.seller });
    }
    return Array.from(acumulado.values());
}
