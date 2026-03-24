"use client";

import React, { useState, useEffect } from "react";
import { getSellerCashiers, createCashier, updateCashier, deleteCashier, permanentlyDeleteCashier } from "./actions";
import { getLocationsSettings } from "../actions";
import { getSessionUser } from "@/app/actions/auth";
import { toast } from "sonner";

export default function TeamPage() {
    const [cashiers, setCashiers] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingCashier, setEditingCashier] = useState<any>(null);

    // Form state
    const [form, setForm] = useState({
        name: "", email: "", password: "",
        allowedLocationIds: [] as string[],
        canRefund: true, canDiscount: true, canViewReports: false, canCreateProducts: false,
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [cashierData, locRes, currentUser] = await Promise.all([
            getSellerCashiers(),
            getLocationsSettings(),
            getSessionUser(),
        ]);
        setCashiers(cashierData);
        if (locRes.success && locRes.data) setLocations(locRes.data);
        setUser(currentUser);
        setLoading(false);
    };

    const openCreate = () => {
        setEditingCashier(null);
        setForm({ name: "", email: "", password: "", allowedLocationIds: [], canRefund: true, canDiscount: true, canViewReports: false, canCreateProducts: false });
        setShowModal(true);
    };

    const openEdit = (cashier: any) => {
        setEditingCashier(cashier);
        setForm({
            name: cashier.name, email: cashier.email, password: "",
            allowedLocationIds: cashier.allowedLocationIds || [],
            canRefund: cashier.canRefund, canDiscount: cashier.canDiscount, canViewReports: cashier.canViewReports, canCreateProducts: cashier.canCreateProducts ?? false,
        });
        setShowModal(true);
    };

    const toggleLocation = (locId: string) => {
        setForm(prev => ({
            ...prev,
            allowedLocationIds: prev.allowedLocationIds.includes(locId)
                ? prev.allowedLocationIds.filter(id => id !== locId)
                : [...prev.allowedLocationIds, locId],
        }));
    };

    const handleSave = async () => {
        if (!form.name || !form.email) { toast.error("Nombre y correo son obligatorios"); return; }
        if (!editingCashier && !form.password) { toast.error("La contraseña es obligatoria"); return; }
        if (form.allowedLocationIds.length === 0) { toast.error("Asigna al menos una locación"); return; }

        let res;
        if (editingCashier) {
            res = await updateCashier(editingCashier.id, {
                allowedLocationIds: form.allowedLocationIds,
                canRefund: form.canRefund,
                canDiscount: form.canDiscount,
                canViewReports: form.canViewReports,
                canCreateProducts: form.canCreateProducts,
                ...(form.password ? { password: form.password } : {}),
            });
        } else {
            res = await createCashier(form);
        }

        if (res.success) {
            toast.success(editingCashier ? "Cajero actualizado" : "Cajero creado");
            setShowModal(false);
            loadData();
        } else {
            toast.error(res.error || "Error al guardar");
        }
    };

    const handleDelete = async (cashier: any) => {
        if (!confirm(`¿Desactivar a ${cashier.name}?`)) return;
        const res = await deleteCashier(cashier.id);
        if (res.success) { toast.success("Cajero desactivado"); loadData(); }
        else toast.error(res.error || "Error");
    };

    const handlePermanentDelete = async (cashier: any) => {
        if (!confirm(`¿Eliminar permanentemente a ${cashier.name}? Esta acción no se puede deshacer.`)) return;
        const res = await permanentlyDeleteCashier(cashier.id);
        if (res.success) { toast.success("Cajero eliminado"); loadData(); }
        else toast.error(res.error || "Error");
    };

    const maxCashiers = (user as any)?.maxCashiers ?? 1;
    const canAddMore = cashiers.filter(c => c.isActive).length < maxCashiers;

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Mi Equipo</h1>
                    <p className="text-gray-500 font-medium mt-1">
                        Cajeros: <span className="font-black text-foreground">{cashiers.filter(c => c.isActive).length}</span> de <span className="font-black text-blue-600">{maxCashiers}</span> permitidos
                    </p>
                </div>
                {canAddMore ? (
                    <button onClick={openCreate}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                        + Nuevo Cajero
                    </button>
                ) : (
                    <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-xs font-black text-orange-600 uppercase tracking-wider">
                        ⚠️ Límite alcanzado · Solicita upgrade
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/></div>
            ) : cashiers.length === 0 ? (
                <div className="p-16 text-center bg-card border border-dashed border-border rounded-3xl space-y-4 opacity-60">
                    <p className="text-5xl">👤</p>
                    <p className="font-black uppercase tracking-widest text-gray-400 text-sm">No tienes cajeros registrados</p>
                    <p className="text-xs text-gray-400">Crea un cajero para que pueda acceder al Punto de Venta</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {cashiers.map(cashier => {
                        const assignedLocs = locations.filter(l => (cashier.allowedLocationIds || []).includes(l.id));
                        return (
                            <div key={cashier.id} className={`bg-card border rounded-2xl p-5 space-y-4 ${cashier.isActive ? "border-border" : "border-border opacity-50"}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${cashier.isActive ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                                            {cashier.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-black text-foreground">{cashier.name}</p>
                                            <p className="text-xs text-gray-400 font-medium">{cashier.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {cashier.isActive && (
                                            <button onClick={() => openEdit(cashier)}
                                                className="px-3 py-1.5 text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition">
                                                Editar
                                            </button>
                                        )}
                                        {cashier.isActive ? (
                                            <button onClick={() => handleDelete(cashier)}
                                                className="px-3 py-1.5 text-xs font-black text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 transition">
                                                Desactivar
                                            </button>
                                        ) : (
                                            <button onClick={() => handlePermanentDelete(cashier)}
                                                className="px-3 py-1.5 text-xs font-black text-white bg-red-600 border border-red-600 rounded-xl hover:bg-red-700 transition">
                                                🗑 Eliminar
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Locaciones asignadas */}
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 self-center">Locaciones:</span>
                                    {assignedLocs.length > 0 ? assignedLocs.map(loc => (
                                        <span key={loc.id} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full text-[10px] font-black uppercase">
                                            📍 {loc.name}
                                        </span>
                                    )) : (
                                        <span className="text-[10px] text-red-500 font-bold">⚠️ Sin locaciones asignadas</span>
                                    )}
                                </div>

                                {/* Permisos */}
                                <div className="flex flex-wrap gap-2">
                                    {cashier.canRefund && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Devoluciones</span>}
                                    {cashier.canDiscount && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Descuentos</span>}
                                    {cashier.canViewReports && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Reportes</span>}
                                    {cashier.canCreateProducts && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Crear productos</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal crear/editar cajero */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50">
                            <h3 className="text-xl font-black">{editingCashier ? "Editar Cajero" : "Nuevo Cajero"}</h3>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-300 transition">×</button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto">
                            {/* Datos básicos */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre</label>
                                    <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Correo</label>
                                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                        disabled={!!editingCashier}
                                        className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none disabled:opacity-50" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    {editingCashier ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña"}
                                </label>
                                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    placeholder={editingCashier ? "••••••••" : "Mínimo 6 caracteres"}
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none" />
                            </div>

                            {/* Locaciones */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    Locaciones Permitidas
                                    <span className="ml-1 text-gray-300 normal-case font-medium">(selecciona una o más)</span>
                                </label>
                                {locations.length === 0 ? (
                                    <p className="text-xs text-orange-500 font-bold">⚠️ No tienes locaciones creadas. Crea una en Configuración → Locaciones.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {locations.map(loc => {
                                            const selected = form.allowedLocationIds.includes(loc.id);
                                            return (
                                                <button key={loc.id} type="button" onClick={() => toggleLocation(loc.id)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selected ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20" : "border-border hover:border-gray-300"}`}>
                                                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${selected ? "bg-blue-600 border-blue-600" : "border-gray-300"}`} />
                                                    <div>
                                                        <p className="font-black text-sm text-foreground">{loc.name}</p>
                                                        {loc.address && <p className="text-[10px] text-gray-400 font-medium">{loc.address}</p>}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Permisos */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Permisos</label>
                                <div className="space-y-2">
                                    {[
                                        { key: "canRefund", label: "Puede hacer devoluciones", desc: "Procesar reembolsos y cambios" },
                                        { key: "canDiscount", label: "Puede aplicar descuentos", desc: "Descuentos manuales en ventas" },
                                        { key: "canViewReports", label: "Puede ver reportes", desc: "Acceso a historial de ventas y corte Z" },
                                        { key: "canCreateProducts", label: "Puede crear productos", desc: "Agregar nuevos productos al inventario" },
                                    ].map(perm => (
                                        <div key={perm.key} onClick={() => setForm(p => ({ ...p, [perm.key]: !(p as any)[perm.key] }))}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${(form as any)[perm.key] ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "border-border hover:border-gray-300"}`}>
                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${(form as any)[perm.key] ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300"}`}>
                                                {(form as any)[perm.key] && <span className="text-[10px] font-black">✓</span>}
                                            </div>
                                            <div>
                                                <p className="font-black text-sm text-foreground">{perm.label}</p>
                                                <p className="text-[10px] text-gray-400 font-medium">{perm.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border bg-gray-50/50 dark:bg-gray-900/50 flex gap-3">
                            <button onClick={() => setShowModal(false)}
                                className="flex-1 py-3 border border-border rounded-xl font-black uppercase tracking-widest text-xs text-gray-500 hover:bg-gray-100 transition">
                                Cancelar
                            </button>
                            <button onClick={handleSave}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                                {editingCashier ? "Guardar Cambios" : "Crear Cajero"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
