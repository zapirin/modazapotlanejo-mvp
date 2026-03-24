"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/app/actions/auth';


// Helper: resolver el sellerId efectivo para cajeros
async function getEffectiveSellerId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.role === 'CASHIER') {
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true }
        });
        return cashier?.managedBySellerId || null;
    }
    return user.id;
}

export async function createClient(data: { name: string; email?: string; phone?: string }) {
    try {
        const user = await getSessionUser();
        const sellerId = await getEffectiveSellerId(user);
        const newClient = await prisma.client.create({
            data: {
                name: data.name,
                email: data.email || null,
                phone: data.phone || null,
                sellerId: sellerId
            }
        });
        revalidatePath('/clients');
        revalidatePath('/pos');
        return { success: true, client: newClient };
    } catch (error: any) {
        console.error("Create Client Error:", error);
        return { success: false, error: `Ocurrió un error al crear el cliente: ${error.message || error}` };
    }
}

export async function searchClients(query: string) {
    if (!query) return [];
    try {
        const user = await getSessionUser();
        const sellerId = await getEffectiveSellerId(user);
        const clients = await prisma.client.findMany({
            where: {
                sellerId: sellerId,
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                    { phone: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 10
        });
        return clients;
    } catch (error) {
        console.error("Search Clients Error:", error);
        return [];
    }
}

export async function getClientById(clientId: string) {
    try {
        const user = await getSessionUser();
        const sellerId = await getEffectiveSellerId(user);

        const client = await prisma.client.findFirst({
            where: {
                id: clientId,
                OR: [
                    { sellerId: sellerId },
                    { sellerId: null }
                ]
            },
            include: {
                sales: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        items: {
                            include: {
                                variant: {
                                    include: { product: true }
                                }
                            }
                        },
                        paymentMethod: true,
                        priceTier: true
                    }
                },
                _count: {
                    select: { sales: true }
                }
            }
        });

        return { success: true, client };
    } catch (error: any) {
        console.error("Error fetching client history:", error);
        return { success: false, error: 'No se pudo cargar el historial del cliente.' };
    }
}

export async function updateClient(clientId: string, data: { name: string; email?: string; phone?: string }) {
    try {
        const user = await getSessionUser();
        const sellerId = await getEffectiveSellerId(user);

        const updatedClient = await prisma.client.updateMany({
            where: {
                id: clientId,
                OR: [
                    { sellerId: sellerId },
                    { sellerId: null }
                ]
            },
            data: {
                name: data.name,
                email: data.email || null,
                phone: data.phone || null
            }
        });

        if (updatedClient.count === 0) {
            return { success: false, error: 'No autorizado para editar este cliente.' };
        }

        const freshClient = await prisma.client.findUnique({ where: { id: clientId } });

        revalidatePath('/clients');
        revalidatePath(`/clients/${clientId}`);
        revalidatePath('/pos');
        return { success: true, client: freshClient };
    } catch (error: any) {
        console.error("Update Client Error:", error);
        return { success: false, error: 'Ocurrió un error al actualizar el cliente.' };
    }
}

export async function deleteClient(clientId: string) {
    try {
        const user = await getSessionUser();
        const sellerId = await getEffectiveSellerId(user);

        const client = await prisma.client.findFirst({
            where: {
                id: clientId,
                OR: [
                    { sellerId: sellerId },
                    { sellerId: null }
                ]
            },
            include: {
                _count: {
                    select: { sales: true, storeAccountPayments: true }
                }
            }
        });

        if (!client) {
            return { success: false, error: "Cliente no encontrado o sin permisos." };
        }

        if (client.storeCredit !== 0) {
            return { success: false, error: "No puedes borrar un cliente que tiene saldo pendiente (a favor o en contra). Debes saldar su cuenta antes." };
        }

        // Desvincular todas las ventas de este cliente para no perder el histórico de caja/inventario
        if (client._count.sales > 0) {
            await prisma.sale.updateMany({
                where: { clientId: clientId },
                data: { clientId: null }
            });
        }
        
        // Los abonos (StoreAccountPayment) se borran en cascada automáticamente gracias a `onDelete: Cascade` en el schema.

        await prisma.client.delete({
            where: { id: clientId }
        });

        revalidatePath('/clients');
        return { success: true };
    } catch (error: any) {
        console.error("Delete Client Error:", error);
        return { success: false, error: 'Ocurrió un error al borrar el cliente.' };
    }
}
