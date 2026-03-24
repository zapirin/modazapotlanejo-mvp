"use client";

import { useState, useEffect } from "react";
import { Dialog } from '@headlessui/react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "./actions";

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    
    const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [currentSupplier, setCurrentSupplier] = useState<any>(null);
    const [formData, setFormData] = useState({ name: '', notes: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const loadSuppliers = async () => {
        setIsLoading(true);
        const data = await getSuppliers();
        setSuppliers(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadSuppliers();
    }, []);

    const filteredSuppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        (s.notes && s.notes.toLowerCase().includes(search.toLowerCase()))
    );

    const openCreateModal = () => {
        setModalMode('create');
        setFormData({ name: '', notes: '' });
        setCurrentSupplier(null);
        setError("");
        setIsModalOpen(true);
    };

    const openEditModal = (supplier: any) => {
        setModalMode('edit');
        setFormData({ name: supplier.name, notes: supplier.notes || '' });
        setCurrentSupplier(supplier);
        setError("");
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        let res;
        if (modalMode === 'create') {
            res = await createSupplier(formData);
        } else {
            res = await updateSupplier(currentSupplier.id, formData);
        }

        if (res.success) {
            setIsModalOpen(false);
            loadSuppliers();
        } else {
            setError(res.error || "Error al guardar el proveedor");
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Está seguro de eliminar este proveedor? Se conservarán los productos relacionados.")) return;
        
        const res = await deleteSupplier(id);
        if (res.success) {
            loadSuppliers();
        } else {
            alert(res.error || "Ocurrió un error al eliminar");
        }
    };

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Proveedores</h1>
                    <p className="mt-2 text-gray-500 font-medium">Gestione el directorio de fabricantes y mayoristas de su mercancía.</p>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-500/20 hover:-translate-y-1 flex items-center justify-center gap-3"
                >
                    <span className="text-xl">+</span> Nuevo Proveedor
                </button>
            </div>

            {/* Filters */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <span className="absolute left-4 top-4 text-gray-400">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o notas..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-input border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium text-foreground placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Content List */}
            {isLoading ? (
                <div className="py-20 text-center font-bold text-gray-400 animate-pulse">Cargando proveedores...</div>
            ) : filteredSuppliers.length === 0 ? (
                <div className="bg-card border-none shadow-xl shadow-gray-200/50 dark:shadow-none rounded-3xl p-16 text-center">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl text-gray-400">🏢</span>
                    </div>
                    <h3 className="text-2xl font-black text-foreground mb-2">Sin Proveedores</h3>
                    <p className="text-gray-500 font-medium max-w-sm mx-auto">Agregue su primer proveedor para organizar mejor sus productos.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredSuppliers.map(supplier => {
                        const isExpanded = expandedSupplierId === supplier.id;
                        return (
                            <div key={supplier.id} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden">
                                <div className="flex flex-col lg:flex-row justify-between gap-8">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-4 mb-4">
                                            <h3 className="font-black text-2xl text-foreground group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                                                {supplier.name}
                                            </h3>
                                            <div className="flex gap-2">
                                                <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                    {supplier._count.products} Productos
                                                </div>
                                                <div className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider flex items-center gap-1">
                                                    <span>📦</span> {supplier.totalStock || 0} Uds
                                                </div>
                                            </div>
                                        </div>
                                        {supplier.notes ? (
                                            <p className="text-sm text-gray-500 line-clamp-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl italic border-l-4 border-blue-500">
                                                "{supplier.notes}"
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">Sin notas adicionales.</p>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-wrap lg:flex-nowrap gap-3 items-center">
                                        <button 
                                            onClick={() => setExpandedSupplierId(isExpanded ? null : supplier.id)}
                                            className={`h-12 px-6 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                                isExpanded 
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                                : 'bg-gray-100 dark:bg-gray-800 text-foreground hover:bg-gray-200'
                                            }`}
                                        >
                                            {isExpanded ? 'Ocultar Inventario' : 'Ver Inventario'}
                                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        <div className="h-10 w-[1px] bg-border hidden lg:blockmx-2"></div>
                                        <button 
                                            onClick={() => openEditModal(supplier)}
                                            className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center"
                                            title="Editar"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(supplier.id)}
                                            className="h-12 w-12 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                                            title="Eliminar"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Content: Products List */}
                                <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100 mt-10 border-t border-border pt-8' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl">🛒</div>
                                        <h4 className="font-black text-lg text-foreground uppercase tracking-tight">Catálogo de Productos</h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {supplier.products && supplier.products.length > 0 ? (
                                            supplier.products.map((product: any) => {
                                                const productStock = product.variants.reduce((acc: number, v: any) => acc + v.inventoryLevels.reduce((acc2: number, i: any) => acc2 + i.stock, 0), 0);
                                                return (
                                                    <div key={product.id} className="bg-gray-50 dark:bg-gray-900/40 border border-border rounded-3xl p-5 hover:border-blue-500/50 transition-colors">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <p className="font-black text-sm text-foreground leading-tight">{product.name}</p>
                                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Ref: {product.id.slice(-6).toUpperCase()}</p>
                                                            </div>
                                                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${productStock > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                                {productStock} UDS
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2 mt-4">
                                                            {product.variants.map((v: any) => {
                                                                const variantStock = v.inventoryLevels.reduce((acc: number, i: any) => acc + i.stock, 0);
                                                                return (
                                                                    <div key={v.id} className="flex justify-between items-center text-[11px] font-medium bg-white dark:bg-gray-800 p-2 rounded-xl border border-border/50">
                                                                        <span className="text-gray-600 dark:text-gray-300">Talla {v.size} / {v.color}</span>
                                                                        <span className="font-black text-foreground">{variantStock}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-full py-10 text-center bg-gray-50 dark:bg-gray-900 rounded-3xl border-2 border-dashed border-border">
                                                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Este proveedor no tiene productos asociados activos.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="bg-card w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-border">
                        <Dialog.Title className="text-2xl font-black text-foreground mb-6">
                            {modalMode === 'create' ? 'Nuevo Proveedor' : 'Editar Proveedor'}
                        </Dialog.Title>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-2">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">Nombre Comercial</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="Ej. Textiles del Centro..."
                                    className="w-full px-5 py-3 bg-input border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-foreground"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">Notas (Opcional)</label>
                                <textarea 
                                    rows={3}
                                    value={formData.notes}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                    placeholder="Datos de contacto, días de visita..."
                                    className="w-full px-5 py-3 bg-input border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-foreground"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black tracking-wide hover:bg-blue-700 transition shadow-xl shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Guardando...' : 'Guardar Proveedor'}
                                </button>
                            </div>
                        </form>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </div>
    );
}
