"use server";

// ---------------------------------------------------------------------------
// SKYDROPX API CLIENT — v2 (pro.skydropx.com)
// Auth: OAuth 2.0 client_credentials → Bearer token (válido 2h, se cachea)
// Docs: https://pro.skydropx.com/mx/es-MX/api-docs
// ---------------------------------------------------------------------------

const SKYDROPX_API_URL       = "https://pro.skydropx.com/api/v1";
const SKYDROPX_CLIENT_ID     = process.env.SKYDROPX_API_KEY    || "";   // clave pública
const SKYDROPX_CLIENT_SECRET = process.env.SKYDROPX_API_SECRET || "";   // clave secreta

// Paqueterías permitidas — leer de .env (separadas por coma, en minúsculas)
// Ejemplo en .env: SKYDROPX_CARRIERS=estafeta,dhl,fedex,paquetexpress
// Si la variable está vacía, se muestran TODAS las que tengan precio
const ALLOWED_CARRIERS: string[] = (process.env.SKYDROPX_CARRIERS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

// ── Token cache (módulo — vive mientras el proceso PM2 esté corriendo) ──
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    // Devolver token cacheado si aún es válido (con 60s de margen)
    if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) {
        return _tokenCache.token;
    }

    const res = await fetch(`${SKYDROPX_API_URL}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type:    "client_credentials",
            client_id:     SKYDROPX_CLIENT_ID,
            client_secret: SKYDROPX_CLIENT_SECRET,
        }),
        cache: "no-store",
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`[Skydropx] Auth error ${res.status}: ${body}`);
    }

    const data = await res.json();
    _tokenCache = {
        token:     data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };

    console.log("[Skydropx] Token obtenido, expira en", data.expires_in, "s");
    return _tokenCache.token;
}

/** Devuelve el header Authorization con Bearer token actualizado */
async function authHeader(): Promise<Record<string, string>> {
    const token = await getAccessToken();
    return {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
    };
}

/** ¿Están configuradas ambas credenciales? */
function isConfigured(): boolean {
    return Boolean(SKYDROPX_CLIENT_ID && SKYDROPX_CLIENT_SECRET);
}

// ---------------------------------------------------------------------------
// INTERFACES PÚBLICAS
// ---------------------------------------------------------------------------

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
    width:  number;   // cm
    length: number;   // cm
}

export interface ShippingRate {
    rateId:       string;
    quotationId:  string;
    carrier:      string;
    carrierLogo?: string;
    serviceName:  string;
    totalPrice:   number;
    currency:     string;
    estimatedDays: number;
}

export interface ShipmentResult {
    success:        boolean;
    shipmentId?:    string;
    trackingNumber?: string;
    labelUrl?:      string;
    carrier?:       string;
    serviceName?:   string;
    error?:         string;
}

// ---------------------------------------------------------------------------
// MOCK DATA — fallback cuando no hay credenciales o falla la API
// ---------------------------------------------------------------------------

const MOCK_RATES: ShippingRate[] = [
    { rateId: "mock_1", quotationId: "mock_q", carrier: "FedEx",    serviceName: "FedEx Express",        totalPrice: 185, currency: "MXN", estimatedDays: 1 },
    { rateId: "mock_2", quotationId: "mock_q", carrier: "Estafeta", serviceName: "Estafeta Día Siguiente", totalPrice: 145, currency: "MXN", estimatedDays: 2 },
    { rateId: "mock_3", quotationId: "mock_q", carrier: "DHL",      serviceName: "DHL Express",           totalPrice: 220, currency: "MXN", estimatedDays: 1 },
];

function mockRates(): ShippingRate[] {
    return MOCK_RATES.map(r => ({
        ...r,
        totalPrice: Math.round(r.totalPrice * (0.9 + Math.random() * 0.2) * 100) / 100,
    }));
}

// ---------------------------------------------------------------------------
// COTIZAR ENVÍO
// ---------------------------------------------------------------------------

export async function getShippingQuotes(
    origin:      Address,
    destination: Address,
    parcel:      ParcelDimensions
): Promise<{ success: boolean; rates: ShippingRate[]; error?: string }> {

    if (!isConfigured()) {
        console.warn("[Skydropx] Credenciales no configuradas — usando cotizaciones mock");
        return { success: true, rates: mockRates() };
    }

    try {
        const headers = await authHeader();

        // PASO 1 — Crear la cotización
        const postRes = await fetch(`${SKYDROPX_API_URL}/quotations`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                quotation: {
                    address_from: {
                        postal_code:  origin.zip,
                        country_code: origin.country || "MX",
                        street1:      origin.street.slice(0, 45),
                        area_level1:  origin.state,
                        area_level2:  origin.city,
                        area_level3:  origin.colonia || origin.city,
                    },
                    address_to: {
                        postal_code:  destination.zip,
                        country_code: destination.country || "MX",
                        street1:      destination.street.slice(0, 45),
                        area_level1:  destination.state,
                        area_level2:  destination.city,
                        area_level3:  destination.colonia || destination.city,
                    },
                    parcels: [{
                        weight: parcel.weight,
                        height: parcel.height,
                        width:  parcel.width,
                        length: parcel.length,
                    }],
                },
            }),
            cache: "no-store",
        });

        if (!postRes.ok) {
            const errorBody = await postRes.text();
            console.error("[Skydropx] Quotation POST error:", postRes.status, errorBody);
            if (postRes.status === 401 || postRes.status === 403) _tokenCache = null;
            console.warn("[Skydropx] Fallback a mock por error", postRes.status);
            return { success: true, rates: mockRates() };
        }

        const postData = await postRes.json();
        const quotationId: string = postData?.id ?? "";
        console.log("[Skydropx] Cotización creada:", quotationId);

        // PASO 2 — Esperar 3s y consultar la cotización completada
        // (Skydropx procesa las tarifas de forma asíncrona)
        await new Promise(r => setTimeout(r, 3000));

        const getRes = await fetch(`${SKYDROPX_API_URL}/quotations/${quotationId}`, {
            method: "GET",
            headers: await authHeader(),
            cache: "no-store",
        });

        const data = getRes.ok ? await getRes.json() : postData;
        console.log("[Skydropx] Quotation rates count:", data?.rates?.length ?? 0);

        // PASO 3 — Parsear tarifas (formato real: data.rates[], campos planos)
        const EXCLUDED_CARRIERS = ["correos de méxico", "correos de mexico", "sepomex"];

        const rates: ShippingRate[] = (data?.rates ?? [])
            .filter((r: any) => r.total != null && parseFloat(r.total) > 0)
            .map((r: any) => ({
                rateId:        String(r.id ?? ""),
                quotationId,
                carrier:       r.provider_display_name ?? r.provider_name ?? "Desconocido",
                serviceName:   r.provider_service_name ?? "Estándar",
                totalPrice:    parseFloat(r.total ?? "0"),
                currency:      r.currency_code ?? "MXN",
                estimatedDays: parseInt(r.days ?? "3", 10),
            }))
            .filter((r: ShippingRate) => {
                if (!r.rateId) return false;
                const carrierLower = r.carrier.toLowerCase();
                if (EXCLUDED_CARRIERS.includes(carrierLower)) return false;
                if (ALLOWED_CARRIERS.length > 0) {
                    return ALLOWED_CARRIERS.some(a => carrierLower.includes(a));
                }
                return true;
            });

        if (rates.length === 0) {
            console.warn("[Skydropx] Sin tarifas disponibles, usando mock");
            return { success: true, rates: mockRates() };
        }

        console.log("[Skydropx] Tarifas reales devueltas:", rates.length);
        return { success: true, rates };

    } catch (error: any) {
        console.error("[Skydropx] Error en cotización:", error?.message || error);
        return { success: false, rates: [], error: "Error de conexión con el servicio de envíos." };
    }
}

// ---------------------------------------------------------------------------
// CREAR ENVÍO / GENERAR GUÍA
// ---------------------------------------------------------------------------

export async function createSkydropxShipment(
    origin:      Address,
    destination: Address,
    parcel:      ParcelDimensions,
    rateId:      string,
    quotationId: string
): Promise<ShipmentResult> {

    if (!isConfigured()) {
        console.warn("[Skydropx] Credenciales no configuradas — usando envío mock");
        const mockRate = MOCK_RATES[0];
        return {
            success:        true,
            shipmentId:     `mock_ship_${Date.now()}`,
            trackingNumber: `MX${Date.now().toString().slice(-10)}`,
            labelUrl:       "https://via.placeholder.com/800x1100.png?text=Guia+Mock",
            carrier:        mockRate.carrier,
            serviceName:    mockRate.serviceName,
        };
    }

    try {
        const headers = await authHeader();

        const response = await fetch(`${SKYDROPX_API_URL}/shipments`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                shipment: {
                    quotation_id: quotationId,
                    rate_id:      rateId,
                    address_from: {
                        name:         origin.name,
                        phone:        origin.phone,
                        street1:      origin.street.slice(0, 45),
                        area_level1:  origin.state,
                        area_level2:  origin.city,
                        area_level3:  origin.colonia || origin.city,
                        postal_code:  origin.zip,
                        country_code: origin.country || "MX",
                    },
                    address_to: {
                        name:         destination.name,
                        phone:        destination.phone,
                        street1:      destination.street.slice(0, 45),
                        area_level1:  destination.state,
                        area_level2:  destination.city,
                        area_level3:  destination.colonia || destination.city,
                        postal_code:  destination.zip,
                        country_code: destination.country || "MX",
                    },
                    parcels: [{
                        weight: parcel.weight,
                        height: parcel.height,
                        width:  parcel.width,
                        length: parcel.length,
                    }],
                    products: [{ name: "Paquete de ropa", quantity: 1 }],
                },
            }),
            cache: "no-store",
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("[Skydropx] Shipment error:", response.status, errorBody);
            return { success: false, error: "No se pudo generar la guía de envío." };
        }

        const data = await response.json();
        console.log("[Skydropx] Shipment raw:", JSON.stringify(data).slice(0, 400));

        const attrs = data?.data?.attributes ?? data?.shipment ?? data?.data ?? data;
        const label = (data?.included || []).find((i: any) => i.type === "labels");

        return {
            success:        true,
            shipmentId:     String(data?.data?.id ?? data?.id ?? ""),
            trackingNumber: attrs?.tracking_number ?? label?.attributes?.tracking_number ?? "",
            labelUrl:       label?.attributes?.label_url ?? attrs?.label_url ?? "",
            carrier:        attrs?.carrier         ?? "",
            serviceName:    attrs?.service_name    ?? "",
        };

    } catch (error: any) {
        console.error("[Skydropx] Error en shipment:", error?.message || error);
        return { success: false, error: "Error de conexión al generar la guía." };
    }
}

// ---------------------------------------------------------------------------
// CONSULTAR TRACKING
// ---------------------------------------------------------------------------

export async function getTrackingInfo(
    trackingNumberOrShipmentId: string,
    carrier?: string
): Promise<{
    success:    boolean;
    status?:    string;
    lastEvent?: string;
    events?:    { date: string; description: string; location?: string }[];
    error?:     string;
}> {

    if (!isConfigured()) {
        return {
            success:   true,
            status:    "IN_TRANSIT",
            lastEvent: "El paquete salió de la central de distribución.",
            events: [
                { date: new Date().toISOString(),                         description: "El paquete salió de la central de distribución.", location: "CDMX" },
                { date: new Date(Date.now() - 86400000).toISOString(),    description: "Paquete recibido en bodega.",                    location: "Zapotlanejo, JAL" },
            ],
        };
    }

    try {
        const headers = await authHeader();

        // Nueva API: GET /shipments/tracking/{tracking_number}/{carrier_name}
        // Si no hay carrier, intentar con el endpoint de shipment por ID (legado)
        const url = carrier
            ? `${SKYDROPX_API_URL}/shipments/tracking/${trackingNumberOrShipmentId}/${carrier}`
            : `${SKYDROPX_API_URL}/shipments/${trackingNumberOrShipmentId}`;

        const response = await fetch(url, { method: "GET", headers, cache: "no-store" });

        if (!response.ok) {
            return { success: false, error: "No se pudo consultar el estado del envío." };
        }

        const data = await response.json();
        const attrs = data?.data?.attributes ?? data?.shipment ?? data;

        return {
            success:   true,
            status:    attrs?.status        ?? attrs?.tracking_status ?? "UNKNOWN",
            lastEvent: attrs?.last_event    ?? attrs?.tracking_status ?? "",
            events:    (attrs?.tracking_history || attrs?.events || []).map((e: any) => ({
                date:        e.date        ?? e.created_at ?? "",
                description: e.description ?? e.message    ?? "",
                location:    e.location    ?? "",
            })),
        };

    } catch (error: any) {
        console.error("[Skydropx] Error en tracking:", error?.message || error);
        return { success: false, error: "Error de conexión al consultar tracking." };
    }
}
