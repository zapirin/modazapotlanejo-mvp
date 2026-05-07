"use client";

import React, { useState, useEffect, useCallback } from "react";

const KEY = "pos_test_mode";

export function isTestModeActive(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "true";
}

export function setTestModeActive(active: boolean) {
    if (typeof window === "undefined") return;
    if (active) window.localStorage.setItem(KEY, "true");
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("pos_test_mode_change"));
}

export function useTestMode(): [boolean, (active: boolean) => void] {
    const [active, setActive] = useState(false);
    useEffect(() => {
        setActive(isTestModeActive());
        const handler = () => setActive(isTestModeActive());
        window.addEventListener("pos_test_mode_change", handler);
        window.addEventListener("storage", handler);
        return () => {
            window.removeEventListener("pos_test_mode_change", handler);
            window.removeEventListener("storage", handler);
        };
    }, []);
    const toggle = useCallback((value: boolean) => setTestModeActive(value), []);
    return [active, toggle];
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

export function TestModeToggleButton() {
    const [active, setActive] = useTestMode();
    const handleClick = () => {
        if (!active) {
            const ok = window.confirm(
                "¿Activar Modo Prueba?\n\nMientras esté activo, las ventas, traspasos y movimientos de caja NO se guardarán en la base de datos. Útil para entrenamiento.\n\nApágalo cuando termines para volver a operar normal."
            );
            if (ok) setActive(true);
        } else {
            setActive(false);
        }
    };
    return (
        <button
            onClick={handleClick}
            title={active ? "Desactivar Modo Prueba" : "Activar Modo Prueba (entrenamiento)"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                active
                    ? "bg-amber-500 text-white shadow-md hover:bg-amber-600"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
        >
            🧪 {active ? "Modo Prueba ON" : "Modo Prueba"}
        </button>
    );
}
