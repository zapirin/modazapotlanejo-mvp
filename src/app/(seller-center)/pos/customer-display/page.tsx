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

        // Escuchar mensajes del POS
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'POS_SALE') setData(e.data.payload);
            if (e.data?.type === 'POS_CLEAR') setData(null);
        };
        window.addEventListener('message', handler);
        return () => { clearInterval(timer); window.removeEventListener('message', handler); };
    }, []);

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const welcomeMsg = params?.get('msg') || '¡Bienvenido!';

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-4 bg-gray-900 border-b border-gray-800">
                <p className="text-2xl font-black tracking-tight">🛍️ Moda Zapotlanejo</p>
                <p className="text-gray-400 font-mono text-xl">{time}</p>
            </div>

            {data ? (
                // Vista de venta activa
                <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
                    <div className="w-full max-w-lg space-y-4">
                        {/* Items */}
                        <div className="space-y-2">
                            {data.items?.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between items-center py-3 border-b border-gray-800">
                                    <div>
                                        <p className="font-bold text-lg">{item.name}</p>
                                        <p className="text-gray-400 text-sm">{item.qty} x ${item.price?.toFixed(2)}</p>
                                    </div>
                                    <p className="font-black text-xl">${(item.qty * item.price)?.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>

                        {/* Total */}
                        <div className="bg-blue-600 rounded-3xl p-6 text-center">
                            <p className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-1">Total a pagar</p>
                            <p className="text-7xl font-black">${data.total?.toFixed(2)}</p>
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
