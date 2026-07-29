"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from '@/app/actions/auth';

async function getEffectiveSellerId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.role === 'CASHIER') {
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true }
        });
        return cashier?.managedBySellerId || null;
    }
    return user.id;
}

export async function getTags() {
    try {
        const user = await getSessionUser();
        const sellerId = await getEffectiveSellerId(user);
        return await prisma.tag.findMany({
            where: { sellerId },
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });
    } catch (error) {
        console.error("Error fetching tags:", error);
        return [];
    }
}

export async function createTag(name: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado" };
        const sellerId = await getEffectiveSellerId(user);
        if (!sellerId) return { success: false, error: "No autorizado" };
        if (!name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const formattedName = name.trim().toLowerCase().replace(/\s+/g, '-');

        const existing = await prisma.tag.findFirst({
            where: { name: formattedName, sellerId }
        });

        if (existing) return { success: false, error: "Ya existe una etiqueta con este nombre" };

        const tag = await prisma.tag.create({
            data: {
                name: formattedName,
                sellerId
            }
        });

        revalidatePath("/inventory/tags");
        return { success: true, tag };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: "Ya existe una etiqueta con este nombre" };
        return { success: false, error: error.message };
    }
}

export async function updateTag(id: string, name: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado" };
        const sellerId = await getEffectiveSellerId(user);
        if (!sellerId) return { success: false, error: "No autorizado" };
        if (!name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const formattedName = name.trim().toLowerCase().replace(/\s+/g, '-');

        const existing = await prisma.tag.findFirst({
            where: { 
                name: formattedName, 
                sellerId,
                id: { not: id } 
            }
        });

        if (existing) return { success: false, error: "Ya existe otra etiqueta con este nombre" };

        // Verificar ownership del tag antes de actualizar
        const tag = await prisma.tag.findFirst({ where: { id, sellerId } });
        if (!tag) return { success: false, error: "No autorizado" };

        await prisma.tag.update({
            where: { id },
            data: { name: formattedName }
        });

        revalidatePath("/inventory/tags");
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, error: "Ya existe una etiqueta con este nombre" };
        return { success: false, error: error.message };
    }
}

export async function deleteTag(id: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado" };
        const sellerId = await getEffectiveSellerId(user);
        if (!sellerId) return { success: false, error: "No autorizado" };

        // Verificar ownership del tag antes de borrar
        const tag = await prisma.tag.findFirst({ where: { id, sellerId } });
        if (!tag) return { success: false, error: "No autorizado" };

        await prisma.tag.delete({
            where: { id }
        });
        revalidatePath("/inventory/tags");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
