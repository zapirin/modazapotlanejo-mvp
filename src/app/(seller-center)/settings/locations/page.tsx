"use client";
import { toast } from 'sonner';

import React, { useState, useEffect } from 'react';
import { getLocationsSettings, updateLocationTicketConfig, createStoreLocation, deleteStoreLocation, updateStoreLocationName } from '../actions';

export default function LocationsSettingsPage() {
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [locName, setLocName] = useState('');
    const [locAddress, setLocAddress] = useState('');
    const [ticketHeader, setTicketHeader] = useState('');
    const [ticketFooter, setTicketFooter] = useState('');
    const [showDateAndTimeToPos, setShowDateAndTimeToPos] = useState(true);
    const [saving, setSaving] = useState(false);

    // New Location State
    const [showNewModal, setShowNewModal] = useState(false);
    // Edit name/address state
    const [editNameId, setEditNameId] = useState<string | null>(null);
    const [editNameVal, setEditNameVal] = useState('');
    const [editAddrVal, setEditAddrVal] = useState('');
    const [newName, setNewName] = useState('');
    const [newAddress, setNewAddress] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const res = await getLocationsSettings();
        if (res.success && res.data) {
            setLocations(res.data);
        }
        setLoading(false);
    };

    const handleDeleteLocation = async (loc: any) => {
        if (!confirm(`¿Eliminar la locación "${loc.name}"? Esta acción no se puede deshacer.`)) return;
        const res = await deleteStoreLocation(loc.id);
        if (res.success) { toast.success('Locación eliminada'); loadData(); }
        else toast.error(res.error || 'Error al eliminar');
    };

    const handleSaveName = async (locId: string) => {
        if (!editNameVal.trim()) return;
        const res = await updateStoreLocationName(locId, editNameVal.trim(), editAddrVal.trim() || undefined);
        if (res.success) { toast.success('Locación actualizada'); setEditNameId(null); loadData(); }
        else toast.error(res.error || 'Error al actualizar');
    };

    const handleEdit = (loc: any) => {
        setEditingId(loc.id);
        setLocName(loc.name || '');
        setLocAddress(loc.address || '');
        setTicketHeader(loc.ticketHeader || '');
        setTicketFooter(loc.ticketFooter || '');
        setShowDateAndTimeToPos(loc.showDateAndTimeToPos !== false);
    };

    const handleCancel = () => {
        setEditingId(null);
    };

    const handleSave = async (id: string) => {
        setSaving(true);
        const res = await updateLocationTicketConfig(id, {
            name: locName,
            address: locAddress,
            ticketHeader,
            ticketFooter,
            showDateAndTimeToPos
        });
        
        if (res.success) {
            alert("Configuración de sucursal guardada.");
            setEditingId(null);
            loadData();
        } else {
            alert("Error: " + res.error);
        }
        setSaving(false);
    };

    const handleCreateLocation = async () => {
        if (!newName.trim()) return alert("El nombre es requerido");
        setSaving(true);
        const res = await createStoreLocation({
            name: newName,
            address: newAddress
        });
        if (res.success) {
            setShowNewModal(false);
            setNewName('');
            setNewAddress('');
            loadData();
        } else {
            alert("Error: " + res.error);
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="p-10 flex justify-center">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 space-y-8 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Sucursales y Tickets</h1>
                    <p className="text-gray-500 font-medium mt-2">Personaliza el recibo de venta y cuenta de tiendas.</p>
                </div>
                <button
                    onClick={() => setShowNewModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Nueva Sucursal
                </button>
            </div>

            <div className="grid gap-6">
                {locations.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 font-bold uppercase tracking-widest bg-card border-dashed border-2 border-border rounded-3xl">
                        No hay locaciones registradas
                    </div>
                ) : locations.map((loc) => {
                    const isEditing = editingId === loc.id;
                    return (
                        <div key={loc.id} className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm transition-all hover:shadow-md">
                            {/* Header Row */}
                            <div className="p-6 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/20">
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl">🏬</span>
                                    <div>
                                        <h2 className="text-lg font-black text-foreground">{loc.name}</h2>
                                        <p className="text-xs text-gray-500 font-medium">{loc.address || 'Sin dirección registrada'}</p>
                                    </div>
                                </div>
                                {!isEditing && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { setEditNameId(loc.id); setEditNameVal(loc.name || ''); setEditAddrVal(loc.address || ''); }}
                                            className="px-3 py-2 bg-white dark:bg-gray-800 border border-border text-foreground rounded-xl font-bold text-xs hover:border-blue-500 hover:text-blue-600 transition-colors shadow-sm"
                                            title="Editar nombre y dirección"
                                        >✏️ Editar</button>
                                        <button
                                            onClick={() => handleEdit(loc)}
                                            className="px-3 py-2 bg-white dark:bg-gray-800 border border-border text-foreground rounded-xl font-bold text-xs hover:border-blue-500 hover:text-blue-600 transition-colors shadow-sm"
                                        >🎫 Ticket</button>
                                        <button
                                            onClick={() => handleDeleteLocation(loc)}
                                            className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 transition-colors shadow-sm"
                                            title="Eliminar locación"
                                        >🗑</button>
                                    </div>
                                )}
                            </div>

                            {/* Mini form editar nombre/dirección */}
                            {editNameId === loc.id && (
                                <div className="p-6 border-t border-border space-y-3 bg-blue-50/50 dark:bg-blue-900/10">
                                    <p className="text-xs font-black uppercase tracking-widest text-blue-600">Editar Nombre y Dirección</p>
                                    <div className="flex gap-3">
                                        <input value={editNameVal} onChange={e => setEditNameVal(e.target.value)}
                                            placeholder="Nombre de la sucursal"
                                            className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-bold bg-input text-foreground focus:ring-2 focus:ring-blue-500/50 outline-none" />
                                        <input value={editAddrVal} onChange={e => setEditAddrVal(e.target.value)}
                                            placeholder="Dirección (opcional)"
                                            className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-bold bg-input text-foreground focus:ring-2 focus:ring-blue-500/50 outline-none" />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setEditNameId(null)} className="px-4 py-2 border border-border rounded-xl text-xs font-black text-gray-500 hover:bg-gray-50">Cancelar</button>
                                        <button onClick={() => handleSaveName(loc.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black">Guardar</button>
                                    </div>
                                </div>
                            )}

                            {/* Editing Form */}
                            {isEditing && (
                                <div className="p-6 border-t border-border space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-border">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre de la Sucursal</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold text-sm"
                                                value={locName}
                                                onChange={e => setLocName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dirección Física</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold text-sm"
                                                value={locAddress}
                                                onChange={e => setLocAddress(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex justify-between">
                                                Mensaje Superior (Ticket Header)
                                                <span className="text-blue-500 lowercase tracking-normal italic">Subtítulo debajo del logo</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold text-sm"
                                                placeholder="e.g. Plaza Zapotlanejo Loc. 14"
                                                value={ticketHeader}
                                                onChange={e => setTicketHeader(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex justify-between">
                                                Políticas de Venta (Ticket Footer)
                                                <span className="text-blue-500 lowercase tracking-normal italic">Garantías o despedida</span>
                                            </label>
                                            <textarea
                                                rows={2}
                                                className="w-full px-4 py-2 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold text-sm resize-none"
                                                placeholder="e.g. No hay cambios ni devoluciones..."
                                                value={ticketFooter}
                                                onChange={e => setTicketFooter(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Configuración Punto de Venta */}
                                    <div className="pt-4 border-t border-border flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id={`showDate-${loc.id}`}
                                            className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                                            checked={showDateAndTimeToPos}
                                            onChange={e => setShowDateAndTimeToPos(e.target.checked)}
                                        />
                                        <label htmlFor={`showDate-${loc.id}`} className="font-bold text-sm text-foreground cursor-pointer select-none">
                                            Mostrar la Fecha y Hora en tiempo real en la pantalla de la Caja (POS).
                                        </label>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4">
                                        <button
                                            onClick={handleCancel}
                                            className="px-6 py-2 text-gray-500 hover:text-gray-900 dark:hover:text-white font-bold text-sm transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => handleSave(loc.id)}
                                            disabled={saving}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                        >
                                            {saving ? 'Aplicando...' : 'Aplicar Cambios'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal Nueva Sucursal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border">
                            <h2 className="text-xl font-black text-foreground">Crear Nueva Sucursal</h2>
                            <p className="text-sm text-gray-500 mt-1">Habilita un nuevo Punto de Venta.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre de la Sucursal *</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold text-sm"
                                    placeholder="Ej. Tienda Centro"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dirección (Opcional)</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-sm resize-none"
                                    placeholder="Calle, Número, Colonia..."
                                    rows={2}
                                    value={newAddress}
                                    onChange={e => setNewAddress(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-gray-50 dark:bg-gray-800/30 flex justify-end gap-3">
                            <button
                                onClick={() => setShowNewModal(false)}
                                className="px-6 py-2.5 text-gray-500 hover:text-gray-900 dark:hover:text-white font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateLocation}
                                disabled={saving}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? "Guardando..." : "Crear Sucursal"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
