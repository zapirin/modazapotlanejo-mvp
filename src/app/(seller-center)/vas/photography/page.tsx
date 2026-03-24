"use client";

import React, { useState } from 'react';
import { createPhotographyRequest } from './actions';

export default function PhotographyVASPage() {
    const [formData, setFormData] = useState({
        itemCount: '',
        estimatedDate: '',
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async () => {
        if (!formData.itemCount || !formData.estimatedDate) {
            alert("Por favor complete la cantidad de prendas y la fecha estimada.");
            return;
        }

        setIsSubmitting(true);
        setStatus('idle');
        
        try {
            const res = await createPhotographyRequest({
                itemCount: parseInt(formData.itemCount),
                estimatedDate: formData.estimatedDate,
                notes: formData.notes
            });

            if (res.success) {
                setStatus('success');
                setFormData({ itemCount: '', estimatedDate: '', notes: '' });
            } else {
                setStatus('error');
                setErrorMsg(res.error || "Ocurrió un error.");
            }
        } catch (error) {
            setStatus('error');
            setErrorMsg("Error inesperado.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8 text-center bg-blue-600 text-white">
                    <h1 className="text-3xl font-bold">📸 Solicitar Sesión Fotográfica</h1>
                    <p className="mt-2 opacity-90">Deja que profesionales tomen las mejores fotos para tu catálogo.</p>
                </div>

                <div className="p-8 space-y-8 text-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <h3 className="text-xl font-bold mb-3 text-blue-900">¿Cómo funciona?</h3>
                            <ol className="list-decimal list-inside space-y-2 text-sm">
                                <li>Envía tus muestras a nuestras oficinas en Zapotlanejo.</li>
                                <li>Nuestro equipo de fotografía profesional captura cada detalle.</li>
                                <li>Las fotos se suben directamente a tu inventario.</li>
                                <li>Recuperas tus muestras al finalizar.</li>
                            </ol>
                        </div>
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                            <h3 className="text-xl font-bold mb-3 text-blue-900">Costo del Servicio</h3>
                            <p className="text-2xl font-bold text-blue-600 mb-2">$150.00 <span className="text-sm font-normal text-gray-500">per modelo</span></p>
                            <p className="text-xs text-gray-500 italic">* Se descontará de tus ventas acumuladas o crédito interno.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Formulario de Solicitud</h2>
                        
                        {status === 'success' && (
                            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl font-bold">
                                ¡Solicitud enviada con éxito! Nos pondremos en contacto contigo pronto.
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold">
                                {errorMsg}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Cantidad de Modelos/Prendas</label>
                                <input 
                                    type="number" 
                                    placeholder="Ej: 5" 
                                    value={formData.itemCount}
                                    onChange={(e) => setFormData({...formData, itemCount: e.target.value})}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Fecha estimada de entrega</label>
                                <input 
                                    type="date" 
                                    value={formData.estimatedDate}
                                    onChange={(e) => setFormData({...formData, estimatedDate: e.target.value})}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Notas especiales (ej: tipo de fondo, poses)</label>
                            <textarea 
                                rows={3} 
                                value={formData.notes}
                                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            ></textarea>
                        </div>
                    </div>

                    <div className="pt-6 border-t flex justify-end">
                        <button 
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                        </button>
                    </div>
                </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6 font-medium uppercase tracking-widest">Servicios de Valor Agregado - Moda Zapotlanejo</p>
        </div>
    );
}
