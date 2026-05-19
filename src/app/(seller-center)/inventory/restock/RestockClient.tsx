"use client";

import React, { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getRestockSuggestions, executeRestock, updateVariantTarget } from './actions';

interface Location {
    id: string;
    name: string;
    address: string | null;
}

interface RestockItem {
    variantId: string;
    productId: string;
    productName: string;
    productImage: string | null;
    color: string | null;
    size: string | null;
    currentStock: number;
    target: number;
    gap: number;
    sourceStock: number;
    suggestedQty: number;
}

interface Destination {
    locationId: string;
    locationName: string;
    items: RestockItem[];
}

export default function RestockClient({ locations }: { locations: Location[] }) {
    const defaultSource = locations.find(l => l.name.toLowerCase() === 'bodega')?.id || locations[0].id;
    const defaultDest = locations.find(l => l.id !== defaultSource)?.id || '';
    const [sourceId, setSourceId] = useState(defaultSource);
    const [destId, setDestId] = useState(defaultDest);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [targets, setTargets] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const loadSuggestions = async (srcId: string, dstId: string) => {
        if (!dstId || srcId === dstId) {
            setDestinations([]);
            return;
        }
        setLoading(true);
        try {
            const res = await getRestockSuggestions(srcId, dstId);
            setDestinations(res.destinations);
            const q: Record<string, number> = {};
            const t: Record<string, number> = {};
            res.destinations.forEach(d => {
                d.items.forEach(i => {
                    q[`${d.locationId}:${i.variantId}`] = i.suggestedQty;
                    t[i.variantId] = i.target;
                });
            });
            setQuantities(q);
            setTargets(t);
        } catch (err) {
            console.error(err);
            toast.error('No se pudieron cargar las sugerencias');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (destId === sourceId) {
            const other = locations.find(l => l.id !== sourceId);
            if (other) setDestId(other.id);
            return;
        }
        loadSuggestions(sourceId, destId);
    }, [sourceId, destId]);

    const handleQtyChange = (destId: string, variantId: string, value: string, max: number) => {
        const n = parseInt(value) || 0;
        const clamped = Math.max(0, Math.min(n, max));
        setQuantities(prev => ({ ...prev, [`${destId}:${variantId}`]: clamped }));
    };

    const handleTargetSave = async (variantId: string, value: number) => {
        const clean = Math.max(0, Math.floor(value || 0));
        setTargets(prev => ({ ...prev, [variantId]: clean }));
        startTransition(async () => {
            const res = await updateVariantTarget(variantId, clean);
            if (!res.success) toast.error(res.error || 'No se pudo guardar el objetivo');
            else toast.success('Objetivo actualizado');
        });
    };

    const handleConfirm = async (dest: Destination) => {
        const items = dest.items
            .map(i => ({
                variantId: i.variantId,
                quantity: quantities[`${dest.locationId}:${i.variantId}`] ?? 0,
                name: i.productName,
                color: i.color,
                size: i.size,
            }))
            .filter(i => i.quantity > 0);

        if (items.length === 0) {
            toast.warning('No hay cantidades a surtir en esta sucursal');
            return;
        }

        const totalUnidades = items.reduce((a, b) => a + b.quantity, 0);
        if (!confirm(`¿Crear traspaso de ${totalUnidades} unidades de "${sourceLocationName}" a "${dest.locationName}"?`)) return;

        setConfirming(dest.locationId);
        try {
            const res = await executeRestock(sourceId, dest.locationId, items);
            if (res.success) {
                toast.success(`Traspaso creado a ${dest.locationName}`);
                await loadSuggestions(sourceId, destId);
            } else {
                toast.error(res.error || 'No se pudo crear el traspaso');
            }
        } finally {
            setConfirming(null);
        }
    };

    const sourceLocationName = locations.find(l => l.id === sourceId)?.name || '';
    const destOptions = locations.filter(l => l.id !== sourceId);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">Resurtido desde Bodega</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Elige la sucursal origen. Te muestro qué variantes están por debajo del stock objetivo en las otras sucursales y cuánto sugiero surtir.
                </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2">
                        Sucursal de origen
                    </label>
                    <select
                        value={sourceId}
                        onChange={e => setSourceId(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 ring-blue-500/20"
                    >
                        {locations.map(l => (
                            <option key={l.id} value={l.id}>{l.name}{l.address ? ` — ${l.address}` : ''}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2">
                        Sucursal destino
                    </label>
                    <select
                        value={destId}
                        onChange={e => setDestId(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 ring-blue-500/20"
                    >
                        {destOptions.map(l => (
                            <option key={l.id} value={l.id}>{l.name}{l.address ? ` — ${l.address}` : ''}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="bg-card border border-border rounded-2xl p-10 text-center text-gray-500">
                    Calculando sugerencias…
                </div>
            ) : destinations.length === 0 ? (
                <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <h2 className="text-lg font-bold mb-1">Todo en orden</h2>
                    <p className="text-gray-500 text-sm">Ninguna sucursal necesita resurtido desde {sourceLocationName}.</p>
                </div>
            ) : (
                destinations.map(dest => {
                    const totalSurtir = dest.items.reduce((acc, i) => acc + (quantities[`${dest.locationId}:${i.variantId}`] || 0), 0);
                    return (
                        <div key={dest.locationId} className="bg-card border border-border rounded-2xl overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 md:p-6 border-b border-border bg-gray-50 dark:bg-gray-900/40">
                                <div>
                                    <h3 className="text-lg font-black">Surtir a: {dest.locationName}</h3>
                                    <p className="text-xs text-gray-500">{dest.items.length} variante(s) por debajo del objetivo · {totalSurtir} unidad(es) a surtir</p>
                                </div>
                                <button
                                    onClick={() => handleConfirm(dest)}
                                    disabled={confirming === dest.locationId || totalSurtir === 0}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                                >
                                    {confirming === dest.locationId ? 'Creando…' : 'Confirmar traspaso'}
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50/50 dark:bg-gray-900/30">
                                        <tr className="text-left text-[10px] font-black uppercase tracking-widest text-gray-500">
                                            <th className="px-3 py-3"> </th>
                                            <th className="px-3 py-3">Producto</th>
                                            <th className="px-3 py-3">Variante</th>
                                            <th className="px-3 py-3 text-center">Tienda</th>
                                            <th className="px-3 py-3 text-center">Objetivo</th>
                                            <th className="px-3 py-3 text-center">Origen</th>
                                            <th className="px-3 py-3 text-center">A surtir</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {dest.items.map(item => {
                                            const key = `${dest.locationId}:${item.variantId}`;
                                            return (
                                                <tr key={key} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/30">
                                                    <td className="px-3 py-2 w-12">
                                                        {item.productImage ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={item.productImage} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800" />
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 font-bold">{item.productName}</td>
                                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                                        {[item.color, item.size].filter(Boolean).join(' / ') || '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`font-bold ${item.currentStock === 0 ? 'text-red-600' : 'text-orange-500'}`}>
                                                            {item.currentStock}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={targets[item.variantId] ?? item.target}
                                                            onChange={e => setTargets(prev => ({ ...prev, [item.variantId]: parseInt(e.target.value) || 0 }))}
                                                            onBlur={e => handleTargetSave(item.variantId, parseInt(e.target.value) || 0)}
                                                            className="w-16 bg-gray-50 dark:bg-gray-900 border border-border rounded-lg px-2 py-1.5 text-center text-sm font-bold outline-none focus:ring-2 ring-blue-500/30"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-gray-600">{item.sourceStock}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={Math.min(item.gap, item.sourceStock)}
                                                            value={quantities[key] ?? 0}
                                                            onChange={e => handleQtyChange(dest.locationId, item.variantId, e.target.value, Math.min(item.gap, item.sourceStock))}
                                                            className="w-16 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg px-2 py-1.5 text-center text-sm font-black text-blue-700 dark:text-blue-300 outline-none focus:ring-2 ring-blue-500/30"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
