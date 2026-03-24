"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/app/actions/auth";

async function getEffectiveSellerId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.role === "CASHIER") {
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true },
        });
        return cashier?.managedBySellerId || null;
    }
    return user.id;
}

export async function getDenominations() {
    const user = await getSessionUser();
    const sellerId = await getEffectiveSellerId(user);
    if (!sellerId) return [];

    const dens = await (prisma as any).currencyDenomination.findMany({
        where: { sellerId },
        orderBy: { sortOrder: "asc" },
    });
    return dens;
}

export async function createDenomination(label: string, value: number) {
    const user = await getSessionUser();
    const sellerId = await getEffectiveSellerId(user);
    if (!sellerId) return { success: false, error: "No autorizado" };

    try {
        const count = await (prisma as any).currencyDenomination.count({ where: { sellerId } });
        const den = await (prisma as any).currencyDenomination.create({
            data: { label, value, sellerId, sortOrder: count },
        });
        revalidatePath("/settings/denominations");
        return { success: true, denomination: den };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateDenomination(id: string, label: string, value: number) {
    const user = await getSessionUser();
    const sellerId = await getEffectiveSellerId(user);
    if (!sellerId) return { success: false, error: "No autorizado" };

    try {
        await (prisma as any).currencyDenomination.update({
            where: { id, sellerId },
            data: { label, value },
        });
        revalidatePath("/settings/denominations");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteDenomination(id: string) {
    const user = await getSessionUser();
    const sellerId = await getEffectiveSellerId(user);
    if (!sellerId) return { success: false, error: "No autorizado" };

    try {
        await (prisma as any).currencyDenomination.delete({ where: { id, sellerId } });
        revalidatePath("/settings/denominations");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function reorderDenominations(ids: string[]) {
    const user = await getSessionUser();
    const sellerId = await getEffectiveSellerId(user);
    if (!sellerId) return { success: false };

    try {
        await Promise.all(
            ids.map((id, i) =>
                (prisma as any).currencyDenomination.update({
                    where: { id, sellerId },
                    data: { sortOrder: i },
                })
            )
        );
        revalidatePath("/settings/denominations");
        return { success: true };
    } catch {
        return { success: false };
    }
}

// Seed denominaciones MXN por defecto para nuevos vendedores
export async function seedDefaultDenominations() {
    const user = await getSessionUser();
    const sellerId = await getEffectiveSellerId(user);
    if (!sellerId) return { success: false };

    const existing = await (prisma as any).currencyDenomination.count({ where: { sellerId } });
    if (existing > 0) return { success: true, message: "Ya tienes denominaciones" };

    const defaults = [
        { label: "$1,000", value: 1000 },
        { label: "$500",   value: 500  },
        { label: "$200",   value: 200  },
        { label: "$100",   value: 100  },
        { label: "$50",    value: 50   },
        { label: "$20",    value: 20   },
        { label: "$10",    value: 10   },
        { label: "$5",     value: 5    },
        { label: "$2",     value: 2    },
        { label: "$1",     value: 1    },
        { label: "¢50",    value: 0.50 },
    ];

    await (prisma as any).currencyDenomination.createMany({
        data: defaults.map((d, i) => ({ ...d, sellerId, sortOrder: i })),
        skipDuplicates: true,
    });
    revalidatePath("/settings/denominations");
    return { success: true };
}
