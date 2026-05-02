"use server";

import { getSessionUser } from "./auth";
import {
    getProgram,
    getAccountBalance,
    pointsToMXN,
    mxnToPoints,
} from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";

export async function getLoyaltyForBuyer(sellerId: string) {
    const user = await getSessionUser();
    if (!user || user.role !== "BUYER") {
        return { program: null, balance: 0 };
    }
    const program = await getProgram(sellerId);
    if (!program || !program.isActive) return { program: null, balance: 0 };
    const balance = await getAccountBalance(sellerId, { buyerId: user.id });
    return { program, balance };
}

export async function getLoyaltyForPosClient(sellerId: string, posClientId: string) {
    const user = await getSessionUser();
    if (!user) return { program: null, balance: 0, eligible: false };
    if (user.role !== "SELLER" && user.role !== "CASHIER" && user.role !== "ADMIN") {
        return { program: null, balance: 0, eligible: false };
    }
    const program = await getProgram(sellerId);
    if (!program || !program.isActive) {
        return { program: null, balance: 0, eligible: false };
    }
    const client = await prisma.client.findUnique({
        where: { id: posClientId },
        select: { id: true, sellerId: true },
    });
    const eligible = !!client && client.sellerId === sellerId;
    if (!eligible) return { program, balance: 0, eligible: false };
    const balance = await getAccountBalance(sellerId, { posClientId });
    return { program, balance, eligible: true };
}

export async function previewLoyalty(sellerId: string, amountMXN: number) {
    const program = await getProgram(sellerId);
    if (!program || !program.isActive) return { earnRate: 0, redeemRate: 0, willEarn: 0 };
    return {
        earnRate: program.earnRate,
        redeemRate: program.redeemRate,
        minRedeemPoints: program.minRedeemPoints,
        willEarn: mxnToPoints(amountMXN, program.earnRate),
    };
}

export async function pointsValueMXN(sellerId: string, points: number) {
    const program = await getProgram(sellerId);
    if (!program || !program.isActive) return 0;
    return pointsToMXN(points, program.redeemRate);
}

export async function getMyLoyalty() {
    const user = await getSessionUser();
    if (!user) return { accounts: [] as any[] };
    const accounts = await (prisma as any).loyaltyAccount.findMany({
        where: { buyerId: user.id },
        include: {
            seller: { select: { id: true, name: true, businessName: true, logoUrl: true, sellerSlug: true } },
            transactions: {
                orderBy: { createdAt: "desc" },
                take: 50,
            },
        },
        orderBy: { updatedAt: "desc" },
    });
    return { accounts };
}

