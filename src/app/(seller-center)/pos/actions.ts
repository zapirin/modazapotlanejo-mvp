"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/app/actions/auth";

// Cash Management Actions
export async function getCurrentCashSession(locationId?: string) {
    try {
        const user = await getSessionUser();

        const sessionInclude = {
            movements: { orderBy: { createdAt: 'asc' as const } },
            openedBy: { select: { id: true, name: true } },
            location: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    ticketHeader: true,
                    ticketFooter: true,
                    showDateAndTimeToPos: true,
                }
            },
            sales: {
                include: { paymentMethod: true }
            }
        };

        const resolvedLocationId = locationId || user?.locationId || null;

        // Cualquier usuario: primero buscar su propia sesión abierta en la sucursal.
        // Esto permite sesiones paralelas (varios cajeros en la misma sucursal).
        if (resolvedLocationId && user?.id) {
            const ownSession = await prisma.cashRegisterSession.findFirst({
                where: { status: 'OPEN', locationId: resolvedLocationId, openedById: user.id },
                orderBy: { openedAt: 'desc' },
                include: sessionInclude,
            });
            if (ownSession) return ownSession;
        }

        // Comportamiento estándar: buscar cualquier sesión abierta en la sucursal
        const whereClause: any = { status: 'OPEN' };
        if (resolvedLocationId) {
            whereClause.locationId = resolvedLocationId;
        } else {
            whereClause.openedById = user?.id || null;
        }

        return await prisma.cashRegisterSession.findFirst({
            where: whereClause,
            orderBy: { openedAt: 'desc' },
            include: sessionInclude,
        });
    } catch (error) {
        console.error('Error fetching current cash session:', error);
        return null;
    }
}

export async function openCashSession(openingBalance: number, locationId?: string) {
    try {
        const user = await getSessionUser();
        // Para cajeros: usar locationId pasado; para vendedores/admin: usar su locationId o el pasado
        const finalLocationId = locationId || user?.locationId || null;
        const session = await prisma.cashRegisterSession.create({
            data: {
                openingBalance,
                status: "OPEN",
                locationId: finalLocationId,
                openedById: user?.id || null
            }
        });
        revalidatePath("/pos");
        return { success: true, session };
    } catch (error) {
        console.error("Error opening cash session:", error);
        return { success: false, error: "No se pudo abrir la caja." };
    }
}

// Obtener locaciones permitidas para el usuario actual (cajero o vendedor)
export async function getAllowedLocations() {
    try {
        const user = await getSessionUser();
        if (!user) return [];

        // Si es cajero: devolver solo sus locaciones permitidas
        if (user.role === 'CASHIER') {
            const cashier = await (prisma.user as any).findUnique({
                where: { id: user.id },
                select: { allowedLocationIds: true, managedBySellerId: true }
            });
            const allowedIds: string[] = cashier?.allowedLocationIds || [];
            if (allowedIds.length === 0) return [];
            return await prisma.storeLocation.findMany({
                where: { id: { in: allowedIds } }
            });
        }

        // Si es vendedor o admin: devolver todas sus locaciones
        const where = user.role === 'ADMIN' ? {} : { sellerId: user.id };
        return await prisma.storeLocation.findMany({ where, orderBy: { name: 'asc' } });
    } catch (error) {
        return [];
    }
}

export async function addCashMovement(sessionId: string, type: "IN" | "OUT", amount: number, reason: string) {
    try {
        const movement = await prisma.cashMovement.create({
            data: {
                sessionId,
                type,
                amount,
                reason
            }
        });
        revalidatePath("/pos");
        return { success: true, movement };
    } catch (error) {
        console.error("Error adding cash movement:", error);
        return { success: false, error: "No se pudo registrar el movimiento." };
    }
}

export async function closeCashSession(sessionId: string, closingBalance: number) {
    try {
        const session = await prisma.cashRegisterSession.update({
            where: { id: sessionId },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                closingBalance
            }
        });
        revalidatePath("/pos");
        return { success: true, session };
    } catch (error) {
        console.error("Error closing cash session:", error);
        return { success: false, error: "No se pudo cerrar la caja." };
    }
}

export async function createTransfer(cart: any[], sourceId: string, destId: string) {
    if (!sourceId || !destId || sourceId === destId) {
        return { success: false, error: 'Sucursales no válidas.' };
    }
    
    try {
        const user = await getSessionUser();
        
        await prisma.$transaction(async (tx) => {
            for (const item of cart) {
                const qty = item.quantity;
                const variantId = item.variantId || item.variant?.id;
                
                // 1. Origen: Descontar y Registrar Movimiento
                const sourceLevel = await tx.inventoryLevel.findUnique({
                    where: { variantId_locationId: { variantId, locationId: sourceId } }
                });
                
                if (!sourceLevel || sourceLevel.stock < qty) {
                    throw new Error(`Inventario insuficiente para ${item.name || item.variant?.product?.name} en la sucursal de origen.`);
                }
                
                await tx.inventoryLevel.update({
                    where: { id: sourceLevel.id },
                    data: { stock: { decrement: qty } }
                });
                
                await tx.inventoryMovement.create({
                    data: {
                        variantId,
                        locationId: sourceId,
                        type: 'TRANSFER_OUT',
                        quantity: -qty,
                        reason: `Traspaso hacia sucursal destino. Usuario: ${user?.name || 'Sistema'}`
                    }
                });
                
                // 2. Destino: Aumentar y Registrar Movimiento
                await tx.inventoryLevel.upsert({
                    where: { variantId_locationId: { variantId, locationId: destId } },
                    create: { variantId, locationId: destId, stock: qty },
                    update: { stock: { increment: qty } }
                });
                
                await tx.inventoryMovement.create({
                    data: {
                        variantId,
                        locationId: destId,
                        type: 'TRANSFER_IN',
                        quantity: qty,
                        reason: `Traspaso desde sucursal origen. Usuario: ${user?.name || 'Sistema'}`
                    }
                });
            }
        });
        
        revalidatePath('/pos');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: any) {
        console.error("Error creating transfer:", error);
        return { success: false, error: error.message || 'Error desconocido al traspasar inventario' };
    }
}

export async function getSalesBySession(sessionId: string) {
    try {
        const sales = await prisma.sale.findMany({
            where: { cashSessionId: sessionId },
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    include: {
                        variant: {
                            include: {
                                product: { select: { id: true, name: true, images: true } }
                            }
                        }
                    }
                },
                paymentMethod: { select: { id: true, name: true } },
                client: { select: { id: true, name: true } },
                location: { select: { id: true, name: true, address: true, ticketHeader: true, ticketFooter: true } },
                // paymentSplit included as scalar field automatically
            }
        });
        return sales;
    } catch (error) {
        console.error('Error fetching session sales:', error);
        return [];
    }
}

// Obtener vendedores de piso del seller para asignar en una venta POS
export async function getSalespersons(locationId?: string) {
    try {
        const user = await getSessionUser();
        if (!user) return [];

        // Resolver el sellerId efectivo
        let sellerId = user.id;
        if (user.role === 'CASHIER') {
            const cashier = await (prisma.user as any).findUnique({
                where: { id: user.id },
                select: { managedBySellerId: true }
            });
            if (!cashier?.managedBySellerId) return [];
            sellerId = cashier.managedBySellerId;
        } else if (user.role === 'ADMIN') {
            return [];
        }

        // Filtrar vendedores de piso activos de este seller
        const allSalespeople = await (prisma as any).salesperson.findMany({
            where: { sellerId, isActive: true },
            select: { id: true, name: true, locationIds: true, commissionType: true, commissionValue: true },
            orderBy: { name: 'asc' }
        });

        // Si hay locationId, devolver solo los que tienen esa sucursal asignada (o los que no tienen restricción)
        if (locationId) {
            return allSalespeople.filter((sp: any) =>
                !sp.locationIds || sp.locationIds.length === 0 || sp.locationIds.includes(locationId)
            );
        }

        return allSalespeople;
    } catch (error) {
        console.error('Error fetching salespersons:', error);
        return [];
    }
}

export async function checkSellerPOSAccess() {
    const user = await getSessionUser();
    if (!user) return { posEnabled: false };
    if (user.role === 'ADMIN') return { posEnabled: true };
    if (user.role === 'CASHIER') {
        // Cajero — verificar que su vendedor tiene POS habilitado
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true }
        });
        if (!cashier?.managedBySellerId) return { posEnabled: false };
        const seller = await (prisma.user as any).findUnique({
            where: { id: cashier.managedBySellerId },
            select: { posEnabled: true }
        });
        return { posEnabled: seller?.posEnabled ?? false };
    }
    // SELLER — verificar su propio posEnabled
    const seller = await (prisma.user as any).findUnique({
        where: { id: user.id },
        select: { posEnabled: true }
    });
    return { posEnabled: seller?.posEnabled ?? false };
}
