"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getProductStockEntries, cancelStockEntry } from './actions';

export default function ProductStockEntriesModal({
    productId,
    productName,
    canCancel,
    onClose,
    onChanged,
}: {
    productId: string;
    productName: string;
    canCancel: boolean;
    onClose: () => void;
    onChanged?: () => void;
}) {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getProductStockEntries(productId);
        setEntries(res.entries || []);
        setLoadError(res.success ? null : (res.error || 'No se pudo cargar el historial.'));
        setLoading(false);
    }, [productId]);

    useEffect(() => { load(); }, [load]);

    const activeTotal = entries
        .filter(e => e.status === 'ACTIVE')
        .reduce((s, e) => s + e.totalItems, 0);

    const handleCancel = async (entry: any) => {
        if (!confirm(`¿Cancelar la entrada ${entry.folio}? Se van a restar ${entry.totalItems} piezas del inventario.`)) return;
        setCancelling(entry.id);
        const res = await cancelStockEntry(entry.id);
        if (res.success) { toast.success('Entrada cancelada'); load(); onChanged?.(); }
        else toast.error(res.error || 'No se pudo cancelar.');
        setCancelling(null);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div className="min-w-0">
                        <h3 className="text-xl font-black truncate">📦 Entradas de este Modelo</h3>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest truncate">{productName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-foreground text-2xl leading-none shrink-0">×</button>
                </div>

                <div className="p-6 overflow-y-auto space-y-2">
                    {loading && <p className="text-sm text-gray-400">Cargando…</p>}

                    {loadError && !loading && (
                        <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900">
                            <p className="font-black text-sm text-red-600 mb-1">No se pudo cargar el historial</p>
                            <p className="text-xs text-red-500">{loadError}</p>
                        </div>
                    )}

                    {!loading && !loadError && entries.length === 0 && (
                        <div className="border border-dashed border-border rounded-xl p-8 text-center">
                            <p className="font-bold mb-1">Sin entradas registradas</p>
                            <p className="text-xs text-gray-500">
                                Las entradas anteriores hechas con “Ajustar Stock” no aparecen aquí: el historial arranca desde ahora.
                            </p>
                        </div>
                    )}

                    {entries.map(entry => (
                        <div key={entry.id} className="border border-border rounded-xl overflow-hidden">
                            <button
                                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                                className="w-full text-left p-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className={`font-black text-sm ${entry.status === 'CANCELLED' ? 'line-through text-gray-400' : ''}`}>
                                        {entry.folio} · {new Date(entry.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest truncate">
                                        {entry.locationName}{entry.userName ? ` · ${entry.userName}` : ''}
                                    </p>
                                </div>
                                {entry.status === 'CANCELLED' ? (
                                    <span className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-wide shrink-0">Cancelada</span>
                                ) : (
                                    <span className="font-black text-emerald-600 shrink-0">+{entry.totalItems}</span>
                                )}
                                <span className="text-gray-400 shrink-0">{expanded === entry.id ? '▾' : '▸'}</span>
                            </button>

                            {expanded === entry.id && (
                                <div className="px-3 pb-3 pt-2 border-t border-border space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                        {entry.items.map((it: any) => (
                                            <span key={it.id} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">
                                                {it.variantInfo || 'Única'}: {it.quantity}
                                            </span>
                                        ))}
                                    </div>
                                    {entry.notes && <p className="text-[11px] text-gray-500 font-medium">Nota: {entry.notes}</p>}
                                    {entry.status === 'CANCELLED' && (
                                        <p className="text-[11px] text-red-500 font-bold">
                                            Cancelada el {new Date(entry.cancelledAt).toLocaleDateString('es-MX')}
                                            {entry.cancelledByName ? ` por ${entry.cancelledByName}` : ''}
                                        </p>
                                    )}
                                    {canCancel && entry.status === 'ACTIVE' && (
                                        <button
                                            onClick={() => handleCancel(entry)}
                                            disabled={cancelling === entry.id}
                                            className="text-[11px] font-black text-red-500 hover:underline disabled:opacity-40"
                                        >
                                            Cancelar esta entrada
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-border flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Total ingresado</p>
                    <p className="font-black text-emerald-600">{activeTotal} piezas</p>
                </div>
            </div>
        </div>
    );
}
