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
