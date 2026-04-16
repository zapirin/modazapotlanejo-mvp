"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPaymentMethods, createPaymentMethod, deletePaymentMethod } from '../../products/new/actions';

export default function PaymentMethodsPage() {
    const [methods, setMethods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('CUSTOM');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await getPaymentMethods();
        setMethods(data);
        setLoading(false);
    };

    const handleAddMethod = async () => {
        if (!newName) return;
        const res = await createPaymentMethod({
            name: newName,
            type: newType
        });
        if (res.success) {
            setNewName('');
            loadData();
        }
    };

    const handleDeleteMethod = async (method: any) => {
        const efectivosActivos = methods.filter(m => m.name.toUpperCase() === 'EFECTIVO');
        if (method.name.trim().toUpperCase() === 'EFECTIVO' && efectivosActivos.length <= 1) {
            alert('Debe existir al menos un método EFECTIVO activo para el Punto de Venta.');
            return;
        }
        if (confirm(`¿Seguro que desea eliminar el método de pago "${method.name}"?`)) {
            const res = await deletePaymentMethod(method.id);
            if (res.success) loadData();
            else if (res.error) alert(res.error);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="mb-10">
                <h1 className="text-3xl font-black text-foreground tracking-tight">Formas de Pago</h1>
                <p className="text-gray-500 font-medium mt-2">Personalice las opciones de cobro manual para su Punto de Venta.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Formulario */}
                <div className="bg-card p-6 rounded-3xl border border-border shadow-xl h-fit space-y-6">
                    <h2 className="font-black text-lg text-foreground">Nueva Opción</h2>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre del Método</label>
                            <input
                                type="text"
                                placeholder="Ej: Clip o Transferencia"
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo de Proceso</label>
                            <select
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition font-bold"
                                value={newType}
                                onChange={(e) => setNewType(e.target.value)}
                            >
                                <option value="CUSTOM">Manual / Externo</option>
                                <option value="CARD">Terminal Bancaria</option>
                                /* Efectivo es global — no se puede crear duplicado */
                            </select>
                        </div>
                        <button
                            onClick={handleAddMethod}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition shadow-lg shadow-blue-500/20"
                        >
                            Habilitar Método
                        </button>
                    </div>
                </div>

                {/* Lista */}
                <div className="md:col-span-2 space-y-4">
                    {loading ? (
                        <div className="p-20 text-center animate-pulse">
                            <p className="font-black uppercase tracking-widest text-gray-400">Cargando métodos...</p>
                        </div>
                    ) : methods.length === 0 ? (
                        <div className="p-20 text-center bg-card rounded-3xl border border-dashed border-border opacity-50">
                            <p className="text-4xl mb-4">💳</p>
                            <p className="font-black uppercase tracking-widest text-gray-400">No tienes métodos adicionales. El Efectivo es universal.</p>
                        </div>
                    ) : (
                        methods.map(method => (
                            <div key={method.id} className="bg-card p-6 rounded-3xl border border-border flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl">⚡</span>
                                    <div>
                                        <h3 className="font-black text-lg text-foreground">{method.name}</h3>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{method.type}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteMethod(method)}
                                    className="w-10 h-10 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all flex items-center justify-center font-bold"
                                >
                                    ×
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border flex justify-between items-center">
                <Link href="/pos" className="text-sm font-bold text-gray-400 hover:text-foreground transition-colors flex items-center gap-2">
                    ← Volver a la Caja
                </Link>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Sincronizado</p>
            </div>
        </div>
    );
}
