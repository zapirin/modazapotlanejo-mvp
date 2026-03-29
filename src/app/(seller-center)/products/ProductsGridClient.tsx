"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import ProductCardButtons from './ProductCardButtons';
import GenerateSKUsButton from './GenerateSKUsButton';
import BulkActionsModal from './BulkActionsModal';

export default function ProductsGridClient({ products, limitNum, limitError }: any) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all'); // all, published, draft
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default to list for Kalexa

    const publishedCount = products.filter((p: any) => p.isOnline || p.isPOS).length;
    const draftCount = products.filter((p: any) => !p.isOnline && !p.isPOS).length;
    const missingSkuCount = products.filter((p: any) => !p.sku).length;

    const filteredProducts = products.filter((p: any) => {
        if (activeTab === 'published') return p.isOnline || p.isPOS;
        if (activeTab === 'draft') return !p.isOnline && !p.isPOS;
        return true;
    });

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(filteredProducts.map((p: any) => p.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
            {limitError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
                    <span className="text-red-500 text-xl">🚫</span>
                    <div>
                        <p className="font-black text-red-700">Límite de productos alcanzado</p>
                        <p className="text-sm text-red-600">
                            {limitNum ? `Tu plan permite máximo ${limitNum} productos.` : 'Tu plan no permite crear más productos.'} Contacta al administrador para aumentar tu límite.
                        </p>
                    </div>
                </div>
            )}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Inventario (Mis Productos)</h1>
                    <p className="text-gray-500 mt-1">Gestiona rápidamente todo tu catálogo y aplica configuraciones masivas.</p>
                </div>
                <div className="flex items-center gap-3">
                    <GenerateSKUsButton missingCount={missingSkuCount} />
                    <Link href="/products/new" className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-md flex items-center gap-2">
                        <span className="text-xl leading-none">+</span> Añadir
                    </Link>
                </div>
            </div>

            {/* Pestañas (Tabs) y Bulk Actions Bar */}
            <div className="border-b border-gray-200 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-6 overflow-x-auto whitespace-nowrap">
                    <button onClick={() => setActiveTab('all')} className={`pb-3 border-b-2 px-2 ${activeTab === 'all' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Todos ({products.length})</button>
                    <button onClick={() => setActiveTab('published')} className={`pb-3 border-b-2 px-2 ${activeTab === 'published' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Publicados ({publishedCount})</button>
                    <button onClick={() => setActiveTab('draft')} className={`pb-3 border-b-2 px-2 ${activeTab === 'draft' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Ocultos ({draftCount})</button>
                </div>
                
                <div className="flex items-center gap-4 pb-3 sm:pb-0">
                    {/* View Toggles */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                            ☰ Lista
                        </button>
                        <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                            ⊞ Tarjetas
                        </button>
                    </div>

                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-3 bg-blue-50 py-1.5 px-4 rounded-xl border border-blue-100 shadow-sm animate-fade-in">
                            <span className="text-blue-800 font-bold text-sm hidden sm:inline">{selectedIds.length} seleccionados</span>
                            <button 
                                onClick={() => setIsBulkModalOpen(true)}
                                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 transition"
                            >
                                ⚡ Editar Masivamente
                            </button>
                            <button onClick={() => setSelectedIds([])} className="text-sm font-bold text-gray-500 hover:text-red-600 px-2 py-1.5 rounded bg-gray-100">
                                ✖ Deshacer
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Empty State */}
            {products.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <span className="text-5xl mb-4 block">📦</span>
                    <h3 className="text-lg font-bold text-gray-900">Aún no tienes productos</h3>
                    <p className="text-gray-500 mt-2 mb-6">Comienza a agregar tu catálogo para vender en línea y punto de venta.</p>
                    <Link href="/products/new" className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 inline-block">
                        Crear mi primer producto
                    </Link>
                </div>
            ) : viewMode === 'list' ? (
                /* --- VISTA DE LISTA COMPACTA (Estilo PHP POS) --- */
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 w-10">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="px-4 py-3 min-w-[140px]">Comportamiento</th>
                                    <th className="px-4 py-3">Nombre / Modelo</th>
                                    <th className="px-4 py-3 whitespace-nowrap">ID / SKU</th>
                                    <th className="px-4 py-3 text-right">Precio Venta</th>
                                    <th className="px-4 py-3 text-center">Cantidad</th>
                                    <th className="px-4 py-3">Visibilidad</th>
                                    <th className="px-4 py-3 text-center">Foto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProducts.map((product: any) => {
                                    const isSelected = selectedIds.includes(product.id);
                                    const isDraft = !product.isOnline && !product.isPOS;
                                    const stockSum = product.variants ? product.variants.reduce((acc: number, v: any) => acc + (v.stock || 0), 0) : 0;
                                    
                                    return (
                                        <tr 
                                            key={product.id} 
                                            className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                                            onClick={() => handleSelectOne(product.id)}
                                        >
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectOne(product.id)}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-2">
                                                    <Link href={`/products/${product.id}/edit`} className="bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 font-medium px-3 py-1 rounded text-xs transition">
                                                        Editar
                                                    </Link>
                                                    {/* Botón rápido extra opcional */}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-blue-600 hover:underline">
                                                <Link href={`/products/${product.id}/edit`} onClick={(e) => e.stopPropagation()}>{product.name}</Link>
                                                {product.promotionalPrice && (
                                                    <span className="ml-2 bg-purple-100 text-purple-700 text-[9px] uppercase px-1.5 py-0.5 rounded font-black tracking-wider">Oferta</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                                                {product.sku || product.id.slice(-6)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {product.promotionalPrice && (
                                                    <div className="text-[10px] text-gray-400 line-through">${product.price.toFixed(2)}</div>
                                                )}
                                                <span className={`font-black ${product.promotionalPrice ? 'text-purple-700' : 'text-gray-900'}`}>
                                                    ${(product.promotionalPrice || product.price).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`font-bold ${stockSum > 0 ? 'text-blue-600' : 'text-red-500'}`}>{stockSum}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm ${product.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {product.isOnline ? '🌐 Web' : '🚫 Oculto'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {product.images?.[0] ? (
                                                    <img src={product.images[0]} className="w-8 h-10 object-cover mx-auto rounded border border-gray-200" alt="thmb" />
                                                ) : (
                                                    <span className="text-gray-300 text-xs italic">N/A</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* --- VISTA DE TARJETAS ORIGINAL --- */
                <>
                    {/* Header para "Select All" en vista grid */}
                    {filteredProducts.length > 0 && (
                        <div className="flex items-center gap-3 mb-4 px-2">
                             <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                                checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                                onChange={handleSelectAll}
                             />
                             <span className="text-sm font-medium text-gray-600">Seleccionar todos en esta pestaña</span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProducts.map((product: any) => {
                            const isDraft = !product.isOnline && !product.isPOS;
                            const isSelected = selectedIds.includes(product.id);
                            
                            return (
                                <div key={product.id} 
                                    className={`relative bg-white justify-between flex flex-col rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer ${
                                    isSelected ? 'border-blue-500 ring-2 ring-blue-200 shadow-md scale-[1.02]' : 'border-gray-200 shadow-sm hover:shadow-md'
                                } ${isDraft ? 'opacity-85' : ''}`}
                                    onClick={() => handleSelectOne(product.id)}>
                                    
                                    {/* Checkbox overlay */}
                                    <div className="absolute top-3 left-3 z-10 bg-white/50 backdrop-blur rounded p-1" onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleSelectOne(product.id)}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                                        />
                                    </div>

                                    {/* Insignias de Estado */}
                                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded shadow-sm ${product.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {product.isOnline ? '🌐 Web' : '🚫 Oculto Web'}
                                        </span>
                                        {product.promotionalPrice && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded shadow-sm bg-purple-100 text-purple-700">
                                                ★ Oferta Activa
                                            </span>
                                        )}
                                    </div>

                                    <div className="h-48 bg-gray-100 flex flex-col items-center justify-center border-b border-gray-100 relative group">
                                        {product.images && product.images.length > 0 ? (
                                            <img
                                                src={product.images[0]}
                                                alt={product.name}
                                                className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`}
                                                loading="lazy"
                                                suppressHydrationWarning
                                            />
                                        ) : (
                                            <>
                                                <span className="text-4xl mb-2 grayscale opacity-50">📸</span>
                                                <span className="text-xs text-gray-500 font-medium tracking-wide uppercase">Sin foto</span>
                                            </>
                                        )}
                                        {/* Efecto de Check */}
                                        <div className={`absolute inset-0 bg-blue-600/10 pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}></div>
                                    </div>
                                    
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-gray-900 line-clamp-2 leading-tight" title={product.name}>{product.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-2 mb-3">
                                                {product.sku ? (
                                                    <span className="text-[10px] font-mono font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded tracking-wider">{product.sku}</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">Sin SKU</span>
                                                )}
                                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{product.category?.name || 'General'}</span>
                                            </div>

                                            <div className="bg-gray-50 rounded-lg p-2.5 space-y-1.5 mb-4 border border-gray-100">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-500 font-medium">General:</span>
                                                    <div className="text-right">
                                                        {product.promotionalPrice && (
                                                            <span className="text-[10px] text-gray-400 line-through mr-1">${product.price.toFixed(2)}</span>
                                                        )}
                                                        <span className={`font-black text-sm ${product.promotionalPrice ? 'text-purple-700' : 'text-gray-900'}`}>
                                                            ${(product.promotionalPrice || product.price).toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            {isDraft ? (
                                                <Link href={`/products/${product.id}/edit`} className="flex-1 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded hover:bg-gray-800 text-center shadow-sm">
                                                    Editar Datos
                                                </Link>
                                            ) : (
                                                <ProductCardButtons productId={product.id} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {isBulkModalOpen && (
                <BulkActionsModal 
                    selectedIds={selectedIds} 
                    onClose={() => setIsBulkModalOpen(false)}
                    onSuccess={() => {
                        setIsBulkModalOpen(false);
                        setSelectedIds([]);
                    }}
                />
            )}
        </div>
    );
}
