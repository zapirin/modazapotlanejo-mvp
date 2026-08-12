"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    getEntryLocations,
    searchProductsForEntry,
    getProductForEntry,
    createStockEntry,
} from './actions';

export default function StockEntryForm({
    initialProductId,
    onClose,
    onSaved,
}: {
    initialProductId?: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [locations, setLocations] = useState<any[]>([]);
    const [locationId, setLocationId] = useState<string>('');
    const [loadingLocations, setLoadingLocations] = useState(true);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const [product, setProduct] = useState<any>(null);
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [quantities, setQuantities] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Sucursales permitidas
    useEffect(() => {
        getEntryLocations().then(locs => {
            setLocations(locs);
            if (locs.length > 0) setLocationId(locs[0].id);
            setLoadingLocations(false);
        });
    }, []);

    // Búsqueda con retraso para no consultar en cada tecla
    useEffect(() => {
        if (product) return;
        if (query.trim().length < 2) { setResults([]); return; }
        setSearching(true);
        const t = setTimeout(async () => {
            const res = await searchProductsForEntry(query);
            setResults(res);
            setSearching(false);
        }, 350);
        return () => clearTimeout(t);
    }, [query, product]);

    // Carga de variantes: al elegir producto y cada vez que cambia la sucursal
    const loadProduct = async (productId: string, locId: string) => {
        if (!locId) return;
        setLoadingProduct(true);
        setLoadError(null);
        const data = await getProductForEntry(productId, locId);
        setProduct(data);
        setQuantities({});
        setLoadingProduct(false);
        if (!data) {
            setLoadError('No se pudo cargar este modelo en la sucursal seleccionada. Puede que no tengas acceso a esa sucursal, o que el modelo ya no esté disponible.');
            toast.error('No se pudo cargar el producto.');
        }
    };

    useEffect(() => {
        if (initialProductId && locationId) loadProduct(initialProductId, locationId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialProductId, locationId]);

    useEffect(() => {
        if (!initialProductId && product?.id && locationId) loadProduct(product.id, locationId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationId]);

    const total = Object.values(quantities).reduce((s, v) => s + Math.max(0, parseInt(v, 10) || 0), 0);

    const handleSave = async () => {
        const items = Object.entries(quantities)
            .map(([variantId, value]) => ({ variantId, quantity: parseInt(value, 10) || 0 }))
            .filter(i => i.quantity > 0);

        if (!product) { toast.error('Elige un producto.'); return; }
        if (!locationId) { toast.error('Elige una sucursal.'); return; }
        if (items.length === 0) { toast.error('Captura al menos una cantidad.'); return; }

        setSaving(true);
        const res = await createStockEntry({ productId: product.id, locationId, notes, items });
        setSaving(false);

        if (res.success) {
            toast.success(`Entrada E-${String(res.folio).padStart(6, '0')} registrada · ${total} piezas`);
            onSaved();
            onClose();
        } else {
            toast.error(res.error || 'No se pudo registrar la entrada.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black">📥 Registrar Entrada</h3>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                            Las cantidades se suman al inventario
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-foreground text-2xl leading-none">×</button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto">
                    {!loadingLocations && locations.length === 0 && (
                        <div className="p-5 rounded-xl border border-dashed border-border text-center">
                            <p className="font-black text-sm mb-1">No hay sucursales disponibles</p>
                            <p className="text-xs text-gray-500">
                                Si eres el dueño, crea una en <a href="/settings/locations" className="text-blue-600 underline">Configuración → Sucursales</a>. Si eres cajero, pídele al dueño que te asigne una.
                            </p>
                        </div>
                    )}

                    {locations.length > 0 && (
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sucursal donde llegó</label>
                            <select
                                value={locationId}
                                onChange={e => setLocationId(e.target.value)}
                                className="mt-2 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                            >
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    )}

                    {!initialProductId && !product && locations.length > 0 && (
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Buscar modelo</label>
                            <input
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Nombre o SKU del modelo…"
                                className="mt-2 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                            />
                            {searching && <p className="mt-2 text-xs text-gray-400">Buscando…</p>}
                            {!searching && query.trim().length >= 2 && results.length === 0 && (
                                <p className="mt-2 text-xs text-gray-400">Sin resultados.</p>
                            )}
                            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                                {results.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => { setResults([]); setQuery(''); loadProduct(r.id, locationId); }}
                                        className="w-full text-left p-3 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <p className="font-black text-sm">{r.name}</p>
                                        <p className="text-[10px] text-gray-400 font-medium">
                                            {r.sku ? `SKU ${r.sku} · ` : ''}{r.supplierName || 'Sin proveedor'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {loadingProduct && <p className="text-sm text-gray-400">Cargando variantes…</p>}

                    {loadError && !loadingProduct && (
                        <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900">
                            <p className="font-black text-sm text-red-600 mb-1">No se pudo cargar el modelo</p>
                            <p className="text-xs text-red-500">{loadError}</p>
                        </div>
                    )}

                    {product && (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-black text-base">{product.name}</p>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                        Proveedor: {product.supplierName || 'Sin proveedor asignado'}
                                    </p>
                                </div>
                                {!initialProductId && (
                                    <button
                                        onClick={() => { setProduct(null); setQuantities({}); }}
                                        className="text-xs font-black text-blue-600 hover:underline shrink-0"
                                    >
                                        Cambiar modelo
                                    </button>
                                )}
                            </div>

                            <div className="border border-border rounded-xl divide-y divide-border">
                                {product.variants.map((v: any) => (
                                    <div key={v.id} className="flex items-center gap-3 p-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm truncate">{v.label}</p>
                                            <p className="text-[10px] text-gray-400 font-medium">Tienes {v.currentStock} en esta sucursal</p>
                                        </div>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            inputMode="numeric"
                                            value={quantities[v.id] ?? ''}
                                            onChange={e => setQuantities(q => ({ ...q, [v.id]: e.target.value }))}
                                            placeholder="0"
                                            className="w-24 p-2 rounded-lg border border-border bg-transparent text-center font-black"
                                        />
                                    </div>
                                ))}
                                {product.variants.length === 0 && (
                                    <p className="p-4 text-xs text-gray-400">Este modelo no tiene variantes. Agrégalas en Editar Producto.</p>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nota (opcional)</label>
                                <input
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Ej. nota 4471, llegó incompleto…"
                                    className="mt-2 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-border flex items-center gap-3">
                    <p className="flex-1 text-sm font-black">
                        {total > 0 ? `Vas a ingresar ${total} pieza${total === 1 ? '' : 's'}` : 'Sin cantidades capturadas'}
                    </p>
                    <button onClick={onClose} className="px-5 py-3 border border-border rounded-xl font-black uppercase tracking-widest text-xs text-gray-500">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || total === 0}
                        className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-40"
                    >
                        {saving ? 'Guardando…' : 'Guardar entrada'}
                    </button>
                </div>
            </div>
        </div>
    );
}
