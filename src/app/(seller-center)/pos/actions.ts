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

async function resolveSellerId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.role === 'SELLER') return user.id;
    if (user.role === 'CASHIER') {
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true }
        });
        return cashier?.managedBySellerId || null;
    }
    return null;
}

export async function createTransfer(cart: any[], sourceId: string, destId: string) {
    if (!sourceId || !destId || sourceId === destId) {
        return { success: false, error: 'Sucursales no válidas.' };
    }

    try {
        const user = await getSessionUser();
        const sellerId = await resolveSellerId(user);
        if (!sellerId) {
            return { success: false, error: 'No se pudo determinar el vendedor para este traspaso.' };
        }

        const transferId = await prisma.$transaction(async (tx) => {
            // 1. Calcular siguiente folio para este seller
            const last = await (tx as any).stockTransfer.findFirst({
                where: { sellerId },
                orderBy: { folio: 'desc' },
                select: { folio: true },
            });
            const nextFolio = (last?.folio ?? 0) + 1;

            const totalItems = cart.reduce((s, it) => s + (it.quantity || 0), 0);

            // 2. Crear el StockTransfer
            const transfer = await (tx as any).stockTransfer.create({
                data: {
                    sellerId,
                    sourceLocationId: sourceId,
                    destLocationId: destId,
                    userId: user?.id || null,
                    folio: nextFolio,
                    totalItems,
                },
            });

            // 3. Por cada item: validar stock, mover inventario, registrar movimientos y crear item
            for (const item of cart) {
                const qty = item.quantity;
                const variantId = item.variantId || item.variant?.id;

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
                        reason: `Traspaso T-${String(nextFolio).padStart(6, '0')}. Usuario: ${user?.name || 'Sistema'}`
                    }
                });

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
                        reason: `Traspaso T-${String(nextFolio).padStart(6, '0')}. Usuario: ${user?.name || 'Sistema'}`
                    }
                });

                // Snapshot del producto/variante para preservar histórico
                const productName = item.name || item.variant?.product?.name || 'Producto';
                const variantInfo = [item.variant?.color || item.color, item.variant?.size || item.size]
                    .filter(Boolean).join(' / ') || null;

                await (tx as any).stockTransferItem.create({
                    data: {
                        transferId: transfer.id,
                        variantId,
                        quantity: qty,
                        productName,
                        variantInfo,
                    },
                });
            }

            return transfer.id;
        });

        revalidatePath('/pos');
        revalidatePath('/inventory');
        return { success: true, transferId };
    } catch (error: any) {
        console.error("Error creating transfer:", error);
        return { success: false, error: error.message || 'Error desconocido al traspasar inventario' };
    }
}

export async function getTransferById(id: string) {
    try {
        const user = await getSessionUser();
        if (!user) return null;
        const sellerId = await resolveSellerId(user);
        if (!sellerId) return null;

        const transfer = await (prisma as any).stockTransfer.findUnique({
            where: { id },
            include: {
                sourceLocation: { select: { id: true, name: true, address: true, ticketHeader: true, ticketFooter: true } },
                destLocation: { select: { id: true, name: true, address: true } },
                user: { select: { id: true, name: true } },
                seller: { select: { id: true, name: true, businessName: true, logoUrl: true } },
                items: {
                    include: {
                        variant: {
                            include: {
                                product: { select: { id: true, name: true, images: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!transfer) return null;
        if (transfer.sellerId !== sellerId) return null;
        return transfer;
    } catch (error) {
        console.error("Error fetching transfer:", error);
        return null;
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

// Resuelve el sellerId al que pertenece el usuario actual (seller directo o cajero/manager)
async function resolveSellerIdForUser(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.role === 'SELLER') return user.id;
    if (user.role === 'ADMIN') return user.id;
    // CASHIER / MANAGER — usar managedBySellerId
    const u = await (prisma.user as any).findUnique({
        where: { id: user.id },
        select: { managedBySellerId: true }
    });
    return u?.managedBySellerId || null;
}

// Lee el flag de Modo Prueba del seller dueño del POS donde opera el usuario actual
export async function getPosTestMode(): Promise<{ active: boolean }> {
    const user = await getSessionUser();
    if (!user) return { active: false };
    const sellerId = await resolveSellerIdForUser(user);
    if (!sellerId) return { active: false };
    const seller = await (prisma.user as any).findUnique({
        where: { id: sellerId },
        select: { posTestMode: true }
    });
    return { active: !!seller?.posTestMode };
}

// Solo SELLER/ADMIN puede activar/desactivar Modo Prueba para su tienda
export async function setPosTestMode(active: boolean) {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "No autorizado" };
    if (user.role !== 'SELLER' && user.role !== 'ADMIN') {
        return { success: false, error: "Solo el vendedor puede cambiar el Modo Prueba" };
    }
    await (prisma.user as any).update({
        where: { id: user.id },
        data: { posTestMode: !!active }
    });
    return { success: true, active: !!active };
}
