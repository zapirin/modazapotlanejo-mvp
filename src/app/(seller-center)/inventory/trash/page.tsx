"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDeletedInventory, restoreProduct, hardDeleteProduct } from './actions';

export default function TrashPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadInventory();
    }, []);

    const loadInventory = async () => {
        setLoading(true);
        try {
            const data = await getDeletedInventory();
            setProducts(data);
        } catch (error) {
            console.error("Error loading trash inventory:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (productId: string) => {
        const res = await restoreProduct(productId);
        if (res.success) {
            loadInventory();
        } else {
            alert(res.error || "No se pudo restaurar el producto.");
        }
    };

    const handleHardDelete = async (productId: string) => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar DEFINITIVAMENTE este producto? Esta acción no se puede deshacer y fallará si tiene ventas registradas.")) return;
        
        const res = await hardDeleteProduct(productId);
        if (res.success) {
            loadInventory();
        } else {
            alert(res.error || "No se pudo eliminar el producto.");
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-6 lg:py-10 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <span className="text-red-500">🗑️</span> Papelera
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium mt-2">Productos que han sido desactivados. Puedes restaurarlos o eliminarlos permanentemente (si no tienen ventas).</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <Link href="/inventory" className="flex-1 md:flex-none px-6 py-3 bg-card border border-border text-foreground font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm text-center">
                        Volver al Inventario
                    </Link>
                </div>
            </div>

            <div className="bg-card rounded-3xl shadow-2xl border border-border overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-80 gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-red-600"></div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Cargando Papelera...</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 text-center px-6">
                        <span className="text-6xl mb-6">✨</span>
                        <h2 className="text-xl font-black text-foreground mb-2">Papelera Vacía</h2>
                        <p className="text-gray-500 max-w-sm mb-6">No tienes productos eliminados recientemente.</p>
                        <Link href="/inventory" className="px-8 py-3 bg-foreground text-background font-black rounded-xl hover:opacity-90 transition">Ver Inventario Activo</Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-800/30 border-b border-border text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                    <th className="p-5">Modelo / Prenda</th>
                                    <th className="p-5">Categoría</th>
                                    <th className="p-5 text-center">Matriz</th>
                                    <th className="p-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {products.map((product) => {
                                    const colorsCount = new Set(product.variants.map((v: any) => v.color)).size;
                                    const sizesCount = new Set(product.variants.map((v: any) => v.size)).size;

                                    return (
                                        <tr key={product.id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors group">
                                            <td className="p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-2xl overflow-hidden shadow-inner flex-shrink-0 opacity-50 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all">
                                                        {product.images?.[0] ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" /> : '👕'}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-foreground text-lg tracking-tight leading-tight line-through opacity-70 group-hover:opacity-100">{product.name}</p>
                                                        <p className="text-xs text-red-500 font-bold mt-1">${product.price}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-foreground text-xs font-bold rounded-lg uppercase tracking-wider opacity-60">
                                                    {product.category?.name || 'Varios'} {product.subcategory ? `- ${product.subcategory.name}` : ''}
                                                </span>
                                            </td>
                                            <td className="p-5 text-center opacity-60">
                                                <div className="text-[10px] font-bold uppercase tracking-wider">
                                                    {colorsCount} Colores &bull; {sizesCount} Tallas
                                                </div>
                                            </td>
                                            <td className="p-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleRestore(product.id)}
                                                        className="px-4 py-2 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 font-bold text-xs rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition flex items-center gap-2"
                                                    >
                                                        <span>♻️</span> Restaurar
                                                    </button>
                                                    <button 
                                                        onClick={() => handleHardDelete(product.id)}
                                                        className="px-4 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-bold text-xs rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center gap-2"
                                                        title="Eliminar de forma permanente"
                                                    >
                                                        <span>❌</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
