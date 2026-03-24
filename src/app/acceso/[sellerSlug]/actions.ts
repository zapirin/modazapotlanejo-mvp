"use server";

import { prisma } from "@/lib/prisma";
import { login, getSessionUser } from "@/app/actions/auth";

// Obtener datos básicos del vendedor por slug (para mostrar en la página de login)
export async function getSellerBySlug(slug: string) {
    try {
        const seller = await (prisma.user as any).findFirst({
            where: { sellerSlug: slug, role: 'SELLER', isActive: true },
            select: {
                id: true,
                name: true,
                businessName: true,
                logoUrl: true,
                sellerSlug: true,
            }
        });
        return seller;
    } catch {
        return null;
    }
}

// Verifica si ya hay una sesión activa válida para esta tienda
export async function checkExistingSession(sellerId: string) {
    try {
        const user = await getSessionUser();
        if (!user) return false;
        // El propio vendedor
        if (user.role === 'SELLER' && user.id === sellerId) return true;
        // Un cajero de este vendedor
        if (user.role === 'CASHIER') {
            const cashier = await (prisma.user as any).findFirst({
                where: { id: user.id, managedBySellerId: sellerId, isActive: true }
            });
            return !!cashier;
        }
        return false;
    } catch {
        return false;
    }
}

// Login del cajero para el POS — verifica que el cajero pertenece al vendedor
export async function loginCashierForPOS(email: string, password: string, sellerSlug: string) {
    try {
        // Primero hacer login normal
        const result = await login(email, password);
        if (!result.success) return { success: false, error: result.error };

        // Verificar que el usuario que inició sesión es cajero de este vendedor
        const seller = await (prisma.user as any).findFirst({
            where: { sellerSlug, role: 'SELLER', isActive: true },
            select: { id: true }
        });
        if (!seller) return { success: false, error: 'Tienda no encontrada' };

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() }
        });

        if (!user) return { success: false, error: 'Usuario no encontrado' };

        // El propio vendedor también puede entrar
        if (user.role === 'SELLER' && user.id === seller.id) {
            return { success: true, role: user.role };
        }

        // Verificar que es cajero de este vendedor
        const cashier = await (prisma.user as any).findFirst({
            where: {
                id: user.id,
                managedBySellerId: seller.id,
                isActive: true,
            }
        });

        if (!cashier) {
            return { success: false, error: 'No tienes acceso al POS de esta tienda' };
        }

        return { success: true, role: user.role };
    } catch (error: any) {
        return { success: false, error: 'Error al iniciar sesión' };
    }
}
