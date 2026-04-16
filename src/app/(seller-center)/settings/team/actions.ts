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
                canRefund: true, canDiscount: true, canViewReports: true,
                canViewCommissions: true, canViewZCuts: true, canCreateProducts: true,
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
    canViewCommissions: boolean;
    canViewZCuts: boolean;
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
        const existing = await prisma.user.findFirst({ where: { email: data.email } });
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
                locationId: data.allowedLocationIds.length === 1 ? data.allowedLocationIds[0] : null,
                canRefund: data.canRefund,
                canDiscount: data.canDiscount,
                canViewReports: data.canViewReports,
                canViewCommissions: data.canViewCommissions,
                canViewZCuts: data.canViewZCuts,
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
    canViewCommissions?: boolean;
    canViewZCuts?: boolean;
    canCreateProducts?: boolean;
    canOpenDrawer?: boolean;
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

        if (data.allowedLocationIds && data.allowedLocationIds.length === 1) {
            updateData.locationId = data.allowedLocationIds[0];
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

// ─── Vendedores de Piso (Floor Salespeople) ─────────────────────────────────

export async function getFloorSalespeople() {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return [];
        return await (prisma as any).salesperson.findMany({
            where: { sellerId: user.id },
            orderBy: { name: "asc" },
        });
    } catch (error) {
        console.error("getFloorSalespeople error:", error);
        return [];
    }
}

export async function createFloorSalesperson(data: {
    name: string;
    phone?: string;
    email?: string;
    startDate?: string;
    commissionType: string;
    commissionValue: number;
    locationIds: string[];
}) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return { success: false, error: "No autorizado" };

        await (prisma as any).salesperson.create({
            data: {
                sellerId: user.id,
                name: data.name,
                phone: data.phone || null,
                email: data.email || null,
                startDate: data.startDate ? new Date(data.startDate) : new Date(),
                commissionType: data.commissionType || "PERCENT",
                commissionValue: data.commissionValue,
                locationIds: data.locationIds,
                isActive: true,
            },
        });
        revalidatePath("/settings/team");
        return { success: true };
    } catch (error: any) {
        console.error("createFloorSalesperson error:", error);
        return { success: false, error: error.message || "Error al crear vendedor de piso" };
    }
}

export async function updateFloorSalesperson(id: string, data: {
    name?: string;
    phone?: string;
    email?: string;
    startDate?: string;
    commissionType?: string;
    commissionValue?: number;
    locationIds?: string[];
    isActive?: boolean;
}) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return { success: false, error: "No autorizado" };

        const existing = await (prisma as any).salesperson.findFirst({
            where: { id, sellerId: user.id },
        });
        if (!existing) return { success: false, error: "Vendedor no encontrado" };

        const updateData: any = { ...data };
        if (data.startDate) updateData.startDate = new Date(data.startDate);
        if (data.email === "") updateData.email = null;
        if (data.phone === "") updateData.phone = null;

        await (prisma as any).salesperson.update({ where: { id }, data: updateData });
        revalidatePath("/settings/team");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteFloorSalesperson(id: string) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return { success: false, error: "No autorizado" };

        const existing = await (prisma as any).salesperson.findFirst({
            where: { id, sellerId: user.id },
        });
        if (!existing) return { success: false, error: "Vendedor no encontrado" };

        await (prisma as any).salesperson.update({
            where: { id },
            data: { isActive: false },
        });
        revalidatePath("/settings/team");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ─── Borrar permanentemente cajero desactivado ─────────────────────────────
export async function permanentlyDeleteCashier(cashierId: string) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== "SELLER") return { success: false, error: "No autorizado" };

        const cashier = await (prisma.user as any).findFirst({
            where: { id: cashierId, managedBySellerId: user.id, isActive: false },
        });
        if (!cashier) return { success: false, error: "Solo se pueden eliminar cajeros desactivados" };

        // Limpiar dependencias que impiden el borrado (Mensajes)
        await prisma.message.deleteMany({
            where: {
                OR: [
                    { senderId: cashierId },
                    { receiverId: cashierId }
                ]
            }
        });

        // Intentar borrar (puede fallar si hay ventas o sesiones, en cuyo caso es mejor mantenerlo como inactivo)
        await (prisma.user as any).delete({ where: { id: cashierId } });
        
        revalidatePath("/settings/team");
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2003') {
            return { 
                success: false, 
                error: "No se puede eliminar permanentemente porque este cajero tiene historial de ventas o sesiones. Se recomienda dejarlo como Desactivado." 
            };
        }
        return { success: false, error: error.message };
    }
}
