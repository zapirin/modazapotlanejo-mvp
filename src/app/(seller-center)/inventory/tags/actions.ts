"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from '@/app/actions/auth';

export async function getTags() {
    try {
        const user = await getSessionUser();
        return await prisma.tag.findMany({
            where: { sellerId: user?.id || null },
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
        if (!name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const formattedName = name.trim().toLowerCase();

        const existing = await prisma.tag.findFirst({
            where: { name: formattedName, sellerId: user?.id || null }
        });

        if (existing) return { success: false, error: "Ya existe una etiqueta con este nombre" };

        const tag = await prisma.tag.create({
            data: {
                name: formattedName,
                sellerId: user?.id || null
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
        if (!name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const formattedName = name.trim().toLowerCase();

        const existing = await prisma.tag.findFirst({
            where: { 
                name: formattedName, 
                sellerId: user?.id || null,
                id: { not: id } 
            }
        });

        if (existing) return { success: false, error: "Ya existe otra etiqueta con este nombre" };

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
        await prisma.tag.delete({
            where: { id }
        });
        revalidatePath("/inventory/tags");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
