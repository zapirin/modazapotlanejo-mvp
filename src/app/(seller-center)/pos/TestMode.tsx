"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getPosTestMode, setPosTestMode as setPosTestModeAction } from "./actions";

const CACHE_KEY = "pos_test_mode_cache";

// Cache local del flag — solo para evitar parpadeo del banner mientras llega el fetch del servidor.
// La fuente de verdad es la base de datos (User.posTestMode del seller).
function readCache(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CACHE_KEY) === "true";
}

function writeCache(active: boolean) {
    if (typeof window === "undefined") return;
    if (active) window.localStorage.setItem(CACHE_KEY, "true");
    else window.localStorage.removeItem(CACHE_KEY);
}

// Lectura sincrónica para acciones del POS que necesitan decidir entre fake* y real.
// Devuelve el último valor cacheado del servidor.
export function isTestModeActive(): boolean {
    return readCache();
}

export function useTestMode(): [boolean, (active: boolean) => Promise<void>, boolean] {
    const [active, setActive] = useState<boolean>(readCache());
    const [loading, setLoading] = useState(false);
    const mounted = useRef(true);

    const refresh = useCallback(async () => {
        try {
            const res = await getPosTestMode();
            if (!mounted.current) return;
            writeCache(res.active);
            setActive(res.active);
            window.dispatchEvent(new Event("pos_test_mode_change"));
        } catch {
            // silencio: dejamos el cache
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        refresh();
        const onFocus = () => refresh();
        const onChange = () => setActive(readCache());
        window.addEventListener("focus", onFocus);
        window.addEventListener("pos_test_mode_change", onChange);
        window.addEventListener("storage", onChange);
        const interval = setInterval(refresh, 60000);
        return () => {
            mounted.current = false;
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("pos_test_mode_change", onChange);
            window.removeEventListener("storage", onChange);
            clearInterval(interval);
        };
    }, [refresh]);

    const toggle = useCallback(async (value: boolean) => {
        setLoading(true);
        try {
            const res = await setPosTestModeAction(value);
            if (res.success) {
                writeCache(value);
                setActive(value);
                window.dispatchEvent(new Event("pos_test_mode_change"));
            } else {
                throw new Error(res.error || "Error");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    return [active, toggle, loading];
}

let testCounter = 1;
function nextTestNumber() {
    return testCounter++;
}

export function fakeSaleResult() {
    const n = nextTestNumber();
    return {
        success: true as const,
        saleId: `TEST-${Date.now()}-${n}`,
        receiptNumber: `T${n.toString().padStart(4, "0")}`,
    };
}

export function fakeOk() {
    return { success: true as const };
}

export function fakeSession(locationId?: string | null) {
    return {
        success: true as const,
        session: {
            id: `TEST-SESSION-${Date.now()}`,
            openingBalance: 0,
            locationId: locationId || null,
            createdAt: new Date(),
            movements: [],
            sales: [],
        },
    };
}

export function fakeTransfer() {
    return {
        success: true as const,
        transferId: `TEST-TRANSFER-${Date.now()}`,
    };
}

// ── UI ────────────────────────────────────────────────────────────────────────

export function TestModeBanner() {
    const [active] = useTestMode();
    if (!active) return null;
    return (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-1.5 px-4 text-xs font-black uppercase tracking-widest shadow-lg">
            🧪 Modo Prueba activo — ninguna venta, traspaso ni movimiento de caja se guardará
        </div>
    );
}
