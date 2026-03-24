"use client";

import React, { useState } from 'react';
import { updateApplicationStatus } from './actions';
import { useRouter } from 'next/navigation';

export default function ApplicationsClient({ initialApplications }: { initialApplications: any[] }) {
    const router = useRouter();
    const [applications, setApplications] = useState(initialApplications);
    const [loading, setLoading] = useState<string | null>(null);

    const handleAction = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        if (!confirm(`¿Estás seguro de que deseas ${status === 'APPROVED' ? 'APROBAR' : 'RECHAZAR'} esta solicitud?`)) return;
        
        setLoading(id);
        const result = await updateApplicationStatus(id, status);

        if (result.success) {
            setApplications(applications.map(app => app.id === id ? { ...app, status } : app));
            router.refresh();
        } else {
            alert(result.error || 'Ocurrió un error.');
        }
        setLoading(null);
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-24 space-y-12">
            <div className="space-y-4">
                <h1 className="text-6xl font-black tracking-tighter uppercase italic text-foreground">Solicitudes de Fabricantes</h1>
                <p className="text-blue-600 font-bold uppercase tracking-[0.3em] text-[10px]">Gestión de nuevos ingresos al marketplace</p>
            </div>

            <div className="bg-white dark:bg-gray-950 border border-border rounded-[40px] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-border">
                        <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                            <th className="px-8 py-6">Fábrica / Contacto</th>
                            <th className="px-8 py-6">Contacto</th>
                            <th className="px-8 py-6">Categorías</th>
                            <th className="px-8 py-6">Estado</th>
                            <th className="px-8 py-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {applications.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                                    No hay solicitudes pendientes.
                                </td>
                            </tr>
                        ) : (
                            applications.map((app) => (
                                <tr key={app.id} className={`group hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors ${app.status === 'REJECTED' ? 'opacity-50' : ''}`}>
                                    <td className="px-8 py-6">
                                        <div className="font-bold text-foreground text-lg">{app.storeName}</div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-widest">{app.contactName}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-sm font-bold text-foreground">{app.email}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{app.phone}</div>
                                        {(app as any).storeAddress && (
                                            <div className="text-[10px] text-blue-500 font-bold flex items-center gap-1 mt-0.5">
                                                <span>📍</span>
                                                {(app as any).storeAddress.replace('|', ' — ')}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-wrap gap-1">
                                            {app.category.split(',').map((cat: string) => (
                                                <span key={cat} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-tighter rounded-md border border-blue-100 dark:border-blue-800">
                                                    {cat.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                            app.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                            app.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            'bg-red-50 text-red-600 border-red-100'
                                        }`}>
                                            {app.status === 'PENDING' ? 'Pendiente' : 
                                             app.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        {app.status === 'PENDING' && (
                                            <div className="flex gap-2 justify-end">
                                                <button 
                                                    disabled={loading === app.id}
                                                    onClick={() => handleAction(app.id, 'REJECTED')}
                                                    className="px-4 py-2 border border-border rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all transition-all"
                                                >
                                                    Rechazar
                                                </button>
                                                <button 
                                                    disabled={loading === app.id}
                                                    onClick={() => handleAction(app.id, 'APPROVED')}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 shadow-lg shadow-blue-500/20 transition-all disabled:bg-gray-400"
                                                >
                                                    {loading === app.id ? '...' : 'Aprobar'}
                                                </button>
                                            </div>
                                        )}
                                        {app.status !== 'PENDING' && (
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gestionado</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
