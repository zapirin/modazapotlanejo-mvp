"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { loginCashierForPOS } from './actions';

export default function POSLoginClient({
    seller,
    sellerSlug,
}: {
    seller: any;
    sellerSlug: string;
}) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const res = await loginCashierForPOS(email, password, sellerSlug);

        if (res.success) {
            // Forzar recarga completa para que el servidor reconozca la nueva sesión
            window.location.href = '/pos';
        } else {
            setError(res.error || 'Error al iniciar sesión');
            setLoading(false);
        }
    };

    const storeName = seller.businessName || seller.name;

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm space-y-8">
                {/* Logo y nombre de la tienda */}
                <div className="text-center space-y-4">
                    <div className="flex justify-center">
                        {seller.logoUrl ? (
                            <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl bg-white/5">
                                <Image
                                    src={seller.logoUrl}
                                    alt={storeName}
                                    width={96}
                                    height={96}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-4xl font-black shadow-2xl border-2 border-white/10">
                                {storeName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">{storeName}</h1>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Punto de Venta</p>
                    </div>
                </div>

                {/* Formulario de login */}
                <div className="bg-gray-900 rounded-3xl border border-white/10 p-8 shadow-2xl space-y-5">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm font-bold text-red-400 text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                Correo
                            </label>
                            <input
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                placeholder="cajero@correo.com"
                                className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-white font-bold placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-white font-bold placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black uppercase tracking-widest text-sm transition shadow-xl shadow-blue-500/20 mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                                    Entrando...
                                </span>
                            ) : 'Abrir Caja'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                    Acceso exclusivo para personal autorizado
                </p>
            </div>
        </div>
    );
}
