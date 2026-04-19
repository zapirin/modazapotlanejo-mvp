"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// login via API route
import Link from 'next/link';
import type { BrandConfig } from '@/lib/brand';

const COLOR_HEX: Record<string, string> = {
    blue: '#2563eb', violet: '#7c3aed', emerald: '#059669',
    amber: '#d97706', rose: '#e11d48', slate: '#475569',
    kalexa: '#8124E3',
};

export default function LoginClient({ brand }: { brand: BrandConfig }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const brandColor = COLOR_HEX[brand.primaryColor] || COLOR_HEX.blue;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        if (!email) {
            setError('Por favor, ingresa tu correo electrónico');
            setIsLoading(false);
            return;
        }
        const registeredDomain = brand.isSingleVendor ? brand.domain : undefined;
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, registeredDomain }),
        });
        const result = await res.json();
        if (result.success) {
            if (result.role === 'CASHIER') {
                setError('Los cajeros deben ingresar por el enlace específico de su tienda.');
                setIsLoading(false);
                await import('@/app/actions/auth').then(m => m.logout?.());
                return;
            }
            const destination = result.role === 'BUYER' ? '/orders' : '/dashboard';
            window.location.href = destination;
        } else {
            setError(result.error || 'Credenciales inválidas');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-card rounded-3xl shadow-xl overflow-hidden border border-border">
                {/* Header con color de marca */}
                <div className="p-8 text-center" style={{backgroundColor: brandColor}}>
                    {brand.logo?.url && (
                        <div className="flex justify-center mb-3">
                            <img src={brand.logo.url} alt={brand.name} className="h-12 object-contain" />
                        </div>
                    )}
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                        {brand.name}
                    </h2>
                    <p className="text-white/80 text-sm font-medium uppercase tracking-wider">
                        {brand.tagline || 'Acceso a tu Cuenta'}
                    </p>
                </div>

                <div className="p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 font-bold flex items-center gap-2">
                            <span className="text-lg">⚠️</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Correo Electrónico</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl focus:ring-2 outline-none text-foreground font-medium transition-all"
                                style={{'--tw-ring-color': brandColor} as any}
                                placeholder="ejemplo@tienda.com" required />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Contraseña / PIN</label>
                                <Link href="/forgot-password" className="text-xs font-bold transition-colors hover:underline"
                                    style={{color: brandColor}}>¿Olvidaste tu contraseña?</Link>
                            </div>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl focus:ring-2 outline-none text-foreground font-medium transition-all"
                                    placeholder="••••••••" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1">
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={isLoading}
                            className="w-full py-4 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{backgroundColor: brandColor}}>
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Ingresando...
                                </>
                            ) : 'Entrar'}
                        </button>
                    </form>

                    <div className="mt-8 text-center space-y-3">
                        <p className="text-sm text-gray-500">¿No tienes cuenta? <Link href="/register/buyer" className="font-bold transition-colors hover:underline" style={{color: brandColor}}>Regístrate aquí</Link></p>
                        <Link href="/" className="inline-block text-sm font-bold text-gray-400 hover:underline transition-colors">← Volver a {brand.name}</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
