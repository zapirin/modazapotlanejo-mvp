"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function hashPassword(password: string): string {
    return crypto.createHash("sha256").update(password).digest("hex");
}

// Obtener cajeros del vendedor
export async function getSellerCashiers() {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return [];
        return await (prisma.user as any).findMany({
            where: { managedBySellerId: user.id },
            select: {
                id: true, name: true, email: true, isActive: true,
                allowedLocationIds: true,
                canRefund: true, canDiscount: true, canViewReports: true, canCreateProducts: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        });
    } catch (error) {
        console.error("getSellerCashiers error:", error);
        return [];
    }
}

// Crear cajero
export async function createCashier(data: {
    name: string;
    email: string;
    password: string;
    allowedLocationIds: string[];
    canRefund: boolean;
    canDiscount: boolean;
    canViewReports: boolean;
    canCreateProducts: boolean;
}) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return { success: false, error: "No autorizado" };

        // Verificar límite del plan
        const seller = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { maxCashiers: true, _count: { select: { cashiers: true } } },
        });
        const maxCashiers = seller?.maxCashiers ?? 1;
        const currentCount = seller?._count?.cashiers ?? 0;
        if (currentCount >= maxCashiers) {
            return { success: false, error: `Tu plan permite máximo ${maxCashiers} cajero${maxCashiers > 1 ? "s" : ""}. Solicita un upgrade al administrador.` };
        }

        // Verificar email único
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) return { success: false, error: "Ese correo ya está registrado" };

        const passwordHash = hashPassword(data.password);
        await (prisma.user as any).create({
            data: {
                name: data.name,
                email: data.email,
                passwordHash,
                role: "CASHIER",
                managedBySellerId: user.id,
                allowedLocationIds: data.allowedLocationIds,
                canRefund: data.canRefund,
                canDiscount: data.canDiscount,
                canViewReports: data.canViewReports,
                canCreateProducts: data.canCreateProducts,
                isActive: true,
            },
        });

        revalidatePath("/settings/team");
        return { success: true };
    } catch (error: any) {
        console.error("createCashier error:", error);
        return { success: false, error: error.message || "Error al crear cajero" };
    }
}

// Actualizar permisos y locaciones del cajero
export async function updateCashier(cashierId: string, data: {
    allowedLocationIds?: string[];
    canRefund?: boolean;
    canDiscount?: boolean;
    canViewReports?: boolean;
    canCreateProducts?: boolean;
    isActive?: boolean;
    password?: string;
}) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return { success: false, error: "No autorizado" };

        // Verificar que el cajero pertenece a este vendedor
        const cashier = await (prisma.user as any).findFirst({
            where: { id: cashierId, managedBySellerId: user.id },
        });
        if (!cashier) return { success: false, error: "Cajero no encontrado" };

        const updateData: any = { ...data };
        if (data.password) {
            updateData.passwordHash = hashPassword(data.password);
            delete updateData.password;
        }

        await (prisma.user as any).update({ where: { id: cashierId }, data: updateData });
        revalidatePath("/settings/team");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Desactivar cajero (mantiene historial)
export async function deleteCashier(cashierId: string) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return { success: false, error: "No autorizado" };

        const cashier = await (prisma.user as any).findFirst({
            where: { id: cashierId, managedBySellerId: user.id },
        });
        if (!cashier) return { success: false, error: "Cajero no encontrado" };

        await (prisma.user as any).update({
            where: { id: cashierId },
            data: { isActive: false },
        });
        revalidatePath("/settings/team");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Borrar permanentemente cajero desactivado
export async function permanentlyDeleteCashier(cashierId: string) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return { success: false, error: "No autorizado" };

        const cashier = await (prisma.user as any).findFirst({
            where: { id: cashierId, managedBySellerId: user.id, isActive: false },
        });
        if (!cashier) return { success: false, error: "Solo se pueden eliminar cajeros desactivados" };

        await (prisma.user as any).delete({ where: { id: cashierId } });
        revalidatePath("/settings/team");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
