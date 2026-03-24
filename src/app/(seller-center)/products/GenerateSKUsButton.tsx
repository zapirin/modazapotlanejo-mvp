"use client";

import { useState } from 'react';
import { generateMissingSKUs } from './new/actions';

export default function GenerateSKUsButton({ missingCount }: { missingCount: number }) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ updated: number; error?: string } | null>(null);

    const handleGenerate = async () => {
        if (missingCount === 0) return;
        if (!confirm(`¿Generar SKU automático para ${missingCount} producto${missingCount > 1 ? 's' : ''} sin SKU? Podrás editarlos individualmente después.`)) return;
        setLoading(true);
        setResult(null);
        const res = await generateMissingSKUs();
        setResult({ updated: res.updated, error: res.success ? undefined : res.error });
        setLoading(false);
        if (res.success && res.updated > 0) {
            setTimeout(() => window.location.reload(), 1500);
        }
    };

    return (
        <div className="flex items-center gap-3">
            {result && (
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${result.error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                    {result.error ? `Error: ${result.error}` : `✅ ${result.updated} SKU${result.updated !== 1 ? 's' : ''} generado${result.updated !== 1 ? 's' : ''}`}
                </span>
            )}
            {missingCount > 0 && (
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-lg transition text-sm flex items-center gap-2 shadow-md"
                >
                    {loading ? (
                        <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Generando...
                        </>
                    ) : (
                        <>🏷️ Generar SKUs ({missingCount})</>
                    )}
                </button>
            )}
        </div>
    );
}
