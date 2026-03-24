"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/app/actions/auth";

export async function getCategories() {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' },
            include: {
                subcategories: {
                    include: {
                        _count: {
                            select: { products: { where: { isActive: true } } }
                        }
                    },
                    orderBy: { name: 'asc' }
                },
                _count: {
                    select: { products: { where: { isActive: true } } }
                }
            }
        });
        return categories;
    } catch (error) {
        console.error("Error fetching categories:", error);
        return [];
    }
}

export async function createCategory(data: { name: string }) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') return { success: false, error: "No tienes permisos para realizar esta acción" };

        if (!data.name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const tempSlug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        
        const existing = await prisma.category.findFirst({
            where: { 
                OR: [
                    { name: { equals: data.name.trim(), mode: 'insensitive' } },
                    { slug: tempSlug }
                ]
            }
        });

        if (existing) return { success: false, error: "Ya existe una categoría con ese nombre o identificador similar" };

        await prisma.category.create({
            data: {
                name: data.name.trim(),
                slug: tempSlug
            }
        });

        revalidatePath("/inventory/categories");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    } 
}

export async function updateCategory(id: string, data: { name: string }) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') return { success: false, error: "No tienes permisos para realizar esta acción" };

        if (!data.name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const tempSlug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        const existing = await prisma.category.findFirst({
            where: { 
                OR: [
                    { name: { equals: data.name.trim(), mode: 'insensitive' } },
                    { slug: tempSlug }
                ],
                id: { not: id } 
            }
        });

        if (existing) return { success: false, error: "Ya existe otra categoría con este nombre o identificador similar" };

        await prisma.category.update({
            where: { id },
            data: {
                name: data.name.trim(),
                slug: tempSlug
            }
        });

        revalidatePath("/inventory/categories");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    } 
}

export async function deleteCategory(id: string) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') return { success: false, error: "No tienes permisos para realizar esta acción" };

        await prisma.category.delete({
            where: { id }
        });

        revalidatePath("/inventory/categories");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createSubcategory(data: { name: string, categoryId: string }) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') return { success: false, error: "No tienes permisos" };

        if (!data.name.trim() || !data.categoryId) return { success: false, error: "Datos incompletos" };

        const tempSlug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        
        const existing = await prisma.subcategory.findFirst({
            where: { 
                OR: [
                    { name: { equals: data.name.trim(), mode: 'insensitive' } },
                    { slug: tempSlug }
                ],
                categoryId: data.categoryId
            }
        });

        if (existing) return { success: false, error: "Ya existe esta subcategoría con este nombre en esta categoría" };

        await prisma.subcategory.create({
            data: {
                name: data.name.trim(),
                slug: tempSlug,
                categoryId: data.categoryId
            }
        });

        revalidatePath("/inventory/categories");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateSubcategory(id: string, data: { name: string }) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') return { success: false, error: "No tienes permisos" };

        if (!data.name.trim()) return { success: false, error: "El nombre es obligatorio" };

        const tempSlug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        // Find the subcategory to get its categoryId
        const current = await prisma.subcategory.findUnique({
            where: { id },
            select: { categoryId: true }
        });

        if (!current) return { success: false, error: "Subcategoría no encontrada" };

        // Check for duplicates in the same category
        const existing = await prisma.subcategory.findFirst({
            where: {
                OR: [
                    { name: { equals: data.name.trim(), mode: 'insensitive' } },
                    { slug: tempSlug }
                ],
                categoryId: current.categoryId,
                id: { not: id }
            }
        });

        if (existing) return { success: false, error: "Ya existe otra subcategoría con este nombre en esta categoría" };

        await prisma.subcategory.update({
            where: { id },
            data: {
                name: data.name.trim(),
                slug: tempSlug
            }
        });

        revalidatePath("/inventory/categories");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteSubcategory(id: string) {
    try {
        const user = await getSessionUser();
        if (user?.role !== 'ADMIN') return { success: false, error: "No tienes permisos" };

        await prisma.subcategory.delete({
            where: { id }
        });

        revalidatePath("/inventory/categories");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
