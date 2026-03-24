"use client";

import React, { useState } from 'react';
import { createShipmentLabel } from '@/app/actions/shipping';
import { toast } from 'sonner';

export default function ShippingLabelForm({ 
    orderId, 
    rateId, 
    quotationId 
}: { 
    orderId: string; 
    rateId?: string | null;
    quotationId?: string | null;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [parcel, setParcel] = useState({
        weight: 1,
        height: 15,
        width: 30,
        length: 40,
    });

    const handleGenerate = async () => {
        setIsGenerating(true);
        const loadingToast = toast.loading('Generando guía de envío...');

        const result = await createShipmentLabel(
            orderId,
            rateId || 'mock_rate_1', // Fallback for old orders or testing
            quotationId || 'mock_quotation_1',
            parcel
        );

        if (result.success) {
            toast.success('¡Guía generada exitosamente!', { id: loadingToast });
            if (result.labelUrl) {
                window.open(result.labelUrl, '_blank');
            }
            // Refresh to show updated status
            window.location.reload();
        } else {
            toast.error(result.error || 'Error al generar la guía.', { id: loadingToast });
        }
        setIsGenerating(false);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="w-full py-3 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-purple-700 transition flex items-center justify-center gap-2"
            >
                📦 Generar Guía de Envío
            </button>
        );
    }

    return (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-purple-700 dark:text-purple-300">
                📦 Datos del Paquete
            </h4>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Peso (kg)</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={parcel.weight}
                        onChange={e => setParcel(p => ({ ...p, weight: parseFloat(e.target.value) || 1 }))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Alto (cm)</label>
                    <input
                        type="number"
                        min="1"
                        value={parcel.height}
                        onChange={e => setParcel(p => ({ ...p, height: parseInt(e.target.value) || 15 }))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Ancho (cm)</label>
                    <input
                        type="number"
                        min="1"
                        value={parcel.width}
                        onChange={e => setParcel(p => ({ ...p, width: parseInt(e.target.value) || 30 }))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-0.5">Largo (cm)</label>
                    <input
                        type="number"
                        min="1"
                        value={parcel.length}
                        onChange={e => setParcel(p => ({ ...p, length: parseInt(e.target.value) || 40 }))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-2 text-xs font-bold text-gray-500 border border-border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex-1 py-2 text-xs font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                >
                    {isGenerating ? 'Generando...' : 'Generar Guía'}
                </button>
            </div>
        </div>
    );
}
