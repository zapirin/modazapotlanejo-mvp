"use client";

import React, { useState } from 'react';
import { updateSellerCosts, toggleUserStatus, updateUserAdminNotes, resendSellerCredentials, syncApprovedSellers } from '@/app/actions/admin';
import { useRouter } from 'next/navigation';

export default function CostsClient({ initialSellers }: { initialSellers: any[] }) {
    const router = useRouter();
    const [sellers, setSellers] = useState(initialSellers);
    const [editing, setEditing] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const handleSync = async () => {
        setSyncing(true);
        const result: any = await syncApprovedSellers();
        if (result.success) {
            alert(`Sincronización completada. Nuevos vendedores creados: ${result.created || 0}`);
            router.refresh();
        } else {
            alert(result.error);
        }
        setSyncing(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const result = await updateSellerCosts(editing.id, {
            commission: editing.commission,
            fixedFee: editing.fixedFee
        });

        if (result.success) {
            // Also update notes if they changed
            await updateUserAdminNotes(editing.id, editing.adminNotes || '');
            
            setSellers(sellers.map(s => s.id === editing.id ? editing : s));
            setEditing(null);
            router.refresh();
        } else {
            alert(result.error || 'Ocurrió un error al guardar.');
        }
        setLoading(false);
    };

    const handleToggleStatus = async (seller: any) => {
        if (!confirm(`¿Estás seguro de que deseas ${seller.isActive ? 'SUSPENDER' : 'REACTIVAR'} a este vendedor?`)) return;
        
        const result = await toggleUserStatus(seller.id);
        if (result.success) {
            setSellers(sellers.map(s => s.id === seller.id ? { ...s, isActive: !s.isActive } : s));
            router.refresh();
        }
    };

    const handleResendCredentials = async (seller: any) => {
        if (!confirm('Esto generará una NUEVA contraseña y la enviará por correo al vendedor. ¿Continuar?')) return;
        
        setResetting(true);
        const result = await resendSellerCredentials(seller.id);
        if (result.success) {
            alert(`Credenciales enviadas con éxito. Nueva contraseña temporal: ${result.tempPassword}`);
        } else {
            alert(result.error);
        }
        setResetting(false);
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-24 space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-4">
                    <h1 className="text-6xl font-black tracking-tighter uppercase italic text-foreground">Gestión de Vendedores</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px]">Administración de cuentas, estados y costos</p>
                </div>

                <button 
                    onClick={handleSync}
                    disabled={syncing}
                    className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl hover:scale-105 ${syncing ? 'bg-gray-100 text-gray-400' : 'bg-foreground text-background shadow-foreground/10'}`}
                >
                    {syncing ? 'Sincronizando...' : '🔄 Sincronizar Cuentas'}
                </button>
            </div>

            <div className="bg-white dark:bg-gray-950 border border-border rounded-[40px] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-border">
                        <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                            <th className="px-8 py-6">Vendedor</th>
                            <th className="px-8 py-6">Estado</th>
                            <th className="px-8 py-6">Comisión (%)</th>
                            <th className="px-8 py-6">Cuota Fija ($)</th>
                            <th className="px-8 py-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sellers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                                    No hay vendedores registrados aún.
                                </td>
                            </tr>
                        ) : (
                            sellers.map((seller) => (
                                <tr key={seller.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="font-bold text-foreground">{seller.name || 'Sin nombre'}</div>
                                            {seller.adminNotes && (
                                                <span className="cursor-help" title={seller.adminNotes}>📝</span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-widest">{seller.email}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                            seller.isActive 
                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' 
                                                : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'
                                        }`}>
                                            {seller.isActive ? 'Activo' : 'Suspendido'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 font-black text-blue-600 italic">%{seller.commission ?? 5}</td>
                                    <td className="px-8 py-6 font-black text-foreground">${seller.fixedFee ?? 0}</td>
                                    <td className="px-8 py-6 text-right flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => handleToggleStatus(seller)}
                                            className={`p-2 rounded-xl transition-all hover:scale-110 ${seller.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                                            title={seller.isActive ? 'Suspender vendedor' : 'Reactivar vendedor'}
                                        >
                                            {seller.isActive ? '🚫' : '✅'}
                                        </button>
                                        <button 
                                            onClick={() => setEditing(seller)}
                                            className="px-6 py-2 border border-border rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-foreground hover:text-background transition-all hover:scale-105"
                                        >
                                            Gestionar
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {editing && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-950 border border-border p-10 rounded-[40px] w-full max-w-2xl space-y-8 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black uppercase tracking-tight italic">Gestionar Vendedor</h3>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{editing.name || editing.email}</p>
                            </div>
                            <button 
                                onClick={() => setEditing(null)}
                                className="text-2xl hover:scale-110 transition-transform"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 border-b border-blue-600/20 pb-2">Configuración Comercial</h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-4">Comisión por Venta (%)</label>
                                    <input 
                                        type="number" 
                                        required
                                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold"
                                        value={editing.commission ?? 5}
                                        onChange={(e) => setEditing({...editing, commission: Number(e.target.value)})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-4">Cuota Fija Mensual ($)</label>
                                    <input 
                                        type="number" 
                                        required
                                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold"
                                        value={editing.fixedFee ?? 0}
                                        onChange={(e) => setEditing({...editing, fixedFee: Number(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 border-b border-blue-600/20 pb-2">Cuenta y Credenciales</h4>
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-border">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Estado de Cuenta</p>
                                        <div className="flex items-center justify-between">
                                            <span className={`font-bold text-xs ${editing.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {editing.isActive ? 'ACTIVA' : 'SUSPENDIDA'}
                                            </span>
                                            <button 
                                                type="button"
                                                onClick={() => handleToggleStatus(editing)}
                                                className="text-[10px] font-black uppercase text-blue-600 hover:underline"
                                            >
                                                Cambiar
                                            </button>
                                        </div>
                                    </div>

                                    <button 
                                        type="button"
                                        disabled={resetting}
                                        onClick={() => handleResendCredentials(editing)}
                                        className={`w-full py-4 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] border-2 border-dashed border-gray-200 hover:border-blue-500 hover:text-blue-600 transition-all ${resetting ? 'opacity-50' : ''}`}
                                    >
                                        {resetting ? 'Enviando...' : '🔄 Resetear y Enviar Credenciales'}
                                    </button>
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 border-b border-blue-600/20 pb-2">Notas Administrativas (Privado)</h4>
                                <textarea 
                                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-medium min-h-[100px]"
                                    placeholder="Agrega anotaciones sobre este vendedor (ej. convenios especiales, retrasos en pago, etc.)"
                                    value={editing.adminNotes || ''}
                                    onChange={(e) => setEditing({...editing, adminNotes: e.target.value})}
                                />
                            </div>

                            <div className="md:col-span-2 flex gap-4 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setEditing(null)}
                                    className="flex-1 py-4 border border-border rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:scale-[1.02] shadow-blue-500/20'}`}
                                >
                                    {loading ? 'Guardando...' : 'Aplicar Todos los Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
