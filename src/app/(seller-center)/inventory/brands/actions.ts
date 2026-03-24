"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/app/actions/auth";

export async function getBrands() {
    try {
        const brands = await prisma.brand.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { products: { where: { isActive: true } } }
                }
            }
        });
        return brands;
    } catch (error) {
        console.error("Error fetching brands:", error);
        return [];
    }
}

export async function createBrand(data: { name: string }) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') {
            return { success: false, error: "No tiene permisos para crear marcas" };
        }

        if (!data.name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const existing = await prisma.brand.findFirst({
            where: { name: { equals: data.name.trim(), mode: 'insensitive' } }
        });

        if (existing) return { success: false, error: "Ya existe una marca con este nombre" };

        await prisma.brand.create({
            data: {
                name: data.name.trim()
            }
        });

        revalidatePath("/inventory/brands");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateBrand(id: string, data: { name: string }) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') {
            return { success: false, error: "No tiene permisos para modificar marcas" };
        }

        if (!data.name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const existing = await prisma.brand.findFirst({
            where: { 
                name: { equals: data.name.trim(), mode: 'insensitive' },
                id: { not: id } 
            }
        });

        if (existing) return { success: false, error: "Ya existe otra marca con este nombre" };

        await prisma.brand.update({
            where: { id },
            data: {
                name: data.name.trim()
            }
        });

        revalidatePath("/inventory/brands");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteBrand(id: string) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') {
            return { success: false, error: "No tiene permisos para eliminar marcas" };
        }

        await prisma.brand.delete({
            where: { id }
        });

        revalidatePath("/inventory/brands");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
