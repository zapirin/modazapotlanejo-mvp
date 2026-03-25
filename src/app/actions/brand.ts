"use server";

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export const DEFAULT_BRANDS: Record<string, any> = {
    "modazapotlanejo.com": {
        domain: "modazapotlanejo.com",
        name: "Moda Zapotlanejo",
        tagline: "Fashion Marketplace",
        description: "El marketplace mayorista líder de Zapotlanejo.",
        primaryColor: "blue",
        featuredSellerIds: [],
        featuredProductIds: [],
        featuredCategories: [],
    },
    "zonadelvestir.com": {
        domain: "zonadelvestir.com",
        name: "Zona del Vestir",
        tagline: "Tu Zona Mayorista",
        description: "La zona mayorista de moda más grande de México.",
        primaryColor: "violet",
        featuredSellerIds: [],
        featuredProductIds: [],
        featuredCategories: [],
    },
};

// Obtener la marca según el dominio del request actual
export async function getCurrentBrand() {
    try {
        const headersList = await headers();
        const host = headersList.get("host") || "";
        const domain = host.replace(/:\d+$/, "").replace(/^www\./, "");

        try {
            const brand = await (prisma as any).brandConfig.findUnique({
                where: { domain },
            });
            if (brand) return brand;
        } catch {
            // Tabla no existe aún — retornar null para usar fallback estático
            return null;
        }

        return null; // El layout usará el fallback estático
    } catch {
        return null;
    }
}

// Obtener todas las marcas configuradas
export async function getAllBrands() {
    try {
        return await (prisma as any).brandConfig.findMany({
            orderBy: { domain: "asc" },
        });
    } catch { return []; }
}

// Crear o actualizar una marca
export async function saveBrandConfig(data: {
    domain: string;
    name: string;
    tagline?: string;
    description?: string;
    logoUrl?: string;
    heroImage?: string;
    primaryColor?: string;
    featuredSellerIds?: string[];
    featuredProductIds?: string[];
    featuredCategories?: string[];
}) {
    try {
        const existing = await (prisma as any).brandConfig.findUnique({
            where: { domain: data.domain },
        });

        if (existing) {
            await (prisma as any).brandConfig.update({
                where: { domain: data.domain },
                data,
            });
        } else {
            await (prisma as any).brandConfig.create({ data });
        }

        revalidatePath("/");
        revalidatePath("/catalog");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteBrandConfig(domain: string) {
    try {
        await (prisma as any).brandConfig.delete({ where: { domain } });
        revalidatePath("/");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
