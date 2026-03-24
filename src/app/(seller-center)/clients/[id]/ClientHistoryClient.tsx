"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getClientById } from '../actions';

export default function ClientHistoryClient({ clientId }: { clientId: string }) {
    const [client, setClient] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadClientData = async () => {
            setIsLoading(true);
            const res = await getClientById(clientId);
            if (res.success && res.client) {
                setClient(res.client);
            }
            setIsLoading(false);
        };
        loadClientData();
    }, [clientId]);

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center items-center h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="p-8 text-center text-gray-500">
                <p>Cliente no encontrado o no tienes permisos para verlo.</p>
                <Link href="/clients" className="text-blue-600 hover:underline mt-4 inline-block">Volver al Directorio</Link>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/clients" className="text-gray-400 hover:text-blue-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </Link>
                        <h1 className="text-2xl lg:text-3xl font-black text-foreground">{client.name}</h1>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-500 ml-8">
                        {client.phone && <span className="flex items-center gap-1">📞 {client.phone}</span>}
                        {client.email && <span className="flex items-center gap-1">✉️ {client.email}</span>}
                    </div>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-border shadow-sm flex-1 md:flex-none md:min-w-[150px]">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Ventas</p>
                        <p className="text-xl font-black">{client.sales?.length || 0}</p>
                    </div>
                    <div className={`p-4 rounded-2xl border shadow-sm flex-1 md:flex-none md:min-w-[180px] ${
                        client.storeCredit > 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                        client.storeCredit < 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                        'bg-white dark:bg-gray-800 border-border'
                    }`}>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">
                            {client.storeCredit > 0 ? 'Saldo a Favor' : client.storeCredit < 0 ? 'Deuda Activa' : 'Saldo Global'}
                        </p>
                        <p className={`text-xl font-black ${
                            client.storeCredit > 0 ? 'text-green-600 dark:text-green-400' :
                            client.storeCredit < 0 ? 'text-red-600 dark:text-red-400' :
                            'text-foreground'
                        }`}>
                            ${Math.abs(client.storeCredit).toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Historial de Transacciones */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 className="text-lg font-bold text-foreground">Historial de Transacciones</h2>
                </div>
                
                {client.sales && client.sales.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-6 py-4">Fecha / Ticket</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Artículos</th>
                                    <th className="px-6 py-4">Monto Base</th>
                                    <th className="px-6 py-4 text-center">Descuento</th>
                                    <th className="px-6 py-4 text-right">Total Pagado / Cargado</th>
                                    <th className="px-6 py-4 text-right">Saldo Adeudado (Si Layaway)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {client.sales.map((sale: any) => {
                                    const date = new Date(sale.createdAt).toLocaleString();
                                    const itemsCount = sale.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
                                    
                                    let statusBadge = '';
                                    switch(sale.status) {
                                        case 'COMPLETED': statusBadge = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'; break;
                                        case 'LAYAWAY': statusBadge = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'; break;
                                        case 'STORE_CREDIT': statusBadge = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'; break;
                                        case 'CANCELLED': statusBadge = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'; break;
                                        default: statusBadge = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
                                    }

                                    return (
                                        <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-foreground">
                                                    {sale.receiptNumber ? `#PDV${sale.receiptNumber}` : sale.id.split('-')[0].toUpperCase()}
                                                </div>
                                                <div className="text-xs text-gray-500">{date}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-md tracking-wider ${statusBadge}`}>
                                                    {sale.status === 'STORE_CREDIT' ? 'ABONO/CARGO' : sale.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {itemsCount > 0 ? (
                                                    <span className="font-medium">{itemsCount} pz</span>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                ${sale.subtotal.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {sale.discount > 0 ? (
                                                    <span className="text-green-600 font-bold">-${sale.discount.toFixed(2)}</span>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-foreground">
                                                ${sale.total.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {sale.status === 'LAYAWAY' ? (
                                                    <span className="font-bold text-orange-600 dark:text-orange-400">${sale.balance?.toFixed(2) || '0.00'}</span>
                                                ) : <span className="text-gray-400">-</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-400">
                        <div className="text-4xl mb-4">📝</div>
                        <p className="font-bold text-lg text-foreground">No hay transacciones</p>
                        <p className="text-sm">Este cliente aún no tiene un historial de compras comerciales ni abonos.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
