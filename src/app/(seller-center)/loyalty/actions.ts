"use server";

import { getSessionUser } from "@/app/actions/auth";
import {
    getProgram as libGetProgram,
    upsertProgram as libUpsertProgram,
    listSellerAccounts,
    adjustPoints as libAdjustPoints,
    getCustomerTransactions,
} from "@/lib/loyalty";
import { revalidatePath } from "next/cache";

async function requireSeller() {
    const user = await getSessionUser();
    if (!user) throw new Error("No autenticado");
    if (user.role !== "SELLER" && user.role !== "ADMIN") {
        throw new Error("No autorizado");
    }
    return user;
}

export async function getLoyaltyData() {
    const user = await requireSeller();
    const sellerId = user.id;
    const [program, accounts] = await Promise.all([
        libGetProgram(sellerId),
        listSellerAccounts(sellerId),
    ]);
    return { program, accounts };
}

export async function saveProgram(data: {
    isActive: boolean;
    earnRate: number;
    redeemRate: number;
    minRedeemPoints: number;
}) {
    const user = await requireSeller();
    try {
        const program = await libUpsertProgram(user.id, data);
        revalidatePath("/loyalty");
        return { success: true as const, program };
    } catch (e: any) {
        return { success: false as const, error: e?.message ?? "Error al guardar" };
    }
}

export async function adjustCustomerPoints(args: {
    buyerId?: string | null;
    posClientId?: string | null;
    points: number;
    reason: string;
}) {
    const user = await requireSeller();
    if (!args.buyerId && !args.posClientId) {
        return { success: false as const, error: "Cliente requerido" };
    }
    try {
        const customer: any = args.buyerId
            ? { buyerId: args.buyerId }
            : { posClientId: args.posClientId! };
        const result = await libAdjustPoints({
            sellerId: user.id,
            customer,
            points: args.points,
            reason: args.reason,
        });
        revalidatePath("/loyalty");
        return { success: true as const, ...result };
    } catch (e: any) {
        return { success: false as const, error: e?.message ?? "Error al ajustar" };
    }
}

export async function getCustomerHistory(args: {
    buyerId?: string | null;
    posClientId?: string | null;
}) {
    const user = await requireSeller();
    if (!args.buyerId && !args.posClientId) return [];
    const customer: any = args.buyerId
        ? { buyerId: args.buyerId }
        : { posClientId: args.posClientId! };
    return getCustomerTransactions(user.id, customer, 100);
}
