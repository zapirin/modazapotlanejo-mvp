"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CENTAVO } from '@/lib/money';
import { getPurchaseNotes, getPurchaseNote, cancelPurchaseNote, getPurchaseFormData } from './actions';
import PurchaseCart from './PurchaseCart';

const pesos = (n: number) =>
    `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fecha = (d: any) =>
    d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function PurchasesClient({ canCancel }: { canCancel: boolean }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [soloConSaldo, setSoloConSaldo] = useState(false);

    const [expanded, setExpanded] = useState<string | null>(null);
    const [detalles, setDetalles] = useState<Record<string, any>>({});
    const [cargandoDetalle, setCargandoDetalle] = useState<string | null>(null);
    const [cancelando, setCancelando] = useState<string | null>(null);
    const [carrito, setCarrito] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res: any = await getPurchaseNotes({ from, to, supplierId, soloConSaldo, page });
            setRows(res.rows || []);
            setTotal(res.total || 0);
            setTotalPages(res.totalPages || 1);
            setLoadError(res.success ? null : (res.error || 'No se pudieron cargar las compras.'));
        } catch (error: any) {
            console.error('Error al cargar las compras:', error);
            setRows([]);
            setLoadError('No se pudieron cargar las compras. Revisa tu conexión y vuelve a intentar.');
        } finally {
            setLoading(false);
        }
    }, [from, to, supplierId, soloConSaldo, page]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        getPurchaseFormData()
            .then((data: any) => setSuppliers(data?.suppliers || []))
            .catch((error: any) => {
                console.error('Error al cargar los proveedores:', error);
                toast.error('No se pudo cargar la lista de proveedores para filtrar.');
            });
    }, []);

    const abrir = async (nota: any) => {
        if (expanded === nota.id) { setExpanded(null); return; }
        setExpanded(nota.id);
        if (detalles[nota.id]) return;

        setCargandoDetalle(nota.id);
        try {
            const detalle = await getPurchaseNote(nota.id);
            if (detalle) setDetalles(prev => ({ ...prev, [nota.id]: detalle }));
            else toast.error('No se pudo cargar el detalle de esta compra.');
        } catch (error: any) {
            console.error('Error al cargar el detalle de la compra:', error);
            toast.error('No se pudo cargar el detalle. Revisa tu conexión.');
        } finally {
            setCargandoDetalle(null);
        }
    };

    const cancelar = async (nota: any) => {
        if (cancelando) return;
        if (!confirm(`¿Cancelar la compra ${nota.folio}? Se van a restar ${nota.totalItems} piezas del inventario.`)) return;

        setCancelando(nota.id);
        try {
            const res: any = await cancelPurchaseNote(nota.id);
            if (res?.success) {
                toast.success('Compra cancelada');
                setDetalles(prev => { const copia = { ...prev }; delete copia[nota.id]; return copia; });
                load();
            } else {
                toast.error(res?.error || 'No se pudo cancelar la compra.');
            }
        } catch (error: any) {
            console.error('Error al cancelar la compra:', error);
            toast.error('No se pudo cancelar. Revisa tu conexión y vuelve a intentar.');
        } finally {
            setCancelando(null);
        }
    };

    const estado = (n: any) => {
        if (n.status === 'CANCELLED') {
            return <span className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-wide">Cancelada</span>;
        }
        if (n.balance <= CENTAVO) {
            return <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wide">Pagada</span>;
        }
        const vencida = n.dueDate && new Date(n.dueDate).getTime() < Date.now();
        return (
            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide ${vencida ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {vencida ? 'Vencida' : 'Pendiente'}
            </span>
        );
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="min-w-0">
                    <h1 className="text-2xl font-black">🧾 Compras a Proveedor</h1>
                    <p className="text-xs text-gray-400 font-medium">{total} nota{total === 1 ? '' : 's'} registrada{total === 1 ? '' : 's'}</p>
                </div>
                <button
                    onClick={() => setCarrito(true)}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shrink-0"
                >
                    + Nueva compra
                </button>
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedor</label>
                    <select value={supplierId} onChange={e => { setPage(1); setSupplierId(e.target.value); }}
                        className="mt-1 w-full p-2 rounded-lg border border-border bg-transparent text-sm font-bold">
                        <option value="">Todos</option>
                        {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="flex items-end">
                    <label className="flex items-center gap-2 p-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={soloConSaldo}
                            onChange={e => { setPage(1); setSoloConSaldo(e.target.checked); }}
                            className="w-4 h-4"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Solo con saldo</span>
                    </label>
                </div>
            </div>

            {loadError && !loading && (
                <div className="bg-card border border-red-200 dark:border-red-900 rounded-2xl p-6 mb-4">
                    <p className="font-black text-sm text-red-600 mb-1">No se pudieron cargar las compras</p>
                    <p className="text-xs text-red-500">{loadError}</p>
                </div>
            )}

            {loading && <p className="text-sm text-gray-400">Cargando…</p>}

            {!loading && !loadError && rows.length === 0 && (
                <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
                    <div className="text-4xl mb-3">🧾</div>
                    <h2 className="text-lg font-bold mb-1">Todavía no hay compras registradas</h2>
                    <p className="text-xs text-gray-500">Registra la primera con “+ Nueva compra”.</p>
                </div>
            )}

            {rows.length > 0 && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    {['Folio', 'Fecha', 'Proveedor', 'Factura', 'Total', 'Abonado', 'Saldo', 'Vence', 'Estado', ''].map((h, i) => (
                                        <th key={i} className="p-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(n => {
                                    const detalle = detalles[n.id];
                                    return (
                                        <React.Fragment key={n.id}>
                                            <tr
                                                onClick={() => abrir(n)}
                                                className="border-b border-border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <td className={`p-3 font-black whitespace-nowrap ${n.status === 'CANCELLED' ? 'line-through text-gray-400' : ''}`}>{n.folio}</td>
                                                <td className="p-3 font-bold whitespace-nowrap">{fecha(n.noteDate)}</td>
                                                <td className="p-3 font-bold">{n.supplierName}</td>
                                                <td className="p-3 text-gray-500">{n.invoiceNumber || '—'}</td>
                                                <td className="p-3 font-black whitespace-nowrap">{pesos(n.total)}</td>
                                                <td className="p-3 font-bold whitespace-nowrap text-emerald-600">{pesos(n.paidAmount)}</td>
                                                <td className={`p-3 font-black whitespace-nowrap ${n.balance > CENTAVO ? 'text-amber-600' : 'text-gray-400'}`}>{pesos(n.balance)}</td>
                                                <td className="p-3 font-bold whitespace-nowrap text-gray-500">{fecha(n.dueDate)}</td>
                                                <td className="p-3 whitespace-nowrap">{estado(n)}</td>
                                                <td className="p-3 text-gray-400">{expanded === n.id ? '▾' : '▸'}</td>
                                            </tr>

                                            {expanded === n.id && (
                                                <tr className="border-b border-border bg-black/[0.02] dark:bg-white/[0.02]">
                                                    <td colSpan={10} className="p-4">
                                                        {cargandoDetalle === n.id && <p className="text-xs text-gray-400">Cargando detalle…</p>}

                                                        {!detalle && cargandoDetalle !== n.id && (
                                                            <p className="text-xs text-red-500 font-bold">
                                                                No se pudo cargar el detalle de esta compra. Cierra y vuelve a abrir el renglón.
                                                            </p>
                                                        )}

                                                        {detalle && (
                                                            <div className="space-y-4">
                                                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                                                    {detalle.locationName}
                                                                    {detalle.userName ? ` · ${detalle.userName}` : ''}
                                                                    {` · ${detalle.totalItems} pieza${detalle.totalItems === 1 ? '' : 's'}`}
                                                                </p>

                                                                <div className="border border-border rounded-xl overflow-x-auto">
                                                                    <table className="w-full min-w-[520px] text-xs">
                                                                        <thead>
                                                                            <tr className="border-b border-border">
                                                                                {['Producto', 'Talla / Color', 'Cant.', 'Costo', 'Importe'].map((h, i) => (
                                                                                    <th key={i} className="p-2 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">{h}</th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {detalle.items.map((it: any, i: number) => (
                                                                                <tr key={i} className="border-b border-border last:border-0">
                                                                                    <td className="p-2 font-bold">{it.productName}</td>
                                                                                    <td className="p-2 text-gray-500">{it.variantInfo || 'Única'}</td>
                                                                                    <td className="p-2 font-black">{it.quantity}</td>
                                                                                    <td className="p-2">{pesos(it.unitCost)}</td>
                                                                                    <td className="p-2 font-black">{pesos(it.lineTotal)}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>

                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Abonos</p>
                                                                    {detalle.payments.length === 0 ? (
                                                                        <p className="text-xs text-gray-400">Sin abonos registrados.</p>
                                                                    ) : (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {detalle.payments.map((p: any, i: number) => (
                                                                                <span key={i} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">
                                                                                    {pesos(p.amount)} · {fecha(p.paidAt)}
                                                                                    {p.paymentMethodName ? ` · ${p.paymentMethodName}` : ''}
                                                                                    {p.source === 'INITIAL' ? ' · al recibir' : ''}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {detalle.notes && (
                                                                    <p className="text-[11px] text-gray-500 font-medium">Nota: {detalle.notes}</p>
                                                                )}

                                                                {detalle.status === 'CANCELLED' && (
                                                                    <p className="text-[11px] text-red-500 font-bold">
                                                                        Cancelada el {fecha(detalle.cancelledAt)}
                                                                        {detalle.cancelledByName ? ` por ${detalle.cancelledByName}` : ''}
                                                                    </p>
                                                                )}

                                                                {canCancel && detalle.status === 'ACTIVE' && (
                                                                    <button
                                                                        onClick={() => cancelar(n)}
                                                                        disabled={cancelando === n.id}
                                                                        className="text-[11px] font-black text-red-500 hover:underline disabled:opacity-40"
                                                                    >
                                                                        {cancelando === n.id ? 'Cancelando…' : 'Cancelar esta compra'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 border border-border rounded-xl text-xs font-black uppercase disabled:opacity-30">Anterior</button>
                    <span className="text-xs font-bold text-gray-500">{page} de {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 border border-border rounded-xl text-xs font-black uppercase disabled:opacity-30">Siguiente</button>
                </div>
            )}

            {carrito && (
                <PurchaseCart
                    onClose={() => setCarrito(false)}
                    onSaved={() => { setPage(1); load(); }}
                />
            )}
        </div>
    );
}
