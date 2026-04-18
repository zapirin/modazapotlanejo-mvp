'use client';

import React, { useState, useTransition } from 'react';
import { createCoupon, updateCoupon, deleteCoupon } from '@/app/actions/coupons';

const EMPTY_FORM = {
    code: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING',
    discountValue: '',
    minPurchase: '',
    maxUses: '',
    maxUsesPerBuyer: '',
    startsAt: '',
    expiresAt: '',
};

export default function CouponsClient({ initialCoupons }: { initialCoupons: any[] }) {
    const [coupons, setCoupons] = useState(initialCoupons);
    const [showModal, setShowModal] = useState(false);
    const [editCoupon, setEditCoupon] = useState<any>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const openCreate = () => {
        setEditCoupon(null);
        setForm(EMPTY_FORM);
        setError('');
        setShowModal(true);
    };

    const openEdit = (c: any) => {
        setEditCoupon(c);
        setForm({
            code: c.code,
            discountType: c.discountType,
            discountValue: String(c.discountValue),
            minPurchase: c.minPurchase > 0 ? String(c.minPurchase) : '',
            maxUses: c.maxUses ? String(c.maxUses) : '',
            maxUsesPerBuyer: c.maxUsesPerBuyer ? String(c.maxUsesPerBuyer) : '',
            startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : '',
            expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : '',
        });
        setError('');
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const payload = {
            code: form.code,
            discountType: form.discountType,
            discountValue: form.discountType === 'FREE_SHIPPING' ? 0 : parseFloat(form.discountValue),
            minPurchase: form.minPurchase ? parseFloat(form.minPurchase) : 0,
            maxUses: form.maxUses ? parseInt(form.maxUses) : null,
            maxUsesPerBuyer: form.maxUsesPerBuyer ? parseInt(form.maxUsesPerBuyer) : null,
            startsAt: form.startsAt || null,
            expiresAt: form.expiresAt || null,
        };
        startTransition(async () => {
            const result = editCoupon
                ? await updateCoupon(editCoupon.id, payload)
                : await createCoupon(payload);
            if (result.error) { setError(result.error); return; }
            setShowModal(false);
            if (editCoupon) {
                // Actualizar en lista local
                setCoupons(prev => prev.map(c => c.id === editCoupon.id ? { ...c, ...payload, ...result.coupon } : c));
            } else {
                // Agregar al inicio de la lista
                setCoupons(prev => [result.coupon, ...prev]);
            }
        });
    };

    const handleToggle = (coupon: any) => {
        startTransition(async () => {
            const result = await updateCoupon(coupon.id, { isActive: !coupon.isActive });
            if (!result.error) {
                setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, isActive: !coupon.isActive } : c));
            }
        });
    };

    const handleDelete = (coupon: any) => {
        if (!confirm(`¿Eliminar el cupón "${coupon.code}"? Esta acción no se puede deshacer.`)) return;
        startTransition(async () => {
            const result = await deleteCoupon(coupon.id);
            if (!result.error) {
                setCoupons(prev => prev.filter(c => c.id !== coupon.id));
            }
        });
    };

    const formatDate = (d: any) =>
        d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    const isExpired = (c: any) => c.expiresAt && new Date(c.expiresAt) < new Date();
    const isExhausted = (c: any) => c.maxUses !== null && c.usedCount >= c.maxUses;

    const statusBadge = (c: any) => {
        if (!c.isActive) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 dark:bg-gray-800 text-gray-500">Inactivo</span>;
        if (isExpired(c)) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 dark:bg-red-900/30 text-red-600">Expirado</span>;
        if (isExhausted(c)) return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 dark:bg-orange-900/30 text-orange-600">Agotado</span>;
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 dark:bg-green-900/30 text-green-700">Activo</span>;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">🏷️ Cupones de Descuento</h1>
                    <p className="text-sm text-gray-500 mt-1">{coupons.length} cupón{coupons.length !== 1 ? 'es' : ''} creado{coupons.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                    onClick={openCreate}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-500/20 hover:scale-105 flex items-center gap-2"
                >
                    + Nuevo Cupón
                </button>
            </div>

            {/* Tabla */}
            {coupons.length === 0 ? (
                <div className="py-24 text-center space-y-4 bg-card rounded-3xl border border-border">
                    <div className="text-6xl">🏷️</div>
                    <p className="font-black text-gray-400 text-sm uppercase tracking-widest">Aún no tienes cupones</p>
                    <p className="text-gray-400 text-xs">Crea tu primer cupón para ofrecer descuentos a tus compradores</p>
                    <button onClick={openCreate} className="inline-block px-6 py-3 bg-blue-600 text-white rounded-full font-black text-sm hover:bg-blue-700 transition-colors">
                        Crear mi primer cupón
                    </button>
                </div>
            ) : (
                <div className="bg-card rounded-3xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border">
                                <tr>
                                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Código</th>
                                    <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Descuento</th>
                                    <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Mín. compra</th>
                                    <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Usos</th>
                                    <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Vigencia</th>
                                    <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</th>
                                    <th className="px-4 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {coupons.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-black text-base tracking-wider bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg font-mono">
                                                {c.code}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="font-black text-emerald-600 text-base">
                                                {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : c.discountType === 'FREE_SHIPPING' ? '🚚 Envío gratis' : `$${c.discountValue.toFixed(2)}`}
                                            </span>
                                            <div className="text-[10px] text-gray-400 mt-0.5">{c.discountType === 'PERCENTAGE' ? 'Porcentaje' : c.discountType === 'FREE_SHIPPING' ? 'Envío gratis' : 'Monto fijo'}</div>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-bold text-foreground">
                                            {c.minPurchase > 0 ? `$${c.minPurchase.toFixed(2)}` : '—'}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="font-bold text-foreground">{c.usedCount}</span>
                                            <span className="text-gray-400"> / {c.maxUses ?? '∞'}</span>
                                        </td>
                                        <td className="px-4 py-4 text-xs text-gray-500">
                                            <div>{c.startsAt ? `Desde: ${formatDate(c.startsAt)}` : 'Sin inicio'}</div>
                                            <div>{c.expiresAt ? `Hasta: ${formatDate(c.expiresAt)}` : 'Sin vencimiento'}</div>
                                        </td>
                                        <td className="px-4 py-4">{statusBadge(c)}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    onClick={() => handleToggle(c)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-colors ${c.isActive ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600' : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 text-blue-600'}`}
                                                    disabled={isPending}
                                                >
                                                    {c.isActive ? 'Desactivar' : 'Activar'}
                                                </button>
                                                <button
                                                    onClick={() => openEdit(c)}
                                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-foreground transition-colors"
                                                    title="Editar"
                                                >✏️</button>
                                                <button
                                                    onClick={() => handleDelete(c)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Eliminar"
                                                    disabled={isPending}
                                                >🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal crear/editar */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <h3 className="font-black text-lg text-foreground">{editCoupon ? '✏️ Editar Cupón' : '➕ Nuevo Cupón'}</h3>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 flex items-center justify-center font-bold transition-colors">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 text-sm font-bold">
                                    ⚠️ {error}
                                </div>
                            )}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">Código del cupón *</label>
                                <input
                                    type="text"
                                    value={form.code}
                                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                    placeholder="ej. VERANO20"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-mono font-black text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">Tipo de descuento *</label>
                                    <select
                                        value={form.discountType}
                                        onChange={e => setForm(f => ({ ...f, discountType: e.target.value as any }))}
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="PERCENTAGE">% Porcentaje</option>
                                        <option value="FIXED">$ Monto fijo</option>
                                        <option value="FREE_SHIPPING">🚚 Envío gratis</option>
                                    </select>
                                </div>
                                {form.discountType !== 'FREE_SHIPPING' && (
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">
                                        {form.discountType === 'PERCENTAGE' ? 'Porcentaje (%)' : 'Monto ($)'} *
                                    </label>
                                    <input
                                        type="number"
                                        value={form.discountValue}
                                        onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                                        min="0.01"
                                        max={form.discountType === 'PERCENTAGE' ? '100' : undefined}
                                        step="0.01"
                                        required
                                        placeholder={form.discountType === 'PERCENTAGE' ? '20' : '50.00'}
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">Compra mínima ($)</label>
                                <input
                                    type="number"
                                    value={form.minPurchase}
                                    onChange={e => setForm(f => ({ ...f, minPurchase: e.target.value }))}
                                    min="0"
                                    step="0.01"
                                    placeholder="0 = sin mínimo"
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">Usos máximos (total)</label>
                                    <input
                                        type="number"
                                        value={form.maxUses}
                                        onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                                        min="1"
                                        step="1"
                                        placeholder="Vacío = ilimitado"
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">Máx. por comprador</label>
                                    <input
                                        type="number"
                                        value={form.maxUsesPerBuyer}
                                        onChange={e => setForm(f => ({ ...f, maxUsesPerBuyer: e.target.value }))}
                                        min="1"
                                        step="1"
                                        placeholder="Vacío = ilimitado"
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">Fecha de inicio</label>
                                    <input
                                        type="datetime-local"
                                        value={form.startsAt}
                                        onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">Fecha de expiración</label>
                                    <input
                                        type="datetime-local"
                                        value={form.expiresAt}
                                        onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
                                >
                                    {isPending ? 'Guardando...' : editCoupon ? 'Guardar cambios' : 'Crear cupón'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
