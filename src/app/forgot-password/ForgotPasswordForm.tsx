"use client";

import { useState } from 'react';
import { requestPasswordReset } from '../actions/auth';
import Link from 'next/link';

export default function ForgotPasswordForm() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setMessage('');

        const result = await requestPasswordReset(email);

        if (result.success) {
            setMessage('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en unos momentos.');
        } else {
            setError(result.error || 'Hubo un error al procesar tu solicitud');
        }
        setIsLoading(false);
    };

    return (
        <>
            {message && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl border border-green-200 font-bold flex items-center gap-2">
                    <span className="text-lg">✅</span> {message}
                </div>
            )}

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 font-bold flex items-center gap-2">
                    <span className="text-lg">⚠️</span> {error}
                </div>
            )}

            {!message && (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Correo Electrónico</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-foreground font-medium transition-all"
                            placeholder="ejemplo@tienda.com"
                            required
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
                                Enviando...
                            </>
                        ) : 'Enviar Enlace'}
                    </button>
                </form>
            )}

            <div className="mt-8 text-center">
                <Link href="/login" className="inline-block text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors">← Volver al Login</Link>
            </div>
        </>
    );
}
