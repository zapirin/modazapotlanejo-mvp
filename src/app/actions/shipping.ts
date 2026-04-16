"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";
import {
    getShippingQuotes,
    createSkydropxShipment,
    getTrackingInfo,
    type ShippingRate,
    type ShipmentResult,
} from "@/lib/skydropx";
import { sendShipmentNotification } from "@/lib/email/templates";

// ---------------------------------------------------------------------------
// DIRECCIONES DE ENVÍO DEL COMPRADOR
// ---------------------------------------------------------------------------

export async function saveShippingAddress(data: {
    id?: string; // Si se pasa, actualiza en lugar de crear
    label?: string;
    name: string;
    phone: string;
    street: string;
    colonia: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
    isDefault?: boolean;
}) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado." };

        // Si es default, quitar default de las demás
        if (data.isDefault) {
            await prisma.shippingAddress.updateMany({
                where: { userId: user.id, isDefault: true },
                data: { isDefault: false },
            });
        }

        if (data.id) {
            // Actualizar existente
            const address = await prisma.shippingAddress.update({
                where: { id: data.id },
                data: {
                    label: data.label || "Principal",
                    name: data.name,
                    phone: data.phone,
                    street: data.street,
                    colonia: data.colonia,
                    city: data.city,
                    state: data.state,
                    zip: data.zip,
                    country: data.country || "MX",
                    isDefault: data.isDefault ?? false,
                },
            });
            return { success: true, address };
        } else {
            // Crear nueva
            const count = await prisma.shippingAddress.count({ where: { userId: user.id } });
            const address = await prisma.shippingAddress.create({
                data: {
                    userId: user.id,
                    label: data.label || "Principal",
                    name: data.name,
                    phone: data.phone,
                    street: data.street,
                    colonia: data.colonia,
                    city: data.city,
                    state: data.state,
                    zip: data.zip,
                    country: data.country || "MX",
                    isDefault: data.isDefault ?? count === 0, // Primera dirección = default
                },
            });
            return { success: true, address };
        }
    } catch (error: any) {
        console.error("Error saving shipping address:", error);
        return { success: false, error: "No se pudo guardar la dirección." };
    }
}

export async function getMyShippingAddresses() {
    try {
        const user = await getSessionUser();
        if (!user) return [];

        return await prisma.shippingAddress.findMany({
            where: { userId: user.id },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        });
    } catch (error) {
        console.error("Error fetching shipping addresses:", error);
        return [];
    }
}

export async function deleteShippingAddress(id: string) {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado." };

        await prisma.shippingAddress.delete({
            where: { id },
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error deleting shipping address:", error);
        return { success: false, error: "No se pudo eliminar la dirección." };
    }
}

// ---------------------------------------------------------------------------
// COTIZAR ENVÍO
// ---------------------------------------------------------------------------

export async function quoteShipping(
    sellerId: string,
    addressId: string,
    parcel: { weight: number; height: number; width: number; length: number }
): Promise<{ success: boolean; rates: ShippingRate[]; error?: string }> {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, rates: [], error: "No autorizado." };

        // Obtener dirección de destino del comprador
        const destAddress = await prisma.shippingAddress.findUnique({
            where: { id: addressId },
        });
        if (!destAddress) return { success: false, rates: [], error: "Dirección no encontrada." };

        // Obtener CP de envío del vendedor: primero de StoreSettings, luego de sucursal, luego default
        const [sellerSettings, sellerLocation] = await Promise.all([
            (prisma.storeSettings as any).findUnique({
                where: { sellerId },
                select: { shippingZip: true, storeName: true, phone: true },
            }),
            prisma.storeLocation.findFirst({
                where: { sellerId, address: { not: null } },
            }),
        ]);

        const originZip =
            sellerSettings?.shippingZip?.trim() ||
            sellerLocation?.address?.match(/\d{5}/)?.[0] ||
            "45430";

        const origin = {
            name: sellerSettings?.storeName || "Vendedor",
            phone: sellerSettings?.phone || "",
            street: sellerLocation?.address || "Centro",
            colonia: "Centro",
            city: "Zapotlanejo",
            state: "Jalisco",
            zip: originZip,
        };

        const destination = {
            name: destAddress.name,
            phone: destAddress.phone,
            street: destAddress.street,
            colonia: destAddress.colonia,
            city: destAddress.city,
            state: destAddress.state,
            zip: destAddress.zip,
            country: destAddress.country,
        };

        const result = await getShippingQuotes(origin, destination, parcel);
        return result;
    } catch (error: any) {
        console.error("Error quoting shipping:", error);
        return { success: false, rates: [], error: "Error al cotizar el envío." };
    }
}

// ---------------------------------------------------------------------------
// CREAR GUÍA DE ENVÍO (ACCIÓN DEL VENDEDOR)
// ---------------------------------------------------------------------------

export async function createShipmentLabel(
    orderId: string,
    rateId: string,
    quotationId: string,
    parcel: { weight: number; height: number; width: number; length: number }
): Promise<ShipmentResult> {
    try {
        const user = await getSessionUser();
        if (!user) return { success: false, error: "No autorizado." };

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                shippingAddress: true,
                buyer: { select: { email: true, name: true } },
                seller: { select: { name: true } },
                items: true,
            },
        });

        if (!order) return { success: false, error: "Pedido no encontrado." };
        if (!order.shippingAddress) return { success: false, error: "El pedido no tiene dirección de envío." };

        // Verificar permisos
        if (user.role !== "ADMIN" && order.sellerId !== user.id) {
            return { success: false, error: "No tienes permiso para generar esta guía." };
        }

        // Obtener dirección de origen del vendedor
        const sellerLocation = await prisma.storeLocation.findFirst({
            where: { sellerId: order.sellerId, address: { not: null } },
        });

        const originZip = sellerLocation?.address?.match(/\d{5}/)?.[0] || "45430";

        const origin = {
            name: order.seller?.name || "Vendedor",
            phone: user.phone || "",
            street: sellerLocation?.address || "Centro",
            colonia: "Centro",
            city: "Zapotlanejo",
            state: "Jalisco",
            zip: originZip,
        };

        const destination = {
            name: order.shippingAddress.name,
            phone: order.shippingAddress.phone,
            street: order.shippingAddress.street,
            colonia: order.shippingAddress.colonia,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            zip: order.shippingAddress.zip,
            country: order.shippingAddress.country,
        };

        const result = await createSkydropxShipment(origin, destination, parcel, rateId, quotationId);

        if (result.success) {
            // Guardar en la BD
            await prisma.shipment.create({
                data: {
                    orderId: order.id,
                    carrier: result.carrier || "Desconocido",
                    serviceName: result.serviceName || "Estándar",
                    trackingNumber: result.trackingNumber || null,
                    labelUrl: result.labelUrl || null,
                    skydropxId: result.shipmentId || null,
                    shippingCost: order.shippingCost,
                    status: "LABEL_CREATED",
                    estimatedDays: null,
                },
            });

            // Actualizar status del pedido
            await prisma.order.update({
                where: { id: orderId },
                data: { status: "SHIPPED" },
            });

            // Notificar al comprador por email
            if (order.buyer?.email) {
                sendShipmentNotification({
                    buyerEmail: order.buyer.email,
                    buyerName: order.buyer.name,
                    sellerName: order.seller?.name || "El vendedor",
                    orderNumber: order.orderNumber,
                    carrier: result.carrier || "Paquetería",
                    trackingNumber: result.trackingNumber || "",
                    labelUrl: result.labelUrl,
                }).catch(console.error);
            }

            revalidatePath("/orders");
            return result;
        }

        return result;
    } catch (error: any) {
        console.error("Error creating shipment:", error);
        return { success: false, error: "Error al generar la guía de envío." };
    }
}

// ---------------------------------------------------------------------------
// CONSULTAR ESTADO DEL ENVÍO
// ---------------------------------------------------------------------------

export async function getShipmentStatus(orderId: string) {
    try {
        const shipment = await prisma.shipment.findUnique({
            where: { orderId },
        });

        if (!shipment) return null;

        // Si tenemos tracking number, consultar estado actualizado (nueva API: tracking + carrier)
        const trackingRef = shipment.trackingNumber || shipment.skydropxId;
        if (trackingRef && !trackingRef.startsWith("mock_")) {
            const tracking = await getTrackingInfo(trackingRef, shipment.carrier || undefined);
            if (tracking.success && tracking.status) {
                // Actualizar en BD si el status cambió
                if (tracking.status !== shipment.status) {
                    await prisma.shipment.update({
                        where: { id: shipment.id },
                        data: { status: tracking.status },
                    });
                }
                return { ...shipment, status: tracking.status, events: tracking.events };
            }
        }

        return shipment;
    } catch (error) {
        console.error("Error fetching shipment status:", error);
        return null;
    }
}
