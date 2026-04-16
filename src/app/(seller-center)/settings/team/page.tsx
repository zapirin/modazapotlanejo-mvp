"use client";

import { useState, useEffect } from "react";
import {
    getSellerCashiers, createCashier, updateCashier, deleteCashier, permanentlyDeleteCashier,
    getFloorSalespeople, createFloorSalesperson, updateFloorSalesperson, deleteFloorSalesperson,
} from "./actions";
import { getLocationsSettings } from "../actions";
import { getSessionUser } from "@/app/actions/auth";
import { toast } from "sonner";

export default function TeamPage() {
    const [activeTab, setActiveTab] = useState<"cashiers" | "salespersons">("cashiers");

    // ── Cashiers ──────────────────────────────────────────────────────────────
    const [cashiers, setCashiers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [locations, setLocations] = useState<any[]>([]);
    const [showCashierModal, setShowCashierModal] = useState(false);
    const [editingCashier, setEditingCashier] = useState<any>(null);
    const [cashierForm, setCashierForm] = useState({
        name: "", email: "", password: "",
        allowedLocationIds: [] as string[],
        canRefund: true, canDiscount: true, canViewReports: false,
        canViewCommissions: false, canViewZCuts: false, canCreateProducts: false,
    });

    // ── Floor Salespeople ─────────────────────────────────────────────────────
    const [salespersons, setSalespersons] = useState<any[]>([]);
    const [showSpModal, setShowSpModal] = useState(false);
    const [editingSp, setEditingSp] = useState<any>(null);
    const [spForm, setSpForm] = useState({
        name: "", phone: "", email: "",
        startDate: new Date().toISOString().substring(0, 10),
        commissionType: "PERCENT" as "PERCENT" | "FIXED_PER_PIECE",
        commissionValue: 0,
        locationIds: [] as string[],
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [cashierData, locRes, currentUser, spData] = await Promise.all([
            getSellerCashiers(),
            getLocationsSettings(),
            getSessionUser(),
            getFloorSalespeople(),
        ]);
        setCashiers(cashierData);
        if (locRes.success && locRes.data) setLocations(locRes.data);
        setUser(currentUser);
        setSalespersons(spData);
        setLoading(false);
    };

    // ── Cashier helpers ───────────────────────────────────────────────────────
    const openCreateCashier = () => {
        setEditingCashier(null);
        setCashierForm({ name: "", email: "", password: "", allowedLocationIds: [], canRefund: true, canDiscount: true, canViewReports: false, canViewCommissions: false, canViewZCuts: false, canCreateProducts: false });
        setShowCashierModal(true);
    };

    const openEditCashier = (cashier: any) => {
        setEditingCashier(cashier);
        setCashierForm({
            name: cashier.name, email: cashier.email, password: "",
            allowedLocationIds: cashier.allowedLocationIds || [],
            canRefund: cashier.canRefund, canDiscount: cashier.canDiscount,
            canViewReports: cashier.canViewReports,
            canViewCommissions: cashier.canViewCommissions ?? false,
            canViewZCuts: cashier.canViewZCuts ?? false,
            canCreateProducts: cashier.canCreateProducts ?? false,
        });
        setShowCashierModal(true);
    };

    const toggleCashierLocation = (locId: string) => {
        setCashierForm(prev => ({
            ...prev,
            allowedLocationIds: prev.allowedLocationIds.includes(locId)
                ? prev.allowedLocationIds.filter(id => id !== locId)
                : [...prev.allowedLocationIds, locId],
        }));
    };

    const handleSaveCashier = async () => {
        if (!cashierForm.name || !cashierForm.email) { toast.error("Nombre y correo son obligatorios"); return; }
        if (!editingCashier && !cashierForm.password) { toast.error("La contraseña es obligatoria"); return; }
        if (cashierForm.allowedLocationIds.length === 0) { toast.error("Asigna al menos una locación"); return; }

        let res;
        if (editingCashier) {
            res = await updateCashier(editingCashier.id, {
                allowedLocationIds: cashierForm.allowedLocationIds,
                canRefund: cashierForm.canRefund,
                canDiscount: cashierForm.canDiscount,
                canViewReports: cashierForm.canViewReports,
                canViewCommissions: (cashierForm as any).canViewCommissions,
                canViewZCuts: (cashierForm as any).canViewZCuts,
                canCreateProducts: cashierForm.canCreateProducts,
                ...(cashierForm.password ? { password: cashierForm.password } : {}),
            });
        } else {
            res = await createCashier(cashierForm);
        }

        if (res.success) {
            toast.success(editingCashier ? "Cajero actualizado" : "Cajero creado");
            setShowCashierModal(false);
            loadData();
        } else {
            toast.error(res.error || "Error al guardar");
        }
    };

    const handleDeleteCashier = async (cashier: any) => {
        if (!confirm(`¿Desactivar a ${cashier.name}?`)) return;
        const res = await deleteCashier(cashier.id);
        if (res.success) { toast.success("Cajero desactivado"); loadData(); }
        else toast.error(res.error || "Error");
    };

    const handlePermanentDeleteCashier = async (cashier: any) => {
        if (!confirm(`¿Eliminar permanentemente a ${cashier.name}? Esta acción no se puede deshacer.`)) return;
        const res = await permanentlyDeleteCashier(cashier.id);
        if (res.success) { toast.success("Cajero eliminado"); loadData(); }
        else toast.error(res.error || "Error");
    };

    // ── Floor Salesperson helpers ─────────────────────────────────────────────
    const openCreateSp = () => {
        setEditingSp(null);
        setSpForm({ name: "", phone: "", email: "", startDate: new Date().toISOString().substring(0, 10), commissionType: "PERCENT", commissionValue: 0, locationIds: [] });
        setShowSpModal(true);
    };

    const openEditSp = (sp: any) => {
        setEditingSp(sp);
        setSpForm({
            name: sp.name,
            phone: sp.phone || "",
            email: sp.email || "",
            startDate: sp.startDate ? new Date(sp.startDate).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
            commissionType: sp.commissionType || "PERCENT",
            commissionValue: sp.commissionValue ?? 0,
            locationIds: sp.locationIds || [],
        });
        setShowSpModal(true);
    };

    const toggleSpLocation = (locId: string) => {
        setSpForm(prev => ({
            ...prev,
            locationIds: prev.locationIds.includes(locId)
                ? prev.locationIds.filter(id => id !== locId)
                : [...prev.locationIds, locId],
        }));
    };

    const handleSaveSp = async () => {
        if (!spForm.name) { toast.error("El nombre es obligatorio"); return; }

        let res;
        if (editingSp) {
            res = await updateFloorSalesperson(editingSp.id, {
                name: spForm.name,
                phone: spForm.phone,
                email: spForm.email,
                startDate: spForm.startDate,
                commissionType: spForm.commissionType,
                commissionValue: Number(spForm.commissionValue),
                locationIds: spForm.locationIds,
            });
        } else {
            res = await createFloorSalesperson({
                name: spForm.name,
                phone: spForm.phone || undefined,
                email: spForm.email || undefined,
                startDate: spForm.startDate,
                commissionType: spForm.commissionType,
                commissionValue: Number(spForm.commissionValue),
                locationIds: spForm.locationIds,
            });
        }

        if (res.success) {
            toast.success(editingSp ? "Vendedor actualizado" : "Vendedor de piso creado");
            setShowSpModal(false);
            loadData();
        } else {
            toast.error(res.error || "Error al guardar");
        }
    };

    const handleDeleteSp = async (sp: any) => {
        if (!confirm(`¿Desactivar a ${sp.name}?`)) return;
        const res = await deleteFloorSalesperson(sp.id);
        if (res.success) { toast.success("Vendedor de piso desactivado"); loadData(); }
        else toast.error(res.error || "Error");
    };

    const maxCashiers = (user as any)?.maxCashiers ?? 1;
    const canAddMoreCashiers = cashiers.filter(c => c.isActive).length < maxCashiers;

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
            <h1 className="text-3xl font-black text-foreground tracking-tight">Mi Equipo</h1>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab("cashiers")}
                    className={`px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition ${activeTab === "cashiers" ? "bg-white dark:bg-gray-700 text-foreground shadow" : "text-gray-500 hover:text-foreground"}`}>
                    Cajeros
                </button>
                <button
                    onClick={() => setActiveTab("salespersons")}
                    className={`px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition ${activeTab === "salespersons" ? "bg-white dark:bg-gray-700 text-foreground shadow" : "text-gray-500 hover:text-foreground"}`}>
                    Vendedores de Piso
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/></div>
            ) : (
                <>
                    {/* ── CASHIERS TAB ─────────────────────────────────────────── */}
                    {activeTab === "cashiers" && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <p className="text-gray-500 font-medium">
                                    Cajeros: <span className="font-black text-foreground">{cashiers.filter(c => c.isActive).length}</span> de <span className="font-black text-blue-600">{maxCashiers}</span> permitidos
                                </p>
                                {canAddMoreCashiers ? (
                                    <button onClick={openCreateCashier}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                                        + Nuevo Cajero
                                    </button>
                                ) : (
                                    <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-xs font-black text-orange-600 uppercase tracking-wider">
                                        ⚠️ Límite alcanzado · Solicita upgrade
                                    </div>
                                )}
                            </div>

                            {cashiers.length === 0 ? (
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
                                                            <>
                                                            <button
                                                                onClick={async () => {
                                                                    const newVal = !(cashier as any).canOpenDrawer;
                                                                    const res = await updateCashier(cashier.id, { canOpenDrawer: newVal });
                                                                    if (res.success) {
                                                                        toast.success(newVal ? '💰 Cajón habilitado' : 'Cajón deshabilitado');
                                                                        loadData();
                                                                    }
                                                                }}
                                                                className={`px-3 py-1.5 text-xs font-black rounded-xl border transition ${(cashier as any).canOpenDrawer ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-700' : 'bg-gray-50 dark:bg-gray-800 border-border text-gray-400'}`}
                                                                title={(cashier as any).canOpenDrawer ? 'Quitar permiso de cajón' : 'Dar permiso de cajón'}>
                                                                💰 {(cashier as any).canOpenDrawer ? 'Cajón ✓' : 'Cajón'}
                                                            </button>
                                                            <button onClick={() => openEditCashier(cashier)}
                                                                className="px-3 py-1.5 text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition">
                                                                Editar
                                                            </button>
                                                            </>
                                                        )}
                                                        {cashier.isActive ? (
                                                            <button onClick={() => handleDeleteCashier(cashier)}
                                                                className="px-3 py-1.5 text-xs font-black text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 transition">
                                                                Desactivar
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={async () => {
                                                                    const res = await updateCashier(cashier.id, { isActive: true });
                                                                    if (res.success) { toast.success('Cajero reactivado'); loadData(); }
                                                                    else toast.error(res.error || 'Error');
                                                                }}
                                                                    className="px-3 py-1.5 text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition">
                                                                    ✓ Reactivar
                                                                </button>
                                                                <button onClick={() => handlePermanentDeleteCashier(cashier)}
                                                                    className="px-3 py-1.5 text-xs font-black text-white bg-red-600 border border-red-600 rounded-xl hover:bg-red-700 transition">
                                                                    🗑 Eliminar
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

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

                                                <div className="flex flex-wrap gap-2">
                                                    {cashier.canRefund && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Devoluciones</span>}
                                                    {cashier.canDiscount && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Descuentos</span>}
                                                    {cashier.canViewReports && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Ventas</span>}
                                                    {cashier.canViewCommissions && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Comisiones</span>}
                                                    {cashier.canViewZCuts && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Cortes Z</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── FLOOR SALESPEOPLE TAB ─────────────────────────────────── */}
                    {activeTab === "salespersons" && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <p className="text-gray-500 font-medium text-sm">
                                    Vendedores de piso: <span className="font-black text-foreground">{salespersons.filter(s => s.isActive).length}</span> activos
                                </p>
                                <button onClick={openCreateSp}
                                    className="px-6 py-3 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-purple-700 transition shadow-lg shadow-purple-500/20">
                                    + Nuevo Vendedor
                                </button>
                            </div>

                            {salespersons.length === 0 ? (
                                <div className="p-16 text-center bg-card border border-dashed border-border rounded-3xl space-y-4 opacity-60">
                                    <p className="text-5xl">🏷️</p>
                                    <p className="font-black uppercase tracking-widest text-gray-400 text-sm">No tienes vendedores de piso</p>
                                    <p className="text-xs text-gray-400">Los vendedores de piso no necesitan usuario ni contraseña — solo aparecen en el POS para asignar comisiones</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {salespersons.map((sp: any) => {
                                        const assignedLocs = locations.filter(l => (sp.locationIds || []).includes(l.id));
                                        return (
                                            <div key={sp.id} className={`bg-card border rounded-2xl p-5 space-y-4 ${sp.isActive ? "border-border" : "border-border opacity-50"}`}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${sp.isActive ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                                                            {sp.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-foreground">{sp.name}</p>
                                                            <div className="flex items-center gap-3 mt-0.5">
                                                                {sp.phone && <p className="text-xs text-gray-400 font-medium">📞 {sp.phone}</p>}
                                                                {sp.email && <p className="text-xs text-gray-400 font-medium">✉ {sp.email}</p>}
                                                                <p className="text-xs text-purple-600 font-black">
                                                                    {sp.commissionType === "FIXED_PER_PIECE"
                                                                        ? `$${sp.commissionValue} / pieza`
                                                                        : `${sp.commissionValue}% comisión`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {sp.isActive && (
                                                            <button onClick={() => openEditSp(sp)}
                                                                className="px-3 py-1.5 text-xs font-black text-purple-600 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 transition">
                                                                Editar
                                                            </button>
                                                        )}
                                                        {sp.isActive ? (
                                                            <button onClick={() => handleDeleteSp(sp)}
                                                                className="px-3 py-1.5 text-xs font-black text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 transition">
                                                                Desactivar
                                                            </button>
                                                        ) : (
                                                            <button onClick={async () => {
                                                                const res = await updateFloorSalesperson(sp.id, { isActive: true });
                                                                if (res.success) { toast.success('Vendedor reactivado'); loadData(); }
                                                                else toast.error(res.error || 'Error');
                                                            }}
                                                                className="px-3 py-1.5 text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition">
                                                                ✓ Reactivar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 self-center">Sucursales:</span>
                                                    {assignedLocs.length > 0 ? assignedLocs.map(loc => (
                                                        <span key={loc.id} className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-full text-[10px] font-black uppercase">
                                                            📍 {loc.name}
                                                        </span>
                                                    )) : (
                                                        <span className="text-[10px] text-gray-400 font-medium">Todas las sucursales</span>
                                                    )}
                                                </div>

                                                <div className="text-[10px] text-gray-400 font-medium">
                                                    Ingreso: {new Date(sp.startDate).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ── CASHIER MODAL ─────────────────────────────────────────────────── */}
            {showCashierModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50">
                            <h3 className="text-xl font-black">{editingCashier ? "Editar Cajero" : "Nuevo Cajero"}</h3>
                            <button onClick={() => setShowCashierModal(false)} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-300 transition">×</button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre</label>
                                    <input type="text" value={cashierForm.name} onChange={e => setCashierForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Correo</label>
                                    <input type="email" value={cashierForm.email} onChange={e => setCashierForm(p => ({ ...p, email: e.target.value }))}
                                        disabled={!!editingCashier}
                                        className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none disabled:opacity-50" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    {editingCashier ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña"}
                                </label>
                                <input type="password" value={cashierForm.password} onChange={e => setCashierForm(p => ({ ...p, password: e.target.value }))}
                                    placeholder={editingCashier ? "••••••••" : "Mínimo 6 caracteres"}
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-blue-500/50 outline-none" />
                            </div>

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
                                            const selected = cashierForm.allowedLocationIds.includes(loc.id);
                                            return (
                                                <button key={loc.id} type="button" onClick={() => toggleCashierLocation(loc.id)}
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

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Permisos</label>
                                <div className="space-y-2">
                                    {[
                                        { key: "canRefund", label: "Puede hacer devoluciones", desc: "Procesar reembolsos y cambios" },
                                        { key: "canDiscount", label: "Puede aplicar descuentos", desc: "Descuentos manuales en ventas" },
                                        { key: "canViewReports", label: "Puede ver reportes de ventas", desc: "Pestaña Ventas: top productos y proveedores" },
                                        { key: "canViewCommissions", label: "Puede ver comisiones", desc: "Pestaña Comisiones: desglose de vendedores de piso" },
                                        { key: "canViewZCuts", label: "Puede ver cortes Z", desc: "Pestaña Cortes Z: cierres de caja" },
                                    ].map(perm => (
                                        <div key={perm.key} onClick={() => setCashierForm(p => ({ ...p, [perm.key]: !(p as any)[perm.key] }))}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${(cashierForm as any)[perm.key] ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "border-border hover:border-gray-300"}`}>
                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${(cashierForm as any)[perm.key] ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300"}`}>
                                                {(cashierForm as any)[perm.key] && <span className="text-[10px] font-black">✓</span>}
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
                            <button onClick={() => setShowCashierModal(false)}
                                className="flex-1 py-3 border border-border rounded-xl font-black uppercase tracking-widest text-xs text-gray-500 hover:bg-gray-100 transition">
                                Cancelar
                            </button>
                            <button onClick={handleSaveCashier}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                                {editingCashier ? "Guardar Cambios" : "Crear Cajero"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── FLOOR SALESPERSON MODAL ──────────────────────────────────────── */}
            {showSpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50">
                            <h3 className="text-xl font-black">{editingSp ? "Editar Vendedor de Piso" : "Nuevo Vendedor de Piso"}</h3>
                            <button onClick={() => setShowSpModal(false)} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-300 transition">×</button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto">
                            {/* Nombre */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre *</label>
                                <input type="text" value={spForm.name} onChange={e => setSpForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Ej. Ana García"
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-purple-500/50 outline-none" />
                            </div>

                            {/* Teléfono y Email */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Teléfono</label>
                                    <input type="tel" value={spForm.phone} onChange={e => setSpForm(p => ({ ...p, phone: e.target.value }))}
                                        placeholder="Ej. 3311234567"
                                        className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-purple-500/50 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email (opcional)</label>
                                    <input type="email" value={spForm.email} onChange={e => setSpForm(p => ({ ...p, email: e.target.value }))}
                                        placeholder="ana@ejemplo.com"
                                        className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-purple-500/50 outline-none" />
                                </div>
                            </div>

                            {/* Fecha de ingreso */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha de Ingreso</label>
                                <input type="date" value={spForm.startDate} onChange={e => setSpForm(p => ({ ...p, startDate: e.target.value }))}
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-purple-500/50 outline-none" />
                            </div>

                            {/* Tipo de comisión + valor */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Comisión</label>
                                {/* Toggle tipo */}
                                <div className="flex gap-2">
                                    <button type="button"
                                        onClick={() => setSpForm(p => ({ ...p, commissionType: "PERCENT" }))}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide border-2 transition ${spForm.commissionType === "PERCENT" ? "border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700" : "border-border text-gray-400 hover:border-gray-300"}`}>
                                        % Porcentaje
                                    </button>
                                    <button type="button"
                                        onClick={() => setSpForm(p => ({ ...p, commissionType: "FIXED_PER_PIECE" }))}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide border-2 transition ${spForm.commissionType === "FIXED_PER_PIECE" ? "border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700" : "border-border text-gray-400 hover:border-gray-300"}`}>
                                        $ Fijo por pieza
                                    </button>
                                </div>
                                {/* Valor */}
                                <div className="relative">
                                    {spForm.commissionType === "PERCENT" ? (
                                        <>
                                            <input type="number" min="0" max="100" step="0.5" value={spForm.commissionValue}
                                                onChange={e => setSpForm(p => ({ ...p, commissionValue: Number(e.target.value) }))}
                                                className="w-full px-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-purple-500/50 outline-none pr-10" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 font-black">%</span>
                                            <p className="text-[10px] text-gray-400 mt-1">Ej: 5% → en una venta de $1,000 = $50 de comisión</p>
                                        </>
                                    ) : (
                                        <>
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 font-black">$</span>
                                            <input type="number" min="0" step="0.50" value={spForm.commissionValue}
                                                onChange={e => setSpForm(p => ({ ...p, commissionValue: Number(e.target.value) }))}
                                                className="w-full pl-8 pr-4 py-3 bg-input border border-border rounded-xl font-bold focus:ring-2 focus:ring-purple-500/50 outline-none" />
                                            <p className="text-[10px] text-gray-400 mt-1">Ej: $5 → si vendió 20 piezas = $100 de comisión</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Sucursales */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    Sucursales asignadas
                                    <span className="ml-1 text-gray-300 normal-case font-medium">(vacío = todas)</span>
                                </label>
                                {locations.length === 0 ? (
                                    <p className="text-xs text-orange-500 font-bold">⚠️ No tienes locaciones creadas. Crea una en Configuración → Locaciones.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {locations.map(loc => {
                                            const selected = spForm.locationIds.includes(loc.id);
                                            return (
                                                <button key={loc.id} type="button" onClick={() => toggleSpLocation(loc.id)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selected ? "border-purple-600 bg-purple-50 dark:bg-purple-900/20" : "border-border hover:border-gray-300"}`}>
                                                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${selected ? "bg-purple-600 border-purple-600" : "border-gray-300"}`} />
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
                        </div>

                        <div className="p-6 border-t border-border bg-gray-50/50 dark:bg-gray-900/50 flex gap-3">
                            <button onClick={() => setShowSpModal(false)}
                                className="flex-1 py-3 border border-border rounded-xl font-black uppercase tracking-widest text-xs text-gray-500 hover:bg-gray-100 transition">
                                Cancelar
                            </button>
                            <button onClick={handleSaveSp}
                                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-purple-700 transition shadow-lg shadow-purple-500/20">
                                {editingSp ? "Guardar Cambios" : "Crear Vendedor"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
