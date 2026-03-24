"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../actions/auth';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        // Basic validation
        if (!email) {
            setError('Por favor, ingresa tu correo electrónico');
            setIsLoading(false);
            return;
        }

        const result = await login(email, password);

        if (result.success) {
            // Cajeros NO pueden entrar por el login general
            if (result.role === 'CASHIER') {
                setError('Los cajeros deben ingresar por el enlace específico de su tienda.');
                setIsLoading(false);
                // Cerrar la sesión que se acaba de abrir
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
                <div className="p-8 text-center bg-blue-600">
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Moda<span className="text-blue-200">Zapotlanejo</span>
                    </h2>
                    <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Acceso a tu Cuenta</p>
                </div>
                
                <div className="p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 font-bold flex items-center gap-2">
                            <span className="text-lg">⚠️</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Correo Electrónico (Usuario)</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-foreground font-medium transition-all"
                                placeholder="ejemplo@tienda.com"
                                required
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Contraseña / PIN</label>
                                <Link href="/forgot-password" className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">¿Olvidaste tu contraseña?</Link>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-foreground font-medium transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-4 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/20'}`}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Ingresando...
                                </>
                            ) : 'Entrar'}
                        </button>
                    </form>

                    <div className="mt-8 text-center space-y-3">
                        <p className="text-sm text-gray-500">¿No tienes cuenta? <Link href="/register/buyer" className="font-bold text-blue-600 hover:text-blue-700 transition-colors">Regístrate aquí</Link></p>
                        <Link href="/" className="inline-block text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors">← Volver al Marketplace</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
