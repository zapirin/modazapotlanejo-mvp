"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "./auth";
import { revalidatePath } from "next/cache";

export async function getMyPeripherals() {
    const user = await getSessionUser();
    if (!user) return [];
    return await (prisma as any).posPeripheral.findMany({
        where: { sellerId: user.id, isActive: true },
        orderBy: { createdAt: 'asc' },
    });
}

export async function savePeripheral(data: {
    id?: string;
    type: string;
    name: string;
    config: Record<string, any>;
}) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: 'No autenticado' };

        if (data.id) {
            await (prisma as any).posPeripheral.update({
                where: { id: data.id },
                data: { name: data.name, config: data.config },
            });
        } else {
            await (prisma as any).posPeripheral.create({
                data: { sellerId: user.id, type: data.type, name: data.name, config: data.config },
            });
        }
        revalidatePath('/pos');
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function deletePeripheral(id: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false };
        await (prisma as any).posPeripheral.update({
            where: { id, sellerId: user.id },
            data: { isActive: false },
        });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}
