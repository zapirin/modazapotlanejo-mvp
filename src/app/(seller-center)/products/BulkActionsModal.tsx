"use client";

import React, { useState, useEffect } from 'react';
import { bulkUpdateVisibility, bulkUpdatePrices, bulkUpdatePromotionalPrice, bulkUpdateClassification, bulkUpdateWholesalePrices } from './bulkActions';
import { getCategories, getBrands, getSuppliers, createBrand, createSupplier } from './new/actions';

interface BulkActionsModalProps {
    selectedIds: string[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function BulkActionsModal({ selectedIds, onClose, onSuccess }: BulkActionsModalProps) {
    const [actionType, setActionType] = useState<string>(''); // visibility, price, promo
    const [subAction, setSubAction] = useState<string>(''); // online/offline, inc/dec/fixed, etc.
    const [numValue, setNumValue] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [wholesalePrices, setWholesalePrices] = useState<Record<string, string>>({'Corrida': '', 'Paquete': '', 'Caja': ''});

    // --- Classification State ---
    const [categories, setCategories] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    
    // undefined = do not update, null = detach/clear
    const [selectedCategory, setSelectedCategory] = useState<string | null | undefined>(undefined);
    const [selectedSubcategory, setSelectedSubcategory] = useState<string | null | undefined>(undefined);
    const [selectedBrand, setSelectedBrand] = useState<string | null | undefined>(undefined);
    const [selectedSupplier, setSelectedSupplier] = useState<string | null | undefined>(undefined);

    const [newBrandName, setNewBrandName] = useState('');
    const [newSupplierName, setNewSupplierName] = useState('');

    useEffect(() => {
        if (actionType === 'classification' && categories.length === 0) {
            setIsLoadingData(true);
            Promise.all([getCategories(), getBrands(), getSuppliers()]).then(([cats, brs, sups]) => {
                setCategories(cats);
                setBrands(brs);
                setSuppliers(sups);
                setIsLoadingData(false);
            }).catch(e => {
                console.error(e);
                setIsLoadingData(false);
            });
        }
    }, [actionType]);

    const handleCreateBrand = async () => {
        if (!newBrandName.trim()) return;
        setIsSubmitting(true);
        try {
            const res = await createBrand(newBrandName.trim());
            if (res.success && res.brand) {
                setBrands([...brands, res.brand]);
                setSelectedBrand(res.brand.id);
                setNewBrandName('');
            }
        } finally { setIsSubmitting(false); }
    };

    const handleCreateSupplier = async () => {
        if (!newSupplierName.trim()) return;
        setIsSubmitting(true);
        try {
            const res = await createSupplier(newSupplierName.trim());
            if (res.success && res.supplier) {
                setSuppliers([...suppliers, res.supplier]);
                setSelectedSupplier(res.supplier.id);
                setNewSupplierName('');
            }
        } finally { setIsSubmitting(false); }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        
        try {
            if (actionType === 'visibility') {
                const isOnline = subAction === 'online';
                const res = await bulkUpdateVisibility(selectedIds, isOnline);
                if (!res.success) throw new Error(res.error);
            } 
            else if (actionType === 'price') {
                if (subAction === 'clear_promo') {
                    const res = await bulkUpdatePrices(selectedIds, 'clear_promo');
                    if (!res.success) throw new Error(res.error);
                } else {
                    const val = parseFloat(numValue);
                    if (isNaN(val) || val <= 0) throw new Error("Por favor, ingresa un valor numérico válido mayor a 0.");
                    
                    const res = await bulkUpdatePrices(selectedIds, subAction as any, val);
                    if (!res.success) throw new Error(res.error);
                }
            } 
            else if (actionType === 'promo') {
                const price = parseFloat(numValue);
                if (isNaN(price) || price <= 0) throw new Error("Por favor, ingresa un precio de promoción válido.");
                
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;
                
                if (start && end && start > end) {
                    throw new Error("La fecha de inicio no puede ser posterior a la fecha de término.");
                }

                const res = await bulkUpdatePromotionalPrice(selectedIds, price, start, end);
                if (!res.success) throw new Error(res.error);
            }
            else if (actionType === 'wholesale') {
                const entries = Object.entries(wholesalePrices).filter(([, v]) => v !== '' && parseFloat(v) > 0);
                if (entries.length === 0) throw new Error('Ingresa al menos un precio de mayoreo.');
                for (const [methodName, priceStr] of entries) {
                    const res = await bulkUpdateWholesalePrices(selectedIds, methodName, parseFloat(priceStr));
                    if (!res.success) throw new Error(res.error);
                }
            }
            else if (actionType === 'classification') {
                const updates: any = {};
                if (selectedCategory !== undefined) updates.categoryId = selectedCategory;
                if (selectedSubcategory !== undefined) updates.subcategoryId = selectedSubcategory;
                if (selectedBrand !== undefined) updates.brandId = selectedBrand;
                if (selectedSupplier !== undefined) updates.supplierId = selectedSupplier;

                if (Object.keys(updates).length > 0) {
                    const res = await bulkUpdateClassification(selectedIds, updates);
                    if (!res.success) throw new Error(res.error);
                }
            }
            onSuccess();
        } catch (e: any) {
            setError(e.message || "Ocurrió un error inesperado.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Acciones Masivas</h2>
                        <p className="text-blue-600 font-medium text-sm mt-0.5">{selectedIds.length} productos seleccionados</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 hover:text-gray-700 p-2 rounded-xl transition">
                        ✖
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Action Selector */}
                    <div className="space-y-3 mb-6">
                        <label className="block text-sm font-bold text-gray-700">¿Qué deseas modificar?</label>
                        <select 
                            className="w-full border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                            value={actionType}
                            onChange={(e) => { setActionType(e.target.value); setSubAction(''); setNumValue(''); }}
                        >
                            <option value="" disabled>Selecciona una acción...</option>
                            <option value="visibility">🌐 Publicar / Ocultar de Tienda (Web)</option>
                            <option value="price">💰 Modificar Precio Base Automáticamente</option>
                            <option value="promo">🎉 Configurar Promoción / Oferta Temporal</option>
                            <option value="classification">🏷️ Clasificar (Categoría, Marca, Proveedor)</option>
                            <option value="wholesale">📦 Modificar Precio de Mayoreo</option>
                        </select>
                    </div>

                    {/* Conditional Fields based on actionType */}
                    {actionType === 'visibility' && (
                        <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                            <label className="block text-sm font-bold text-gray-700">Visibilidad Web</label>
                            <select 
                                className="w-full border-gray-200 rounded-xl focus:ring-blue-500"
                                value={subAction}
                                onChange={(e) => setSubAction(e.target.value)}
                            >
                                <option value="" disabled>Elige el estado...</option>
                                <option value="online">Prender (Visible para todos)</option>
                                <option value="offline">Apagar (Oculto en web, solo en POS local)</option>
                            </select>
                            <p className="text-xs text-blue-700 mt-2">
                                Esto aplicará inmediatamente la visibilidad a los {selectedIds.length} artículos en modazapotlanejo.com
                            </p>
                        </div>
                    )}

                    {actionType === 'price' && (
                        <div className="space-y-4 p-4 bg-green-50/50 rounded-xl border border-green-100">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Método de Ajuste Base</label>
                                <select 
                                    className="w-full border-gray-200 rounded-xl focus:ring-green-500"
                                    value={subAction}
                                    onChange={(e) => setSubAction(e.target.value)}
                                >
                                    <option value="" disabled>Selecciona cómo ajustar...</option>
                                    <option value="increase_percent">Aumentar por Porcentaje (%)</option>
                                    <option value="decrease_percent">Disminuir por Porcentaje (%)</option>
                                    <option value="fixed_price">Sobrescribir con Precio Fijo ($)</option>
                                    <option value="fixed_cost">Sobrescribir con Costo Fijo ($)</option>
                                    <option value="clear_promo">Limpiar cualquier Oferta Activa</option>
                                </select>
                            </div>
                            
                            {subAction && subAction !== 'clear_promo' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        {subAction.includes('percent') ? 'Porcentaje %' : 'Precio Exacto $'}
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500 font-bold">{subAction.includes('percent') ? '%' : '$'}</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={numValue}
                                            onChange={(e) => setNumValue(e.target.value)}
                                            placeholder={subAction.includes('percent') ? 'Ej. 10 para subir 10%' : 'Ej. 450.00'}
                                            className="w-full pl-8 border-gray-200 rounded-xl focus:ring-green-500 text-lg font-bold"
                                        />
                                    </div>
                                    <p className="text-xs text-green-700 mt-2">
                                        {subAction === 'increase_percent' && 'Nota: Se tomará el precio actual de cada variante y se le sumará ese porcentaje.'}
                                        {subAction === 'fixed_price' && 'Cuidado: Todos los seleccionados tendrán exactamente este precio de menudeo.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {actionType === 'promo' && (
                        <div className="space-y-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                            <div>
                                <label className="block text-sm font-bold text-purple-900 mb-2">Nuevo Precio de Oferta $</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-purple-500 font-bold">$</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={numValue}
                                        onChange={(e) => setNumValue(e.target.value)}
                                        placeholder="Precio tachado rebajado"
                                        className="w-full pl-8 border-gray-200 rounded-xl focus:ring-purple-500 text-lg font-black text-purple-700"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Inicia el (Opcional)</label>
                                    <input 
                                        type="date" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full border-gray-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Termina el (Opcional)</label>
                                    <input 
                                        type="date" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full border-gray-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            <p className="text-[11px] text-purple-700 leading-tight">
                                Si dejas las fechas en blanco, la oferta será permanente hasta que se limpie manualmente.
                            </p>
                        </div>
                    )}

                    {actionType === 'wholesale' && (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500">Deja en blanco los métodos que no quieras modificar.</p>
                            {['Corrida', 'Paquete', 'Caja'].map(method => (
                                <div key={method} className="flex items-center gap-3">
                                    <label className="text-sm font-bold text-gray-700 w-20">{method}</label>
                                    <input type="number" min="0" step="0.01" placeholder="Sin cambio" value={wholesalePrices[method]} onChange={e => setWholesalePrices(prev => ({...prev, [method]: e.target.value}))} className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50" />
                                    <span className="text-xs text-gray-400">$/pz</span>
                                </div>
                            ))}
                            <p className="text-xs text-gray-400">Solo se actualizarán los productos que tengan cada método configurado.</p>
                        </div>
                    )}

                    {actionType === 'classification' && (
                        <div className="space-y-4 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                            {isLoadingData ? (
                                <p className="text-sm text-gray-500 font-bold text-center py-4">Cargando catálogos...</p>
                            ) : (
                                <>
                                    {/* Categoría */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Categoría</label>
                                        <select 
                                            className="w-full border-gray-200 rounded-lg text-sm bg-white"
                                            value={selectedCategory === undefined ? 'keep' : (selectedCategory === null ? 'null' : selectedCategory)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedCategory(val === 'keep' ? undefined : (val === 'null' ? null : val));
                                                setSelectedSubcategory(undefined); // Resetear subcat si cambia categoría
                                            }}
                                        >
                                            <option value="keep">-- Mantener Actual --</option>
                                            <option value="null">-- Desvincular (Remover Categoría) --</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Subcategoría */}
                                    {selectedCategory && selectedCategory !== 'null' && selectedCategory !== 'keep' && (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Subcategoría (Opcional)</label>
                                            <select 
                                                className="w-full border-gray-200 rounded-lg text-sm bg-white"
                                                value={selectedSubcategory === undefined ? 'keep' : (selectedSubcategory === null ? 'null' : selectedSubcategory)}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setSelectedSubcategory(val === 'keep' ? undefined : (val === 'null' ? null : val));
                                                }}
                                            >
                                                <option value="keep">-- Mantener Actual --</option>
                                                <option value="null">-- Ninguna --</option>
                                                {categories.find(c => c.id === selectedCategory)?.subcategories?.map((sc: any) => (
                                                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Marca */}
                                    <div className="border-t border-orange-200/50 pt-3">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Marca / Colección</label>
                                        <select 
                                            className="w-full border-gray-200 rounded-lg text-sm bg-white"
                                            value={selectedBrand === undefined ? 'keep' : (selectedBrand === null ? 'null' : selectedBrand)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedBrand(val === 'keep' ? undefined : (val === 'null' ? null : val));
                                            }}
                                        >
                                            <option value="keep">-- Mantener Actual --</option>
                                            <option value="null">-- Sin Marca --</option>
                                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                        
                                        {(selectedBrand === undefined || selectedBrand === 'keep') && (
                                            <div className="flex gap-2 mt-2">
                                                <input type="text" placeholder="📝 Crear Nueva Marca..." value={newBrandName} onChange={e => setNewBrandName(e.target.value)} className="flex-1 border-gray-200 rounded-lg text-sm bg-white focus:ring-orange-500" />
                                                <button onClick={handleCreateBrand} disabled={!newBrandName || isSubmitting} className="bg-orange-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50">Crear y Seleccionar</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Proveedor */}
                                    <div className="border-t border-orange-200/50 pt-3">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Proveedor / Fabricante</label>
                                        <select 
                                            className="w-full border-gray-200 rounded-lg text-sm bg-white"
                                            value={selectedSupplier === undefined ? 'keep' : (selectedSupplier === null ? 'null' : selectedSupplier)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedSupplier(val === 'keep' ? undefined : (val === 'null' ? null : val));
                                            }}
                                        >
                                            <option value="keep">-- Mantener Actual --</option>
                                            <option value="null">-- Sin Proveedor --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        
                                        {(selectedSupplier === undefined || selectedSupplier === 'keep') && (
                                            <div className="flex gap-2 mt-2">
                                                <input type="text" placeholder="📝 Crear Nuevo Proveedor..." value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className="flex-1 border-gray-200 rounded-lg text-sm bg-white focus:ring-orange-500" />
                                                <button onClick={handleCreateSupplier} disabled={!newSupplierName || isSubmitting} className="bg-orange-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50">Crear y Seleccionar</button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting || !actionType || (actionType === 'visibility' && !subAction) || (actionType === 'price' && subAction !== 'clear_promo' && !numValue) || (actionType === 'promo' && !numValue) || (actionType === 'classification' && selectedCategory === undefined && selectedSubcategory === undefined && selectedBrand === undefined && selectedSupplier === undefined) || (actionType === 'wholesale' && Object.values(wholesalePrices).every(v => v === ''))}
                        className={`px-6 py-2.5 font-bold text-white rounded-xl shadow-md flex items-center transition
                            ${actionType === 'visibility' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                            ${actionType === 'price' ? 'bg-green-600 hover:bg-green-700' : ''}
                            ${actionType === 'promo' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                            ${actionType === 'classification' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                            ${actionType === 'wholesale' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                            ${!actionType ? 'bg-gray-800' : ''}
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        {isSubmitting ? 'Aplicando...' : 'Aplicar Cambios ⚡'}
                    </button>
                </div>
            </div>
        </div>
    );
}
