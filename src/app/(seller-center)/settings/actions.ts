"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/app/actions/auth';

// Helper to get the effective sellerId for isolation
async function getSellerFilter() {
    const user = await getSessionUser();
    if (!user) return { filter: {}, sellerId: null, user: null };
    
    if (user.role === 'ADMIN') return { filter: {}, sellerId: null, user };
    
    if ((user.role as any) === 'SELLER') return { filter: { sellerId: user.id }, sellerId: user.id, user };
    
    // Cajero creado desde Mi Equipo — usa managedBySellerId
    if ((user.role as any) === 'CASHIER') {
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true }
        });
        const sid = cashier?.managedBySellerId || null;
        return { filter: sid ? { sellerId: sid } : {}, sellerId: sid, user };
    }

    // Manager — get from their location
    if (user.locationId) {
        const loc = await (prisma.storeLocation as any).findUnique({
            where: { id: user.locationId },
            select: { sellerId: true }
        });
        const sid = (loc as any)?.sellerId || null;
        return { filter: sid ? { sellerId: sid } : {}, sellerId: sid, user };
    }
    
    return { filter: {}, sellerId: null, user };
}

// GLOBAL SETTINGS (Per Seller)
export async function getStoreSettings() {
    try {
        const { sellerId } = await getSellerFilter();
        if (!sellerId) return { success: false, error: "No se identificó el vendedor." };

        let settings = await prisma.storeSettings.findUnique({
            where: { sellerId }
        });

        if (!settings) {
            settings = await prisma.storeSettings.create({
                data: {
                    sellerId,
                    storeName: "Mi Punto de Venta"
                }
            });
        }
        return { success: true, data: settings };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateStoreSettings(data: {
    storeName?: string;
    logoUrl?: string;
    taxId?: string;
    legalName?: string;
    address?: string;
    phone?: string;
}) {
    try {
        const { sellerId } = await getSellerFilter();
        if (!sellerId) return { success: false, error: "No se identificó el vendedor." };

        let settings = await prisma.storeSettings.findUnique({
            where: { sellerId }
        });
        
        if (settings) {
            settings = await prisma.storeSettings.update({
                where: { id: settings.id },
                data
            });
        } else {
            settings = await prisma.storeSettings.create({
                data: {
                    sellerId,
                    storeName: data.storeName || "Mi Punto de Venta",
                    ...data
                }
            });
        }
        
        revalidatePath('/settings/general');
        revalidatePath('/pos');
        return { success: true, data: settings };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// LOCATIONS & TICKETS SETTINGS
export async function getLocationsSettings() {
    try {
        const { filter } = await getSellerFilter();
        const locations = await prisma.storeLocation.findMany({
            where: filter as any,
            orderBy: { createdAt: 'asc' }
        });
        return { success: true, data: locations };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateLocationTicketConfig(id: string, data: {
    name?: string;
    address?: string;
    ticketHeader?: string | null;
    ticketFooter?: string | null;
    showDateAndTimeToPos?: boolean;
}) {
    try {
        const location = await prisma.storeLocation.update({
            where: { id },
            data
        });
        revalidatePath('/settings/locations');
        return { success: true, data: location };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createStoreLocation(data: {
    name: string;
    address?: string;
}) {
    try {
        const { sellerId } = await getSellerFilter();
        if (!sellerId) return { success: false, error: 'No autorizado' };

        // Verificar límite de locaciones del plan
        const seller = await (prisma.user as any).findUnique({
            where: { id: sellerId },
            select: { maxLocations: true }
        });
        if (seller?.maxLocations !== null && seller?.maxLocations !== undefined) {
            const max = parseInt(seller.maxLocations);
            if (!isNaN(max)) {
                const current = await (prisma.storeLocation as any).count({ where: { sellerId } });
                if (current >= max) {
                    return { success: false, error: `Tu plan permite máximo ${max} locación${max > 1 ? 'es' : ''}. Contacta al administrador para aumentar tu límite.` };
                }
            }
        }

        const newLocation = await prisma.storeLocation.create({
            data: {
                name: data.name,
                address: data.address,
                ...(sellerId ? { sellerId } : {})
            } as any
        });
        revalidatePath('/settings/locations');
        return { success: true, data: newLocation };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteStoreLocation(locationId: string) {
    try {
        const { sellerId } = await getSellerFilter();
        if (!sellerId) return { success: false, error: 'No autorizado' };
        // Verificar que la locación pertenece al vendedor
        const loc = await (prisma.storeLocation as any).findFirst({
            where: { id: locationId, sellerId }
        });
        if (!loc) return { success: false, error: 'Locación no encontrada' };
        await (prisma.storeLocation as any).delete({ where: { id: locationId } });
        revalidatePath('/settings/locations');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateStoreLocationName(locationId: string, name: string, address?: string) {
    try {
        const { sellerId } = await getSellerFilter();
        if (!sellerId) return { success: false, error: 'No autorizado' };
        const loc = await (prisma.storeLocation as any).findFirst({
            where: { id: locationId, sellerId }
        });
        if (!loc) return { success: false, error: 'Locación no encontrada' };
        await (prisma.storeLocation as any).update({
            where: { id: locationId },
            data: { name, address }
        });
        revalidatePath('/settings/locations');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// LOGO DEL VENDEDOR
// ---------------------------------------------------------------------------

export async function updateSellerLogo(logoDataUrl: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: 'No autorizado' };

        await (prisma.user as any).update({
            where: { id: user.id },
            data: { logoUrl: logoDataUrl }
        });

        revalidatePath('/settings/profile');
        return { success: true };
    } catch (error) {
        console.error('updateSellerLogo error:', error);
        return { success: false, error: 'Error al guardar el logo' };
    }
}

// ---------------------------------------------------------------------------
// SOLICITUD DE ACCESO AL POS
// ---------------------------------------------------------------------------

export async function requestPOSAccess() {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: 'No autorizado' };
        await (prisma.user as any).update({
            where: { id: user.id },
            data: { posRequested: true }
        });
        revalidatePath('/settings/profile');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Error al enviar solicitud' };
    }
}

// ---------------------------------------------------------------------------
// SLUG DEL VENDEDOR — Auto-generar si no existe
// ---------------------------------------------------------------------------

export async function ensureSellerSlug() {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'SELLER') return { success: false, error: 'No autorizado' };

        // Si ya tiene slug, devolver el existente
        const seller = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { sellerSlug: true, businessName: true, name: true }
        });
        if (seller?.sellerSlug) return { success: true, slug: seller.sellerSlug };

        // Generar slug desde businessName o name
        const base = (seller?.businessName || seller?.name || 'tienda')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 50);

        let slug = base;
        let counter = 1;
        while (true) {
            const existing = await (prisma.user as any).findFirst({ where: { sellerSlug: slug } });
            if (!existing) break;
            slug = `${base}-${counter++}`;
        }

        await (prisma.user as any).update({ where: { id: user.id }, data: { sellerSlug: slug } });
        revalidatePath('/settings/profile');
        return { success: true, slug };
    } catch (error: any) {
        console.error('ensureSellerSlug error:', error);
        return { success: false, error: error.message };
    }
}
