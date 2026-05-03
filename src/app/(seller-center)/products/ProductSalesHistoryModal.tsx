"use client";

import React, { useEffect, useState } from 'react';
import { getProductSalesHistory, getSaleForReprint } from '../inventory/actions';
import SaleTicket from '../pos/SaleTicket';

const STATUS_LABEL: Record<string, string> = {
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    SUSPENDED: 'Suspendida',
    LAYAWAY: 'Apartado',
    RETURNED: 'Devuelta',
};

const STATUS_COLOR: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    SUSPENDED: 'bg-yellow-100 text-yellow-700',
    LAYAWAY: 'bg-blue-100 text-blue-700',
    RETURNED: 'bg-orange-100 text-orange-700',
};

const printSaleTicket = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const bodyChildren = Array.from(document.body.children) as HTMLElement[];
    const savedStyles: { el: HTMLElement; display: string }[] = [];
    bodyChildren.forEach(child => {
        savedStyles.push({ el: child, display: child.style.display });
        child.style.display = 'none';
    });
    const printArea = document.createElement('div');
    printArea.style.cssText = 'background:white;margin:0;padding:0;width:100%;display:flex;justify-content:center;';
    printArea.innerHTML = el.outerHTML;
    printArea.querySelectorAll('[class]').forEach(node => { (node as HTMLElement).style.boxShadow = 'none'; });
    document.body.appendChild(printArea);
    const origBg = document.body.style.background;
    const origMargin = document.body.style.margin;
    document.body.style.background = 'white';
    document.body.style.margin = '0';
    try { window.print(); } catch (err) { console.error(err); }
    const restore = () => {
        printArea.remove();
        document.body.style.background = origBg;
        document.body.style.margin = origMargin;
        savedStyles.forEach(({ el: child, display }) => { child.style.display = display; });
    };
    window.addEventListener('afterprint', restore, { once: true });
    setTimeout(restore, 3000);
};

export default function ProductSalesHistoryModal({
    productId,
    productName,
    onClose,
}: {
    productId: string;
    productName: string;
    onClose: () => void;
}) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('all');
    const [reprintSale, setReprintSale] = useState<any | null>(null);
    const [globalConfig, setGlobalConfig] = useState<any>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getProductSalesHistory(productId, page, status).then(res => {
            if (cancelled) return;
            if (res.success) setData(res);
            else alert(res.error || 'Error al cargar historial.');
            setLoading(false);
        });
        
        // Cargar config global para el logo del ticket (solo una vez)
        if (!globalConfig) {
            import('../settings/actions').then(({ getStoreSettings }) => {
                getStoreSettings().then(res => {
                    if (cancelled) return;
                    if (res.success) setGlobalConfig(res.data);
                });
            });
        }
        
        return () => { cancelled = true; };
    }, [productId, page, status, globalConfig]);

    const handleViewTicket = async (saleId: string) => {
        const sale = await getSaleForReprint(saleId);
        if (sale) setReprintSale(sale);
        else alert('No se pudo cargar el ticket.');
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-card w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-border bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl shrink-0 flex justify-between items-center gap-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-foreground truncate">📊 Historial de Ventas</h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{productName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <select
                            value={status}
                            onChange={e => { setStatus(e.target.value); setPage(1); }}
                            className="bg-input border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none"
                        >
                            <option value="all">Todas</option>
                            <option value="COMPLETED">Completadas</option>
                            <option value="CANCELLED">Canceladas</option>
                            <option value="RETURNED">Devoluciones</option>
                            <option value="LAYAWAY">Apartados</option>
                            <option value="SUSPENDED">Suspendidas</option>
                        </select>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 flex items-center justify-center font-bold transition-colors"
                        >✕</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
                            <span className="text-sm font-bold">Cargando historial...</span>
                        </div>
                    ) : !data || data.rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                            <span className="text-4xl">📊</span>
                            <span className="text-sm font-bold">Sin ventas para este producto.</span>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                                <tr className="text-[10px] uppercase tracking-widest text-gray-400 font-black">
                                    <th className="text-left px-4 py-3">Fecha</th>
                                    <th className="text-left px-3 py-3">Ticket</th>
                                    <th className="text-left px-3 py-3">Variante</th>
                                    <th className="text-center px-3 py-3">Qty</th>
                                    <th className="text-right px-3 py-3">P. unit</th>
                                    <th className="text-right px-3 py-3">Total venta</th>
                                    <th className="text-left px-3 py-3">Sucursal</th>
                                    <th className="text-left px-3 py-3">Cajero</th>
                                    <th className="text-left px-3 py-3">Vendedor</th>
                                    <th className="text-left px-3 py-3">Estatus</th>
                                    <th className="text-right px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.flatMap((sale: any) => (
                                    sale.items.map((item: any, idx: number) => (
                                        <tr key={`${sale.id}-${item.id}`} className="border-b border-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition">
                                            <td className="px-4 py-3 text-xs text-gray-500 font-bold tabular-nums whitespace-nowrap">
                                                {new Date(sale.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                            </td>
                                            <td className="px-3 py-3 font-black text-foreground tabular-nums">#{sale.receiptNumber || sale.id.slice(-6)}</td>
                                            <td className="px-3 py-3 text-xs">{item.variantInfo || '—'}</td>
                                            <td className="px-3 py-3 text-center font-bold tabular-nums">{item.quantity}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">${item.price.toFixed(2)}</td>
                                            <td className="px-3 py-3 text-right font-bold tabular-nums">${sale.total.toFixed(2)}</td>
                                            <td className="px-3 py-3 text-xs text-gray-600">{sale.locationName || '—'}</td>
                                            <td className="px-3 py-3 text-xs text-gray-600">{sale.cashierName || '—'}</td>
                                            <td className="px-3 py-3 text-xs text-gray-600">{sale.salespersonName || '—'}</td>
                                            <td className="px-3 py-3">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${STATUS_COLOR[sale.status] || 'bg-gray-100 text-gray-700'}`}>
                                                    {STATUS_LABEL[sale.status] || sale.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {idx === 0 && (
                                                    <button
                                                        onClick={() => handleViewTicket(sale.id)}
                                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                                                    >Ver Ticket</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {data && data.totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-border bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between text-xs">
                        <span className="text-gray-500 font-bold">
                            {data.total} venta{data.total !== 1 ? 's' : ''} · página {data.page} de {data.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg border border-border font-bold disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >← Anterior</button>
                            <button
                                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                                disabled={page >= data.totalPages}
                                className="px-3 py-1.5 rounded-lg border border-border font-bold disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >Siguiente →</button>
                        </div>
                    </div>
                )}
            </div>

            {reprintSale && (
                <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={() => setReprintSale(null)}>
                    <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-border bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl shrink-0 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-foreground">🖨️ Ticket #{reprintSale.receiptNumber || reprintSale.id.slice(-6)}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{new Date(reprintSale.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
                            </div>
                            <button onClick={() => setReprintSale(null)} className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 flex items-center justify-center font-bold transition-colors">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900 flex justify-center">
                            <SaleTicket 
                                sale={reprintSale} 
                                elementId="history-reprint" 
                                isReprint 
                                logoUrl={globalConfig?.logoUrl}
                                storeName={globalConfig?.storeName}
                            />
                        </div>
                        <div className="p-4 bg-card border-t border-border flex gap-3 rounded-b-3xl">
                            <button
                                onClick={() => setReprintSale(null)}
                                className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >Cerrar</button>
                            <button
                                onClick={() => printSaleTicket('history-reprint')}
                                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors flex justify-center items-center gap-2"
                            >🖨️ Imprimir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
