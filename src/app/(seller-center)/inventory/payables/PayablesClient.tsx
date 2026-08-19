"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    getPayablesSummary, getSupplierPayables, getPaymentMethodsForPayables,
    addSupplierPayment, cancelSupplierPayment,
} from './actions';

const pesos = (n: number) =>
    `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fecha = (d: any) =>
    d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Las cajas vencidas se pintan más fuerte entre más viejas: la vista debe
// gritar dónde está el problema sin tener que leer los números.
const COLOR_CAJA: Record<string, string> = {
    corriente: 'border-gray-200 dark:border-gray-700',
    d30: 'border-amber-300 dark:border-amber-700',
    d60: 'border-orange-300 dark:border-orange-700',
    d90: 'border-red-300 dark:border-red-800',
    d120: 'border-red-400 dark:border-red-700',
    mas120: 'border-red-600 dark:border-red-500',
};

const TEXTO_CAJA: Record<string, string> = {
    corriente: 'text-gray-600 dark:text-gray-300',
    d30: 'text-amber-600 dark:text-amber-400',
    d60: 'text-orange-600 dark:text-orange-400',
    d90: 'text-red-600 dark:text-red-400',
    d120: 'text-red-600 dark:text-red-400',
    mas120: 'text-red-700 dark:text-red-400',
};

export default function PayablesClient() {
    const [resumen, setResumen] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [expandido, setExpandido] = useState<string | null>(null);
    const [detalles, setDetalles] = useState<Record<string, any>>({});
    const [cargandoDetalle, setCargandoDetalle] = useState<string | null>(null);

    const [metodos, setMetodos] = useState<any[]>([]);
    const [abonando, setAbonando] = useState<any | null>(null);
    const [monto, setMonto] = useState('');
    const [fechaAbono, setFechaAbono] = useState(hoyISO());
    const [metodoId, setMetodoId] = useState('');
    const [notaAbono, setNotaAbono] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [cancelandoPago, setCancelandoPago] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res: any = await getPayablesSummary();
            setResumen(res);
            setLoadError(res.success ? null : (res.error || 'No se pudieron cargar las cuentas por pagar.'));
        } catch (error: any) {
            console.error('Error al cargar cuentas por pagar:', error);
            setResumen(null);
            setLoadError('No se pudieron cargar las cuentas por pagar. Revisa tu conexión y vuelve a intentar.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        getPaymentMethodsForPayables()
            .then((m: any) => setMetodos(m || []))
            .catch((error: any) => {
                console.error('Error al cargar los métodos de pago:', error);
                toast.error('No se pudieron cargar los métodos de pago.');
            });
    }, []);

    const recargarDetalle = async (supplierId: string) => {
        try {
            const det: any = await getSupplierPayables(supplierId);
            if (det.success) setDetalles(prev => ({ ...prev, [supplierId]: det }));
            else toast.error(det.error || 'No se pudo cargar el detalle.');
        } catch (error: any) {
            console.error('Error al cargar el detalle del proveedor:', error);
            toast.error('No se pudo cargar el detalle. Revisa tu conexión.');
        }
    };

    const abrir = async (supplierId: string) => {
        if (expandido === supplierId) { setExpandido(null); return; }
        setExpandido(supplierId);
        if (detalles[supplierId]) return;
        setCargandoDetalle(supplierId);
        await recargarDetalle(supplierId);
        setCargandoDetalle(null);
    };

    const abrirAbono = (nota: any, supplierId: string, supplierName: string) => {
        setAbonando({ ...nota, supplierId, supplierName });
        setMonto('');
        setFechaAbono(hoyISO());
        setMetodoId('');
        setNotaAbono('');
    };

    const guardarAbono = async () => {
        if (guardando || !abonando) return;
        const cantidad = parseFloat(monto);
        if (!isFinite(cantidad) || cantidad <= 0) {
            toast.error('Escribe un monto mayor a cero.');
            return;
        }
        setGuardando(true);
        try {
            const res: any = await addSupplierPayment({
                purchaseNoteId: abonando.id,
                amount: cantidad,
                paidAt: fechaAbono,
                paymentMethodId: metodoId || undefined,
                notes: notaAbono || undefined,
            });
            if (!res.success) { toast.error(res.error || 'No se pudo registrar el abono.'); return; }
            toast.success('Abono registrado.');
            const sid = abonando.supplierId;
            setAbonando(null);
            await Promise.all([load(), recargarDetalle(sid)]);
        } catch (error: any) {
            console.error('Error al registrar el abono:', error);
            toast.error('No se pudo registrar el abono. Revisa tu conexión.');
        } finally {
            setGuardando(false);
        }
    };

    const cancelarAbono = async (pagoId: string, supplierId: string, importe: number) => {
        if (cancelandoPago) return;
        if (!confirm(`¿Cancelar el abono de ${pesos(importe)}? La deuda con este proveedor volverá a subir.`)) return;
        setCancelandoPago(pagoId);
        try {
            const res: any = await cancelSupplierPayment(pagoId);
            if (!res.success) { toast.error(res.error || 'No se pudo cancelar el abono.'); return; }
            toast.success('Abono cancelado.');
            await Promise.all([load(), recargarDetalle(supplierId)]);
        } catch (error: any) {
            console.error('Error al cancelar el abono:', error);
            toast.error('No se pudo cancelar el abono. Revisa tu conexión.');
        } finally {
            setCancelandoPago(null);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando cuentas por pagar…</div>;
    }

    if (loadError) {
        return (
            <div className="p-8">
                <div className="bg-card border border-red-200 dark:border-red-900 rounded-2xl p-8 text-center">
                    <p className="text-red-600 dark:text-red-400 font-bold mb-3">{loadError}</p>
                    <button onClick={load} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    const sinDeuda = (resumen?.suppliers?.length || 0) === 0;

    return (
        <div className="p-4 lg:p-8 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black">💳 Cuentas por Pagar</h1>
                    <p className="text-sm text-gray-500 mt-1">Lo que le debes a tus proveedores por mercancía recibida.</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Deuda total</p>
                    <p className="text-3xl font-black text-red-600 dark:text-red-400">{pesos(resumen?.totalDeuda || 0)}</p>
                    <p className="text-xs text-gray-500">{resumen?.totalNotas || 0} nota{resumen?.totalNotas === 1 ? '' : 's'} con saldo</p>
                </div>
            </div>

            {sinDeuda ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                    <p className="text-5xl mb-3">✅</p>
                    <h2 className="text-lg font-black mb-1">No debes nada</h2>
                    <p className="text-sm text-gray-500">Todas tus compras a proveedor están saldadas.</p>
                </div>
            ) : (
                <>
                    {/* Antigüedad de saldos */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Antigüedad de saldos</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            {resumen.buckets.map((b: any) => (
                                <div key={b.key} className={`bg-card border-2 rounded-2xl p-4 ${COLOR_CAJA[b.key] || 'border-border'}`}>
                                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 mb-1">{b.label}</p>
                                    <p className={`text-lg font-black ${TEXTO_CAJA[b.key] || ''}`}>{pesos(b.monto)}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{b.notas} nota{b.notas === 1 ? '' : 's'}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Desglose por proveedor */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Por proveedor</p>
                        <div className="space-y-2">
                            {resumen.suppliers.map((s: any) => {
                                const abierto = expandido === s.supplierId;
                                const det = detalles[s.supplierId];
                                return (
                                    <div key={s.supplierId} className="bg-card border border-border rounded-2xl overflow-hidden">
                                        <button
                                            onClick={() => abrir(s.supplierId)}
                                            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className={`text-gray-400 transition-transform ${abierto ? 'rotate-90' : ''}`}>▶</span>
                                                <div className="min-w-0">
                                                    <p className="font-black truncate">{s.supplierName}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {s.notas} nota{s.notas === 1 ? '' : 's'}
                                                        {s.vencido > 0 && (
                                                            <span className="text-red-600 dark:text-red-400 font-bold">
                                                                {' · '}{pesos(s.vencido)} vencido{s.masVieja > 0 ? ` (${s.masVieja} días)` : ''}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-lg font-black shrink-0">{pesos(s.saldo)}</p>
                                        </button>

                                        {abierto && (
                                            <div className="border-t border-border bg-gray-50/50 dark:bg-gray-900/30 p-4">
                                                {cargandoDetalle === s.supplierId ? (
                                                    <p className="text-sm text-gray-500 text-center py-4">Cargando notas…</p>
                                                ) : !det ? (
                                                    <p className="text-sm text-gray-500 text-center py-4">No se pudo cargar el detalle.</p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {det.rows.map((n: any) => (
                                                            <div key={n.id} className="bg-card border border-border rounded-xl p-3">
                                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                                    <div className="min-w-0">
                                                                        <p className="font-black text-sm">
                                                                            {n.folio}
                                                                            {n.invoiceNumber && <span className="text-gray-400 font-medium"> · Factura {n.invoiceNumber}</span>}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500">
                                                                            {fecha(n.noteDate)} · Vence {fecha(n.dueDate)}
                                                                            {n.diasVencida > 0 && (
                                                                                <span className="text-red-600 dark:text-red-400 font-bold"> · {n.diasVencida} días vencida</span>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="text-xs text-gray-500">
                                                                            Total {pesos(n.total)} · Abonado {pesos(n.paidAmount)}
                                                                        </p>
                                                                        <p className="font-black text-red-600 dark:text-red-400">Debe {pesos(n.balance)}</p>
                                                                    </div>
                                                                </div>

                                                                {n.payments.length > 0 && (
                                                                    <div className="mt-3 pt-3 border-t border-border space-y-1">
                                                                        {n.payments.map((p: any) => (
                                                                            <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                                                                                <span className="text-gray-500">
                                                                                    {fecha(p.paidAt)} · {pesos(p.amount)}
                                                                                    {p.paymentMethodName && ` · ${p.paymentMethodName}`}
                                                                                    {p.source === 'INITIAL' && ' · al recibir'}
                                                                                    {p.notes && ` · ${p.notes}`}
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => cancelarAbono(p.id, s.supplierId, p.amount)}
                                                                                    disabled={cancelandoPago === p.id}
                                                                                    className="text-red-500 hover:text-red-700 font-bold shrink-0 disabled:opacity-50"
                                                                                >
                                                                                    {cancelandoPago === p.id ? '…' : 'Cancelar'}
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                <button
                                                                    onClick={() => abrirAbono(n, s.supplierId, s.supplierName)}
                                                                    className="mt-3 w-full px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider transition-colors"
                                                                >
                                                                    + Abonar a esta nota
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Formulario de abono */}
            {abonando && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                     onClick={() => !guardando && setAbonando(null)}>
                    <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4"
                         onClick={e => e.stopPropagation()}>
                        <div>
                            <h2 className="text-lg font-black">Abonar a {abonando.folio}</h2>
                            <p className="text-sm text-gray-500">
                                {abonando.supplierName} · Saldo actual <span className="font-black text-red-600 dark:text-red-400">{pesos(abonando.balance)}</span>
                            </p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wide text-gray-400 mb-1">Monto del abono</label>
                            <input
                                type="number" step="0.01" min="0" autoFocus
                                value={monto} onChange={e => setMonto(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-lg font-black"
                            />
                            <button
                                type="button"
                                onClick={() => setMonto(String(abonando.balance))}
                                className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                            >
                                Pagar todo ({pesos(abonando.balance)})
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wide text-gray-400 mb-1">Fecha</label>
                                <input
                                    type="date" value={fechaAbono} max={hoyISO()}
                                    onChange={e => setFechaAbono(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wide text-gray-400 mb-1">Método</label>
                                <select
                                    value={metodoId} onChange={e => setMetodoId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                                >
                                    <option value="">Sin especificar</option>
                                    {metodos.map((m: any) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wide text-gray-400 mb-1">Nota (opcional)</label>
                            <input
                                type="text" value={notaAbono} onChange={e => setNotaAbono(e.target.value)}
                                placeholder="Referencia, folio del recibo…"
                                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                            />
                        </div>

                        <p className="text-[11px] text-gray-500 leading-relaxed">
                            Si el abono sale del cajón de la caja, registra primero el egreso en el Punto de Venta.
                            Esta pantalla no mueve el efectivo de la caja.
                        </p>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setAbonando(null)} disabled={guardando}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-border font-bold text-sm disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={guardarAbono} disabled={guardando}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-sm disabled:opacity-50"
                            >
                                {guardando ? 'Guardando…' : 'Registrar abono'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
