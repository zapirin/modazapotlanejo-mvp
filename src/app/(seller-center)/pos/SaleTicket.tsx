"use client";

import React from 'react';

type SaleItem = {
    id: string;
    quantity: number;
    price: number;
    variant?: {
        size?: string | null;
        color?: string | null;
        product?: { id: string; name: string } | null;
    } | null;
};

type Sale = {
    id: string;
    receiptNumber?: number | null;
    createdAt: string | Date;
    total: number;
    discount?: number;
    amountPaid?: number;
    paymentSplit?: string | null;
    items: SaleItem[];
    client?: { name: string } | null;
    paymentMethod?: { name: string } | null;
    location?: {
        name?: string | null;
        address?: string | null;
        ticketHeader?: string | null;
        ticketFooter?: string | null;
    } | null;
    soldBy?: { name: string } | null;
    salesperson?: { name: string } | null;
};

export default function SaleTicket({
    sale,
    elementId,
    isReprint = true,
    storeName,
    logoUrl,
}: {
    sale: Sale;
    elementId: string;
    isReprint?: boolean;
    storeName?: string | null;
    logoUrl?: string | null;
}) {
    const headerName = sale.location?.name || storeName || 'PUNTO DE VENTA';
    const splits: any[] | null = (() => {
        if (!sale.paymentSplit) return null;
        try { return JSON.parse(sale.paymentSplit); } catch { return null; }
    })();

    return (
        <div id={elementId} className="bg-white text-black w-[80mm] min-h-[100mm] shadow-md p-4 flex flex-col font-mono text-sm leading-tight shrink-0">
            <div className="text-center mb-3 flex flex-col items-center">
                {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="h-14 object-contain mb-1 grayscale" />
                ) : (
                    <h1 className="font-black text-lg mb-1 uppercase">{headerName}</h1>
                )}
                {logoUrl && sale.location?.name && (
                    <h2 className="font-bold text-sm uppercase mb-1">{sale.location.name}</h2>
                )}
                {sale.location?.ticketHeader && <p className="text-xs font-bold mt-1">{sale.location.ticketHeader}</p>}
                <p className="text-xs">{sale.location?.address || 'Zapotlanejo, Jalisco'}</p>
            </div>
            <hr className="border-dashed border-gray-400 my-2" />
            <div className="flex justify-between text-xs">
                <span>{isReprint ? 'REIMPRESIÓN' : 'TICKET'}</span>
                <span className="font-bold">Ticket: #PDV{sale.receiptNumber || sale.id?.slice(-6).toUpperCase()}</span>
            </div>
            <div className="text-xs mb-1">
                {new Date(sale.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
            {sale.client?.name && <div className="text-xs mb-1">Cliente: {sale.client.name}</div>}
            {sale.soldBy?.name && <div className="text-xs mb-1">Cajero: {sale.soldBy.name}</div>}
            {sale.salesperson?.name && <div className="text-xs mb-1">Vendedor: {sale.salesperson.name}</div>}
            <hr className="border-dashed border-gray-400 my-2" />
            <table className="w-full text-xs mb-2">
                <thead>
                    <tr className="border-b border-gray-300">
                        <th className="text-left pb-1">Artículo</th>
                        <th className="text-center pb-1">Cant</th>
                        <th className="text-right pb-1">Importe</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items?.map((item, idx) => (
                        <tr key={item.id || idx} className="border-b border-dashed border-gray-200">
                            <td className="py-1 pr-1">
                                <span>{item.variant?.product?.name || 'Producto'}</span>
                                {(item.variant?.size || item.variant?.color) && (
                                    <div className="text-[9px] text-gray-500">
                                        {[item.variant.color, item.variant.size].filter(Boolean).join(' / ')}
                                    </div>
                                )}
                            </td>
                            <td className="text-center py-1">{item.quantity}</td>
                            <td className="text-right py-1">${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <hr className="border-dashed border-gray-400 my-1" />
            {(sale.discount ?? 0) > 0 && (
                <div className="flex justify-between text-xs"><span>Descuento</span><span>-${(sale.discount as number).toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-black text-base mt-1">
                <span>TOTAL</span>
                <span>${sale.total.toFixed(2)}</span>
            </div>
            {splits && splits.length > 0
                ? splits.map((p: any, i: number) => (
                    <div key={i} className="text-xs mt-0.5">Pago {i + 1}: {p.method} — ${p.amount?.toFixed(2)}</div>
                ))
                : sale.paymentMethod?.name && (
                    <div className="text-xs mt-1">
                        Pago: {sale.paymentMethod.name}
                        {sale.amountPaid ? ` — $${sale.amountPaid.toFixed(2)}` : ''}
                    </div>
                )}
            {(sale.amountPaid || 0) > sale.total && (
                <div className="text-xs">Cambio: ${((sale.amountPaid || 0) - sale.total).toFixed(2)}</div>
            )}
            {sale.location?.ticketFooter && (
                <>
                    <hr className="border-dashed border-gray-400 my-2" />
                    <p className="text-xs text-center">{sale.location.ticketFooter}</p>
                </>
            )}
            {isReprint && <p className="text-[9px] text-center text-gray-400 mt-3">*** REIMPRESIÓN ***</p>}
        </div>
    );
}
