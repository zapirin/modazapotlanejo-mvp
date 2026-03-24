"use client";

import { useState, useEffect } from "react";
import { Dialog } from '@headlessui/react';
import { getCategories, createCategory, updateCategory, deleteCategory, createSubcategory, updateSubcategory, deleteSubcategory } from "./actions";
import { getSessionUser } from "@/app/actions/auth";

export default function CategoriesPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit' | 'createSub' | 'editSub'>('create');
    const [currentCategory, setCurrentCategory] = useState<any>(null);
    const [currentSubcategory, setCurrentSubcategory] = useState<any>(null);
    const [formData, setFormData] = useState({ name: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [user, setUser] = useState<any>(null);

    const loadCategories = async () => {
        setIsLoading(true);
        const [data, userData] = await Promise.all([
            getCategories(),
            getSessionUser()
        ]);
        setCategories(data);
        setUser(userData);
        setIsLoading(false);
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const filteredCategories = categories.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.subcategories?.some((s: any) => s.name.toLowerCase().includes(search.toLowerCase()))
    );

    const openCreateModal = () => {
        setModalMode('create');
        setFormData({ name: '' });
        setCurrentCategory(null);
        setError("");
        setIsModalOpen(true);
    };

    const openEditModal = (category: any) => {
        setModalMode('edit');
        setFormData({ name: category.name });
        setCurrentCategory(category);
        setError("");
        setIsModalOpen(true);
    };

    const openCreateSubModal = (category: any) => {
        setModalMode('createSub');
        setFormData({ name: '' });
        setCurrentCategory(category);
        setError("");
        setIsModalOpen(true);
    };

    const openEditSubModal = (sub: any) => {
        setModalMode('editSub');
        setFormData({ name: sub.name });
        setCurrentSubcategory(sub);
        setError("");
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        let res: any = { success: false, error: "Modo no válido" };
        if (modalMode === 'create') {
            res = await createCategory(formData);
        } else if (modalMode === 'edit') {
            res = await updateCategory(currentCategory.id, formData);
        } else if (modalMode === 'createSub') {
            res = await createSubcategory({ name: formData.name, categoryId: currentCategory.id });
        } else if (modalMode === 'editSub') {
            res = await updateSubcategory(currentSubcategory.id, formData);
        }

        if (res?.success) {
            setIsModalOpen(false);
            loadCategories();
        } else {
            setError(res?.error || "Error al guardar");
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Está seguro de eliminar esta categoría? Se conservarán los productos relacionados.")) return;
        const res = await deleteCategory(id);
        if (res.success) loadCategories();
        else alert(res.error || "Error al eliminar");
    };

    const handleDeleteSub = async (id: string) => {
        if (!window.confirm("¿Está seguro de eliminar esta subcategoría?")) return;
        const res = await deleteSubcategory(id);
        if (res.success) loadCategories();
        else alert(res.error || "Error al eliminar");
    };

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight italic">CATÁLOGO</h1>
                    <p className="mt-2 text-gray-500 font-medium">Gestión de categorías y subcategorías principales.</p>
                </div>
                {user?.role === 'ADMIN' && (
                    <button 
                        onClick={openCreateModal}
                        className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-500/20 hover:-translate-y-1 flex items-center justify-center gap-3"
                    >
                        <span className="text-xl">+</span> Nueva Categoría
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <span className="absolute left-4 top-4 text-gray-400">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Buscar categoría o subcategoría..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-input border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium text-foreground placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Content List */}
            {isLoading ? (
                <div className="py-20 text-center font-bold text-gray-400 animate-pulse">Cargando categorías...</div>
            ) : filteredCategories.length === 0 ? (
                <div className="bg-card border-none shadow-xl shadow-gray-200/50 dark:shadow-none rounded-3xl p-16 text-center">
                    <h3 className="text-2xl font-black text-foreground mb-2">Sin resultados</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredCategories.map(category => (
                        <div key={category.id} className="bg-card border border-border rounded-[2rem] p-8 shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full bg-gradient-to-b from-card to-gray-50/30 dark:to-gray-900/10">
                            <div className="mb-6">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-black text-2xl text-foreground group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                                        {category.name}
                                    </h3>
                                    {user?.role === 'ADMIN' && (
                                        <div className="flex gap-1">
                                            <button onClick={() => openEditModal(category)} className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-lg transition">✏️</button>
                                            <button onClick={() => handleDelete(category.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-lg transition">🗑️</button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2 mb-6">
                                    <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100 dark:border-blue-800">
                                        {category._count.products} Modelos
                                    </span>
                                </div>

                                {/* Subcategories Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Subcategorías</h4>
                                        {user?.role === 'ADMIN' && (
                                            <button 
                                                onClick={() => openCreateSubModal(category)}
                                                className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                            >
                                                + AGREGAR
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {category.subcategories?.length > 0 ? (
                                            category.subcategories.map((sub: any) => (
                                                <div key={sub.id} className="group/sub relative flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-border rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:border-blue-200 transition-all">
                                                    <span>{sub.name}</span>
                                                    <span className="opacity-40 text-[9px] font-black">({sub._count?.products || 0})</span>
                                                    {user?.role === 'ADMIN' && (
                                                        <div className="hidden group-hover/sub:flex items-center ml-1 gap-1">
                                                            <button onClick={() => openEditSubModal(sub)} className="hover:text-blue-600">✏️</button>
                                                            <button onClick={() => handleDeleteSub(sub.id)} className="hover:text-red-500">×</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-[11px] text-gray-400 font-medium italic">Sin subcategorías definidas</p>
                                        )}
                                    </div>
                                </div>
                            </div>
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
                            {(modalMode === 'create' || modalMode === 'edit') ? (modalMode === 'create' ? 'Nueva Categoría' : 'Editar Categoría') : (modalMode === 'createSub' ? 'Nueva Subcategoría' : 'Editar Subcategoría')}
                        </Dialog.Title>

                        {modalMode === 'createSub' && <p className="text-xs font-bold text-blue-600 mb-4 uppercase tracking-widest">En: {currentCategory?.name}</p>}

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-2">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">Nombre</label>
                                <input 
                                    type="text" 
                                    required
                                    autoFocus
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="Ingrese nombre..."
                                    className="w-full px-5 py-3 bg-input border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-foreground"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition">Cancelar</button>
                                <button type="submit" disabled={isSubmitting} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black tracking-wide hover:bg-blue-700 transition shadow-xl shadow-blue-500/20 disabled:opacity-50">
                                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </div>
    );
}
