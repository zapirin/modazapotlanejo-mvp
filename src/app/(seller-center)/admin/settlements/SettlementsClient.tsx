"use client";

import React, { useState } from 'react';
import { createSettlement } from '@/app/actions/settlements';
import { toast } from 'sonner';

interface SellerPending {
    sellerId: string;
    sellerName: string;
    sellerEmail: string;
    totalPending: number;
    commissionTotal: number;
    orders: any[];
}

export default function SettlementsClient({ initialData }: { initialData: SellerPending[] }) {
    const [data, setData] = useState(initialData);
    const [selectedSeller, setSelectedSeller] = useState<SellerPending | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const [paymentDetails, setPaymentDetails] = useState({
        paymentMethod: 'Transferencia',
        reference: ''
    });

    const handleSettle = async () => {
        if (!selectedSeller) return;
        
        setLoading(true);
        try {
            const result = await createSettlement({
                sellerId: selectedSeller.sellerId,
                orderIds: selectedSeller.orders.map(o => o.id),
                amount: selectedSeller.totalPending,
                commissionTotal: selectedSeller.commissionTotal,
                paymentMethod: paymentDetails.paymentMethod,
                reference: paymentDetails.reference
            });

            if (result.success) {
                toast.success('Liquidación procesada correctamente');
                // Remove settled seller from view
                setData(prev => prev.filter(s => s.sellerId !== selectedSeller.sellerId));
                setIsModalOpen(false);
                setSelectedSeller(null);
            } else {
                toast.error(result.error || 'Error al procesar la liquidación');
            }
        } catch (error) {
            toast.error('Ocurrió un error inesperado');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Liquidaciones Pendientes</h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Gestiona los pagos a los fabricantes por sus ventas completadas.</p>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="bg-card border border-dashed border-border rounded-3xl p-20 text-center">
                    <div className="text-5xl mb-4">🎉</div>
                    <h3 className="text-xl font-bold">Sin pagos pendientes</h3>
                    <p className="text-gray-500 max-w-xs mx-auto mt-2">No hay órdenes completadas esperando liquidación en este momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {data.map((seller) => (
                        <div key={seller.sellerId} className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black">{seller.sellerName}</h3>
                                    <p className="text-sm text-gray-500">{seller.sellerEmail}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${seller.totalPending < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                        {seller.totalPending < 0 ? 'Adeudo de Comisiones' : 'Por liquidar'}
                                    </p>
                                    <p className="text-2xl font-black text-foreground">
                                        ${Math.abs(seller.totalPending).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Órdenes pendientes:</span>
                                    <span className="font-bold">{seller.orders.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Comisiones generadas:</span>
                                    <span className="font-bold text-green-600">${seller.commissionTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setSelectedSeller(seller);
                                    setIsModalOpen(true);
                                }}
                                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all ${seller.totalPending < 0 ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800' : 'bg-foreground text-background'}`}
                            >
                                {seller.totalPending < 0 ? 'Registrar Cobro' : 'Revisar y Liquidar'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for Settlement */}
            {isModalOpen && selectedSeller && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 pb-0 flex justify-between items-center">
                            <h2 className="text-2xl font-black tracking-tight">Procesar Liquidación</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-border">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-bold text-gray-500">Vendedor:</span>
                                    <span className="font-black">{selectedSeller.sellerName}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-border pt-4">
                                    <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                                        {selectedSeller.totalPending < 0 ? 'Monto a Cobrar:' : 'Total a Pagar:'}
                                    </span>
                                    <span className={`text-3xl font-black ${selectedSeller.totalPending < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                        ${Math.abs(selectedSeller.totalPending).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-2">Método de Pago</label>
                                    <select 
                                        value={paymentDetails.paymentMethod}
                                        onChange={(e) => setPaymentDetails(prev => ({ ...prev, paymentMethod: e.target.value }))}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl px-5 py-3 text-sm font-bold outline-none ring-blue-500/20 focus:ring-4 transition-all"
                                    >
                                        <option value="Transferencia">Transferencia</option>
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-2">Referencia / Nota</label>
                                    <input 
                                        type="text"
                                        placeholder="Ej: Transf. 12345"
                                        value={paymentDetails.reference}
                                        onChange={(e) => setPaymentDetails(prev => ({ ...prev, reference: e.target.value }))}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-border rounded-2xl px-5 py-3 text-sm font-bold outline-none ring-blue-500/20 focus:ring-4 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Detalle de Órdenes ({selectedSeller.orders.length})</h4>
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar text-xs">
                                    {selectedSeller.orders.map((order: any) => (
                                        <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-border/50">
                                            <span>#{order.orderNumber}</span>
                                            <span className="font-bold text-foreground">${order.sellerEarnings.toLocaleString('es-MX')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 pt-0 flex gap-3">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-4 border border-border rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSettle}
                                disabled={loading}
                                className={`flex-[2] py-4 text-white rounded-2xl font-black uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl ${selectedSeller.totalPending < 0 ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
                            >
                                {loading ? 'Procesando...' : (selectedSeller.totalPending < 0 ? 'Confirmar Cobro' : 'Confirmar y Liquidar')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
