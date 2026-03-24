"use server";

// ---------------------------------------------------------------------------
// SKYDROPX API CLIENT
// Módulo para cotizar envíos, generar guías y rastrear paquetes.
// Docs: https://docs.skydropx.com
// ---------------------------------------------------------------------------

const SKYDROPX_API_URL = "https://api.skydropx.com/v1";
const SKYDROPX_API_KEY = process.env.SKYDROPX_API_KEY || "";

interface Address {
    name: string;
    phone: string;
    street: string;
    colonia: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
}

interface ParcelDimensions {
    weight: number;   // kg
    height: number;   // cm
    width: number;    // cm
    length: number;   // cm
}

export interface ShippingRate {
    rateId: string;
    quotationId: string;
    carrier: string;
    carrierLogo?: string;
    serviceName: string;
    totalPrice: number;
    currency: string;
    estimatedDays: number;
}

export interface ShipmentResult {
    success: boolean;
    shipmentId?: string;
    trackingNumber?: string;
    labelUrl?: string;
    carrier?: string;
    serviceName?: string;
    error?: string;
}

// ---------------------------------------------------------------------------
// MOCK DATA — Se usa cuando no hay API key configurada
// ---------------------------------------------------------------------------

const MOCK_RATES: ShippingRate[] = [
    {
        rateId: "mock_rate_1",
        quotationId: "mock_quotation_1",
        carrier: "FedEx",
        serviceName: "FedEx Express",
        totalPrice: 185.00,
        currency: "MXN",
        estimatedDays: 1,
    },
    {
        rateId: "mock_rate_2",
        quotationId: "mock_quotation_1",
        carrier: "Estafeta",
        serviceName: "Estafeta Día Siguiente",
        totalPrice: 145.00,
        currency: "MXN",
        estimatedDays: 2,
    },
    {
        rateId: "mock_rate_3",
        quotationId: "mock_quotation_1",
        carrier: "DHL",
        serviceName: "DHL Express",
        totalPrice: 220.00,
        currency: "MXN",
        estimatedDays: 1,
    },
    {
        rateId: "mock_rate_4",
        quotationId: "mock_quotation_1",
        carrier: "Correos de México",
        serviceName: "Registrado",
        totalPrice: 85.00,
        currency: "MXN",
        estimatedDays: 5,
    },
];

// ---------------------------------------------------------------------------
// COTIZAR ENVÍO
// ---------------------------------------------------------------------------

export async function getShippingQuotes(
    origin: Address,
    destination: Address,
    parcel: ParcelDimensions
): Promise<{ success: boolean; rates: ShippingRate[]; error?: string }> {
    // Si no hay API key, devolver datos mock
    if (!SKYDROPX_API_KEY) {
        console.warn("[Skydropx] No API key configured, returning mock rates");
        return {
            success: true,
            rates: MOCK_RATES.map(rate => ({
                ...rate,
                // Varía ligeramente el precio para parecer real
                totalPrice: Math.round(rate.totalPrice * (0.9 + Math.random() * 0.2) * 100) / 100,
            })),
        };
    }

    try {
        const response = await fetch(`${SKYDROPX_API_URL}/quotations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token token=${SKYDROPX_API_KEY}`,
            },
            body: JSON.stringify({
                zip_from: origin.zip,
                zip_to: destination.zip,
                parcel: {
                    weight: parcel.weight,
                    height: parcel.height,
                    width: parcel.width,
                    length: parcel.length,
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("[Skydropx] Quotation error:", errorData);
            return { success: false, rates: [], error: "No se pudieron obtener cotizaciones de envío." };
        }

        const data = await response.json();
        const quotationId = data.data?.id || data.id;

        const rates: ShippingRate[] = (data.included || [])
            .filter((item: any) => item.type === "rates")
            .map((rate: any) => ({
                rateId: rate.id,
                quotationId: quotationId,
                carrier: rate.attributes?.provider || "Desconocido",
                serviceName: rate.attributes?.service_level_name || "Estándar",
                totalPrice: parseFloat(rate.attributes?.total_pricing || "0"),
                currency: rate.attributes?.currency || "MXN",
                estimatedDays: parseInt(rate.attributes?.days || "3", 10),
            }));

        return { success: true, rates };
    } catch (error) {
        console.error("[Skydropx] Error fetching quotes:", error);
        return { success: false, rates: [], error: "Error de conexión con el servicio de envíos." };
    }
}

// ---------------------------------------------------------------------------
// CREAR ENVÍO / GENERAR GUÍA
// ---------------------------------------------------------------------------

export async function createSkydropxShipment(
    origin: Address,
    destination: Address,
    parcel: ParcelDimensions,
    rateId: string,
    quotationId: string
): Promise<ShipmentResult> {
    // Modo mock
    if (!SKYDROPX_API_KEY) {
        console.warn("[Skydropx] No API key configured, returning mock shipment");
        const mockRate = MOCK_RATES.find(r => r.rateId === rateId) || MOCK_RATES[0];
        return {
            success: true,
            shipmentId: `mock_ship_${Date.now()}`,
            trackingNumber: `MX${Date.now().toString().slice(-10)}`,
            labelUrl: "https://via.placeholder.com/800x1100.png?text=Gu%C3%ADa+de+Env%C3%ADo+Mock",
            carrier: mockRate.carrier,
            serviceName: mockRate.serviceName,
        };
    }

    try {
        const response = await fetch(`${SKYDROPX_API_URL}/shipments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token token=${SKYDROPX_API_KEY}`,
            },
            body: JSON.stringify({
                quotation_id: quotationId,
                rate_id: rateId,
                address_from: {
                    name: origin.name,
                    phone: origin.phone,
                    street1: origin.street,
                    city: origin.city,
                    province: origin.state,
                    postal_code: origin.zip,
                    country_code: origin.country || "MX",
                },
                address_to: {
                    name: destination.name,
                    phone: destination.phone,
                    street1: destination.street,
                    city: destination.city,
                    province: destination.state,
                    postal_code: destination.zip,
                    country_code: destination.country || "MX",
                },
                parcels: [
                    {
                        weight: parcel.weight,
                        height: parcel.height,
                        width: parcel.width,
                        length: parcel.length,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("[Skydropx] Shipment error:", errorData);
            return { success: false, error: "No se pudo generar la guía de envío." };
        }

        const data = await response.json();

        // Extraer datos de la respuesta de Skydropx
        const shipmentData = data.data?.attributes || data.attributes || data;
        const label = (data.included || []).find((i: any) => i.type === "labels");

        return {
            success: true,
            shipmentId: data.data?.id || data.id,
            trackingNumber: shipmentData.tracking_number || label?.attributes?.tracking_number,
            labelUrl: label?.attributes?.label_url || shipmentData.label_url,
            carrier: shipmentData.carrier || "",
            serviceName: shipmentData.service_name || "",
        };
    } catch (error) {
        console.error("[Skydropx] Error creating shipment:", error);
        return { success: false, error: "Error de conexión al generar la guía." };
    }
}

// ---------------------------------------------------------------------------
// CONSULTAR TRACKING
// ---------------------------------------------------------------------------

export async function getTrackingInfo(skydropxShipmentId: string): Promise<{
    success: boolean;
    status?: string;
    lastEvent?: string;
    events?: { date: string; description: string; location?: string }[];
    error?: string;
}> {
    // Modo mock
    if (!SKYDROPX_API_KEY) {
        return {
            success: true,
            status: "IN_TRANSIT",
            lastEvent: "El paquete salió de la central de distribución.",
            events: [
                { date: new Date().toISOString(), description: "El paquete salió de la central de distribución.", location: "CDMX" },
                { date: new Date(Date.now() - 86400000).toISOString(), description: "Paquete recibido en bodega.", location: "Zapotlanejo, JAL" },
            ],
        };
    }

    try {
        const response = await fetch(`${SKYDROPX_API_URL}/shipments/${skydropxShipmentId}`, {
            method: "GET",
            headers: {
                Authorization: `Token token=${SKYDROPX_API_KEY}`,
            },
        });

        if (!response.ok) {
            return { success: false, error: "No se pudo consultar el estado del envío." };
        }

        const data = await response.json();
        const attrs = data.data?.attributes || {};

        return {
            success: true,
            status: attrs.status || "UNKNOWN",
            lastEvent: attrs.tracking_status || "",
            events: (attrs.tracking_history || []).map((e: any) => ({
                date: e.date,
                description: e.description,
                location: e.location,
            })),
        };
    } catch (error) {
        console.error("[Skydropx] Error fetching tracking:", error);
        return { success: false, error: "Error de conexión al consultar tracking." };
    }
}
