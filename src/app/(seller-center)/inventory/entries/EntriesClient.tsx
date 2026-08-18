"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getStockEntries, cancelStockEntry, getEntryLocations, getEntrySuppliers } from './actions';

export default function EntriesClient({ canCancel }: { canCancel: boolean }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [locations, setLocations] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [locationId, setLocationId] = useState('');
    const [supplierId, setSupplierId] = useState('');

    const [expanded, setExpanded] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getStockEntries({ from, to, locationId, supplierId, page });
        setRows(res.rows || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setLoadError(res.success ? null : (res.error || 'No se pudieron cargar las entradas.'));
        setLoading(false);
    }, [from, to, locationId, supplierId, page]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        getEntryLocations().then(setLocations);
        getEntrySuppliers().then(setSuppliers);
    }, []);

    const handleCancel = async (entry: any) => {
        if (!confirm(`¿Cancelar la entrada ${entry.folio}? Se van a restar ${entry.totalItems} piezas del inventario.`)) return;
        setCancelling(entry.id);
        const res = await cancelStockEntry(entry.id);
        if (res.success) { toast.success('Entrada cancelada'); load(); }
        else toast.error(res.error || 'No se pudo cancelar.');
        setCancelling(null);
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black">📥 Entradas de Mercancía</h1>
                    <p className="text-xs text-gray-400 font-medium">{total} entrada{total === 1 ? '' : 's'} registrada{total === 1 ? '' : 's'}</p>
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Desde</label>
                    <input type="date" value={from} onChange={e => { setPage(1); setFrom(e.target.value); }}
                        className="mt-1 w-full p-2 rounded-lg border border-border bg-transparent text-sm font-bold" />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Hasta</label>
                    <input type="date" value={to} onChange={e => { setPage(1); setTo(e.target.value); }}
                        className="mt-1 w-full p-2 rounded-lg border border-border bg-transparent text-sm font-bold" />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sucursal</label>
                    <select value={locationId} onChange={e => { setPage(1); setLocationId(e.target.value); }}
                        className="mt-1 w-full p-2 rounded-lg border border-border bg-transparent text-sm font-bold">
                        <option value="">Todas</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedor</label>
                    <select value={supplierId} onChange={e => { setPage(1); setSupplierId(e.target.value); }}
                        className="mt-1 w-full p-2 rounded-lg border border-border bg-transparent text-sm font-bold">
                        <option value="">Todos</option>
                        {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {loadError && !loading && (
                <div className="bg-card border border-red-200 dark:border-red-900 rounded-2xl p-6 mb-4">
                    <p className="font-black text-sm text-red-600 mb-1">No se pudieron cargar las entradas</p>
                    <p className="text-xs text-red-500">{loadError}</p>
                </div>
            )}

            {loading && <p className="text-sm text-gray-400">Cargando…</p>}

            {!loading && !loadError && rows.length === 0 && (
                <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
                    <div className="text-4xl mb-3">📥</div>
                    <h2 className="text-lg font-bold mb-1">Todavía no hay entradas registradas</h2>
                </div>
            )}

            <div className="space-y-2">
                {rows.map(entry => (
                    <div key={entry.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                            className="w-full text-left p-4 flex items-center gap-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <p className={`font-black text-sm truncate ${entry.status === 'CANCELLED' ? 'line-through text-gray-400' : ''}`}>
                                    {entry.productName}
                                </p>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest truncate">
                                    {entry.folio} · {new Date(entry.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · {entry.locationName}
                                    {entry.userName ? ` · ${entry.userName}` : ''}
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
                            <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                                <div className="flex flex-wrap gap-2">
                                    {entry.items.map((it: any) => (
                                        <span key={it.id} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">
                                            {it.variantInfo || 'Única'}: {it.quantity}
                                        </span>
                                    ))}
                                </div>
                                {entry.supplierName && <p className="text-[11px] text-gray-500 font-medium">Proveedor: {entry.supplierName}</p>}
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

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 border border-border rounded-xl text-xs font-black uppercase disabled:opacity-30">Anterior</button>
                    <span className="text-xs font-bold text-gray-500">{page} de {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 border border-border rounded-xl text-xs font-black uppercase disabled:opacity-30">Siguiente</button>
                </div>
            )}
        </div>
    );
}
