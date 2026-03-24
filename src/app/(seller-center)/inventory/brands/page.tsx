"use client";

import { useState, useEffect } from "react";
import { Dialog } from '@headlessui/react';
import { getBrands, createBrand, updateBrand, deleteBrand } from "./actions";
import { getSessionUser } from "@/app/actions/auth";

export default function BrandsPage() {
    const [brands, setBrands] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [currentBrand, setCurrentBrand] = useState<any>(null);
    const [formData, setFormData] = useState({ name: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [user, setUser] = useState<any>(null);

    const loadBrands = async () => {
        setIsLoading(true);
        const [data, userData] = await Promise.all([
            getBrands(),
            getSessionUser()
        ]);
        setBrands(data);
        setUser(userData);
        setIsLoading(false);
    };

    useEffect(() => {
        loadBrands();
    }, []);

    const filteredBrands = brands.filter(b => 
        b.name.toLowerCase().includes(search.toLowerCase())
    );

    const openCreateModal = () => {
        setModalMode('create');
        setFormData({ name: '' });
        setCurrentBrand(null);
        setError("");
        setIsModalOpen(true);
    };

    const openEditModal = (brand: any) => {
        setModalMode('edit');
        setFormData({ name: brand.name });
        setCurrentBrand(brand);
        setError("");
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        let res;
        if (modalMode === 'create') {
            res = await createBrand(formData);
        } else {
            res = await updateBrand(currentBrand.id, formData);
        }

        if (res.success) {
            setIsModalOpen(false);
            loadBrands();
        } else {
            setError(res.error || "Error al guardar la marca");
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Está seguro de eliminar esta marca? Se conservarán los productos relacionados.")) return;
        
        const res = await deleteBrand(id);
        if (res.success) {
            loadBrands();
        } else {
            alert(res.error || "Ocurrió un error al eliminar");
        }
    };

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Marcas</h1>
                    <p className="mt-2 text-gray-500 font-medium">Gestione el catálogo de marcas disponibles en su inventario.</p>
                </div>
                {user?.role === 'ADMIN' && (
                    <button 
                        onClick={openCreateModal}
                        className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-500/20 hover:-translate-y-1 flex items-center justify-center gap-3"
                    >
                        <span className="text-xl">+</span> Nueva Marca
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <span className="absolute left-4 top-4 text-gray-400">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-input border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium text-foreground placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Content List */}
            {isLoading ? (
                <div className="py-20 text-center font-bold text-gray-400 animate-pulse">Cargando marcas...</div>
            ) : filteredBrands.length === 0 ? (
                <div className="bg-card border-none shadow-xl shadow-gray-200/50 dark:shadow-none rounded-3xl p-16 text-center">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl text-gray-400">🏷️</span>
                    </div>
                    <h3 className="text-2xl font-black text-foreground mb-2">Sin Marcas</h3>
                    <p className="text-gray-500 font-medium max-w-sm mx-auto">Agregue su primera marca para organizar mejor sus productos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredBrands.map(brand => (
                        <div key={brand.id} className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-black text-xl text-foreground group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                                        {brand.name}
                                    </h3>
                                </div>
                                
                                <div className="flex flex-col gap-2 items-start mb-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold">
                                        {brand._count.products} Productos
                                    </div>
                                </div>
                            </div>
                            
                            {user?.role === 'ADMIN' && (
                                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                    <button 
                                        onClick={() => openEditModal(brand)}
                                        className="flex-1 py-2 rounded-xl text-sm font-bold bg-gray-100 dark:bg-gray-800 text-foreground hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                                    >
                                        Editar
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(brand.id)}
                                        className="py-2 px-4 rounded-xl text-sm font-bold text-red-500 bg-red-50 hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:hover:bg-red-600 dark:hover:text-white transition"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="bg-card w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-border">
                        <Dialog.Title className="text-2xl font-black text-foreground mb-6">
                            {modalMode === 'create' ? 'Nueva Marca' : 'Editar Marca'}
                        </Dialog.Title>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-2">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">Nombre de la Marca</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="Ej. Nike, Adidas..."
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
                                    {isSubmitting ? 'Guardando...' : 'Guardar Marca'}
                                </button>
                            </div>
                        </form>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </div>
    );
}
