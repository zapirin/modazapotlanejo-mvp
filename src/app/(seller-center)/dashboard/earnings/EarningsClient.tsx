"use client";

import React from 'react';

interface EarningsClientProps {
    balance: {
        availableBalance: number;
        pendingOrdersCount: number;
        totalPaid: number;
    } | null;
    settlements: any[];
}

export default function EarningsClient({ balance, settlements }: EarningsClientProps) {
    return (
        <div className="space-y-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black tracking-tight">Mis Ganancias</h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Resumen de tus ventas, comisiones y pagos recibidos.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`${(balance?.availableBalance || 0) < 0 ? 'bg-red-600 shadow-red-500/20' : 'bg-blue-600 shadow-blue-500/20'} rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group`}>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">
                            {(balance?.availableBalance || 0) < 0 ? 'Adeudo de Comisiones' : 'Saldo Disponible'}
                        </p>
                        <h2 className="text-4xl font-black mb-1">
                            ${Math.abs(balance?.availableBalance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </h2>
                        <p className="text-xs font-bold opacity-70">
                            {balance?.pendingOrdersCount || 0} órdenes sin liquidar
                        </p>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm group">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Total Cobrado</p>
                    <h2 className="text-3xl font-black text-foreground mb-1">
                        ${(balance?.totalPaid || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </h2>
                    <p className="text-xs font-bold text-green-600">Historial de liquidaciones</p>
                </div>

                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm group">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Próximo Pago</p>
                    <h2 className="text-3xl font-black text-foreground mb-1">Pendiente</h2>
                    <p className="text-xs font-bold text-gray-500">Sujeto a revisión administrativa</p>
                </div>
            </div>

            {/* History Table */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black tracking-tight">Historial de Liquidaciones</h3>
                </div>

                {settlements.length === 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-900/50 border border-dashed border-border rounded-3xl p-16 text-center">
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Sin registros de pago aún</p>
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border bg-gray-50/50 dark:bg-gray-900/50">
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Referencia</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Órdenes</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Comisión</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Neto Recibido</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {settlements.map((s) => (
                                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-bold">
                                                {new Date(s.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-medium text-gray-600 dark:text-gray-400">
                                                <span className="font-black text-foreground block">{s.paymentMethod}</span>
                                                {s.reference || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold">
                                                {s.ordersCount}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-red-500/80">
                                                -${s.commissionTotal.toLocaleString('es-MX')}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-lg font-black ${s.amount < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                    ${Math.abs(s.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Info Box */}
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-3xl p-6 flex gap-4">
                <div className="text-2xl">💡</div>
                <div>
                    <h4 className="font-bold text-orange-900 dark:text-orange-200">Sobre tus liquidaciones</h4>
                    <p className="text-xs text-orange-800 dark:text-orange-300 mt-1">
                        Las órdenes se consideran disponibles para liquidar 24 horas después de haber sido marcadas como "Completadas". 
                        El administrador procesa los pagos semanalmente. Si tienes dudas, puedes contactar a soporte.
                    </p>
                </div>
            </div>
        </div>
    );
}
