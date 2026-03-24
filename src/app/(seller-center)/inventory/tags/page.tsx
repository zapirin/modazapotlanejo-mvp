"use client";

import { useState, useEffect } from "react";
import { Dialog } from '@headlessui/react';
import { getTags, createTag, updateTag, deleteTag } from "./actions";

export default function TagsPage() {
    const [tags, setTags] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [currentTag, setCurrentTag] = useState<any>(null);
    const [formData, setFormData] = useState({ name: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const loadTags = async () => {
        setIsLoading(true);
        const data = await getTags();
        setTags(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadTags();
    }, []);

    const filteredTags = tags.filter(t => 
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    const openCreateModal = () => {
        setModalMode('create');
        setFormData({ name: '' });
        setCurrentTag(null);
        setError("");
        setIsModalOpen(true);
    };

    const openEditModal = (tag: any) => {
        setModalMode('edit');
        setFormData({ name: tag.name });
        setCurrentTag(tag);
        setError("");
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        let res;
        if (modalMode === 'create') {
            res = await createTag(formData.name);
        } else {
            res = await updateTag(currentTag.id, formData.name);
        }

        if (res.success) {
            setIsModalOpen(false);
            loadTags();
        } else {
            setError(res.error || "Error al guardar la etiqueta");
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("¿Está seguro de eliminar esta etiqueta? Se quitará de todos los productos relacionados.")) return;
        
        const res = await deleteTag(id);
        if (res.success) {
            loadTags();
        } else {
            alert(res.error || "Ocurrió un error al eliminar");
        }
    };

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Etiquetas</h1>
                    <p className="mt-2 text-gray-500 font-medium">Clasifique sus productos con palabras clave para búsquedas rápidas (Ej. "#Otoño2024", "#Oferta").</p>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="h-14 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-emerald-500/20 hover:-translate-y-1 flex items-center justify-center gap-3"
                >
                    <span className="text-xl">+</span> Nueva Etiqueta
                </button>
            </div>

            {/* Filters */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <span className="absolute left-4 top-4 text-gray-400">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Buscar etiquetas..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-input border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium text-foreground placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Content List */}
            {isLoading ? (
                <div className="py-20 text-center font-bold text-gray-400 animate-pulse">Cargando etiquetas...</div>
            ) : filteredTags.length === 0 ? (
                <div className="bg-card border-none shadow-xl shadow-gray-200/50 dark:shadow-none rounded-3xl p-16 text-center">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl text-gray-400">🏷️</span>
                    </div>
                    <h3 className="text-2xl font-black text-foreground mb-2">Sin Etiquetas</h3>
                    <p className="text-gray-500 font-medium max-w-sm mx-auto">Cree etiquetas descriptivas para encontrar más rápido su inventario.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredTags.map(tag => (
                        <div key={tag.id} className="relative group bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all flex flex-col items-center justify-center text-center">
                            
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button 
                                    onClick={() => openEditModal(tag)}
                                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-xs"
                                    title="Editar"
                                >
                                    ✏️
                                </button>
                                <button 
                                    onClick={() => handleDelete(tag.id)}
                                    className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:hover:bg-red-600 flex items-center justify-center text-xs text-red-500 transition-colors"
                                    title="Eliminar"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-3">
                                <span>🏷️</span>
                            </div>
                            <h3 className="font-black text-foreground lowercase mb-1 block w-full truncate px-2" title={tag.name}>
                                #{tag.name}
                            </h3>
                            <div className="text-xs font-bold text-gray-400">
                                {tag._count.products} prod{tag._count.products !== 1 ? 's' : ''}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="bg-card w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-border">
                        <Dialog.Title className="text-2xl font-black text-foreground mb-6">
                            {modalMode === 'create' ? 'Nueva Etiqueta' : 'Editar Etiqueta'}
                        </Dialog.Title>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-2">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">Nombre de Etiqueta</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-gray-400 font-bold">#</span>
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                        placeholder="ej-ofertas-de-verano"
                                        className="w-full pl-10 pr-5 py-3 bg-input border-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition text-foreground"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2 font-medium">Los espacios se convertirán en guiones y se guardará en minúsculas.</p>
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
                                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black tracking-wide hover:bg-emerald-700 transition shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                                >
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
