"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPriceTiers, createPriceTier, deletePriceTier, updatePriceTierOrder, updatePriceTier } from '../../products/new/actions';

export default function PriceTiersPage() {
    const [tiers, setTiers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
    const [newDiscount, setNewDiscount] = useState('');
    const [newMinQuantity, setNewMinQuantity] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await getPriceTiers();
        setTiers(data);
        setLoading(false);
    };

    const handleAddTier = async () => {
        if (!newName || !newDiscount) return;
        const payload: any = {
            name: newName,
            minQuantity: parseInt(newMinQuantity) || 0,
            autoApplyMarketplace: false,
            autoApplyPOS: false,
            manualPOS: true,
        };
        if (discountType === 'percent') {
            payload.discountPercentage = parseFloat(newDiscount) || 0;
            payload.defaultPriceMinusFixed = null;
        } else {
            payload.defaultPriceMinusFixed = parseFloat(newDiscount) || 0;
            payload.discountPercentage = null;
        }
        const res = await createPriceTier(payload);
        if (res.success) {
            setNewName('');
            setNewDiscount('');
            setNewMinQuantity('');
            loadData();
        } else {
            alert("Error al guardar el nivel de precio");
        }
    };

    const handleToggle = async (tier: any, field: string, value: boolean) => {
        const updated = { ...tier, [field]: value };
        setTiers(prev => prev.map((t: any) => t.id === tier.id ? updated : t));
        await updatePriceTier(tier.id, { [field]: value });
    };

    const handleDeleteTier = async (id: string) => {
        if (confirm('¿Eliminar este nivel de precio?')) {
            const res = await deletePriceTier(id);
            if (res.success) loadData();
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index === 0) return;
        const newTiers = [...tiers];
        [newTiers[index], newTiers[index-1]] = [newTiers[index-1], newTiers[index]];
        setTiers(newTiers);
        await updatePriceTierOrder(newTiers.map((t: any) => t.id));
    };

    const handleMoveDown = async (index: number) => {
        if (index === tiers.length - 1) return;
        const newTiers = [...tiers];
        [newTiers[index], newTiers[index+1]] = [newTiers[index+1], newTiers[index]];
        setTiers(newTiers);
        await updatePriceTierOrder(newTiers.map((t: any) => t.id));
    };

    return (
        <div className="max-w-5xl mx-auto py-10 px-4">
            <div className="mb-10">
                <h1 className="text-3xl font-black text-foreground tracking-tight">Niveles de Precios</h1>
                <p className="text-gray-500 font-medium mt-2">Configura descuentos por volumen y decide dónde aplican automáticamente.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Formulario nuevo nivel */}
                <div className="bg-card p-6 rounded-3xl border border-border shadow-xl h-fit space-y-5">
                    <h2 className="font-black text-lg text-foreground">Nuevo Nivel</h2>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre del Nivel</label>
                            <input type="text" placeholder="Ej: Mayoreo 6+" value={newName} onChange={e => setNewName(e.target.value)}
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo de Descuento</label>
                            <select value={discountType} onChange={e => setDiscountType(e.target.value as 'percent' | 'fixed')}
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold">
                                <option value="percent">Porcentaje (%)</option>
                                <option value="fixed">Monto Fijo (-$)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {discountType === 'percent' ? '% de Descuento' : 'Monto a Descontar ($)'}
                            </label>
                            <input type="number" placeholder="0" value={newDiscount} onChange={e => setNewDiscount(e.target.value)}
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                Mínimo de piezas para activar
                            </label>
                            <input type="number" placeholder="Ej: 6" min="0" value={newMinQuantity} onChange={e => setNewMinQuantity(e.target.value)}
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold" />
                            <p className="text-[10px] text-gray-400">0 = sin mínimo requerido</p>
                        </div>
                        <button onClick={handleAddTier}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                            Guardar Nivel
                        </button>
                    </div>
                </div>

                {/* Lista de niveles */}
                <div className="md:col-span-2 space-y-4">
                    {loading ? (
                        <div className="p-20 text-center animate-pulse">
                            <p className="font-black uppercase tracking-widest text-gray-400">Cargando niveles...</p>
                        </div>
                    ) : tiers.length === 0 ? (
                        <div className="p-20 text-center bg-card rounded-3xl border border-dashed border-border opacity-50">
                            <p className="text-4xl mb-4">🏷️</p>
                            <p className="font-black uppercase tracking-widest text-gray-400">No hay niveles creados</p>
                        </div>
                    ) : (
                        tiers.map((tier: any, index: number) => (
                            <div key={tier.id} className="bg-card p-5 rounded-3xl border border-border shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col gap-1 pt-1 shrink-0">
                                        <button onClick={() => handleMoveUp(index)} disabled={index === 0}
                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors ${index === 0 ? 'opacity-20 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>↑</button>
                                        <button onClick={() => handleMoveDown(index)} disabled={index === tiers.length - 1}
                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors ${index === tiers.length - 1 ? 'opacity-20 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>↓</button>
                                    </div>

                                    <div className="flex-1 space-y-4 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="font-black text-lg text-foreground">{tier.name}</h3>
                                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                                    <span className="text-blue-500 font-bold text-sm">
                                                        {tier.discountPercentage ? `-${tier.discountPercentage}%` : `-$${tier.defaultPriceMinusFixed}`}
                                                    </span>
                                                    {tier.minQuantity > 0 && (
                                                        <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-full text-[10px] font-black">
                                                            Mín. {tier.minQuantity} pz
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={() => handleDeleteTier(tier.id)}
                                                className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all flex items-center justify-center font-bold text-lg shrink-0">×</button>
                                        </div>

                                        <div className="pt-3 border-t border-border space-y-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dónde aplica este nivel:</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

                                                {/* Marketplace auto */}
                                                <div className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${tier.autoApplyMarketplace ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-800/30 border-border'}`}>
                                                    <span className="text-base shrink-0">🌐</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-black text-foreground uppercase tracking-wide">Marketplace</p>
                                                        <p className="text-[9px] text-gray-400 font-medium">Auto en línea</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggle(tier, 'autoApplyMarketplace', !tier.autoApplyMarketplace)}
                                                        className={`relative w-9 h-5 rounded-full transition-all shrink-0 ${tier.autoApplyMarketplace ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                                    >
                                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${tier.autoApplyMarketplace ? 'left-4' : 'left-0.5'}`} />
                                                    </button>
                                                </div>

                                                {/* POS auto */}
                                                <div className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${tier.autoApplyPOS ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-gray-50 dark:bg-gray-800/30 border-border'}`}>
                                                    <span className="text-base shrink-0">🖥️</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-black text-foreground uppercase tracking-wide">POS Auto</p>
                                                        <p className="text-[9px] text-gray-400 font-medium">Al cumplir piezas</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggle(tier, 'autoApplyPOS', !tier.autoApplyPOS)}
                                                        className={`relative w-9 h-5 rounded-full transition-all shrink-0 ${tier.autoApplyPOS ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                                    >
                                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${tier.autoApplyPOS ? 'left-4' : 'left-0.5'}`} />
                                                    </button>
                                                </div>

                                                {/* POS manual */}
                                                <div className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${tier.manualPOS ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' : 'bg-gray-50 dark:bg-gray-800/30 border-border'}`}>
                                                    <span className="text-base shrink-0">🧾</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-black text-foreground uppercase tracking-wide">POS Manual</p>
                                                        <p className="text-[9px] text-gray-400 font-medium">Selector en caja</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggle(tier, 'manualPOS', !tier.manualPOS)}
                                                        className={`relative w-9 h-5 rounded-full transition-all shrink-0 ${tier.manualPOS ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                                    >
                                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${tier.manualPOS ? 'left-4' : 'left-0.5'}`} />
                                                    </button>
                                                </div>

                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border">
                <Link href="/pos" className="text-sm font-bold text-gray-400 hover:text-foreground transition-colors flex items-center gap-2">
                    ← Volver a la Caja
                </Link>
            </div>
        </div>
    );
}
