"use client";

import React, { useState, useEffect } from 'react';

export default function CustomerDisplayPage() {
    const [data, setData] = useState<any>(null);
    const [time, setTime] = useState('');

    useEffect(() => {
        // Actualizar hora
        const tick = () => setTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
        tick();
        const timer = setInterval(tick, 1000);

        // Escuchar mensajes del POS via BroadcastChannel
        const channel = new BroadcastChannel('pos_customer_display');
        channel.onmessage = (e) => {
            if (e.data?.type === 'POS_SALE') setData(e.data.payload);
            if (e.data?.type === 'POS_CLEAR') setData(null);
        };

        // Fallback: también escuchar postMessage para compatibilidad
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'POS_SALE') setData(e.data.payload);
            if (e.data?.type === 'POS_CLEAR') setData(null);
        };
        window.addEventListener('message', handler);

        return () => {
            clearInterval(timer);
            channel.close();
            window.removeEventListener('message', handler);
        };
    }, []);

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const welcomeMsg = params?.get('msg') || '¡Bienvenido!';

    // Calcular subtotal desde los items (siempre confiable)
    const itemsSubtotal = data?.items?.reduce((acc: number, item: any) => acc + (item.qty * item.price), 0) || 0;
    // Usar subtotal del broadcast si existe, sino calcular desde items
    const subtotal = data?.subtotal ?? itemsSubtotal;
    const total = data?.total || 0;
    const hasDiscount = subtotal > 0 && total < subtotal;
    const savedAmount = hasDiscount ? subtotal - total : 0;

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-4 bg-gray-900 border-b border-gray-800">
                <p className="text-2xl font-black tracking-tight">🛍️ Moda Zapotlanejo</p>
                <p className="text-gray-400 font-mono text-xl">{time}</p>
            </div>

            {data ? (
                // Vista de venta activa
                <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                    <div className="w-full max-w-lg space-y-4">
                        {/* Items */}
                        <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                            {data.items?.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between items-center py-2.5 border-b border-gray-800/60">
                                    <div className="min-w-0 flex-1 mr-4">
                                        <p className="font-bold text-base truncate">{item.name}</p>
                                        <p className="text-gray-500 text-sm">{item.qty} × ${item.price?.toFixed(2)}</p>
                                    </div>
                                    <p className="font-black text-lg shrink-0">${(item.qty * item.price)?.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>

                        {/* Desglose de precios — solo si hay descuento */}
                        {hasDiscount && (
                            <div className="space-y-2 pt-2 border-t border-gray-800">
                                {/* Subtotal */}
                                <div className="flex justify-between items-center text-gray-400">
                                    <span className="text-sm font-bold uppercase tracking-wider">Subtotal</span>
                                    <span className="text-lg font-bold">${subtotal.toFixed(2)}</span>
                                </div>

                                {/* Nivel de precio */}
                                {data.tierName && (
                                    <div className="flex justify-between items-center text-amber-400">
                                        <span className="text-sm font-bold flex items-center gap-2">
                                            ⭐ {data.tierName}
                                        </span>
                                        <span className="text-sm font-bold">Aplicado</span>
                                    </div>
                                )}

                                {/* Descuento manual */}
                                {data.discount && (
                                    <div className="flex justify-between items-center text-rose-400">
                                        <span className="text-sm font-bold flex items-center gap-2">
                                            🏷️ Descuento {data.discount.type === 'percent' ? `${data.discount.value}%` : 'especial'}
                                        </span>
                                        {data.discount.type === 'fixed' && (
                                            <span className="text-sm font-bold">-${data.discount.value?.toFixed(2)}</span>
                                        )}
                                    </div>
                                )}

                                {/* Ahorro total */}
                                <div className="flex justify-between items-center text-emerald-400 bg-emerald-900/20 border border-emerald-800/40 rounded-xl px-4 py-2.5">
                                    <span className="text-sm font-black uppercase tracking-wider">Usted ahorra</span>
                                    <span className="text-xl font-black">-${savedAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* Total */}
                        <div className="bg-blue-600 rounded-3xl p-6 text-center">
                            <p className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-1">Total a pagar</p>
                            <p className="text-7xl font-black">${total.toFixed(2)}</p>
                        </div>

                        {data.payment && (
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="bg-gray-800 rounded-2xl p-4">
                                    <p className="text-gray-400 text-xs font-bold mb-1">Método</p>
                                    <p className="font-black text-lg">{data.payment}</p>
                                </div>
                                {data.change > 0 && (
                                    <div className="bg-emerald-900/50 border border-emerald-700 rounded-2xl p-4">
                                        <p className="text-emerald-400 text-xs font-bold mb-1">Cambio</p>
                                        <p className="font-black text-2xl text-emerald-400">${data.change?.toFixed(2)}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // Vista de espera
                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                    <p className="text-8xl">🛍️</p>
                    <p className="text-5xl font-black tracking-tight text-center">{welcomeMsg}</p>
                    <p className="text-gray-500 text-xl">Gracias por su preferencia</p>
                </div>
            )}
        </div>
    );
}
