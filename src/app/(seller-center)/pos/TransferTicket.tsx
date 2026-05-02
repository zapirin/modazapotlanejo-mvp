"use client";

import React from 'react';

type TransferItem = {
    id: string;
    quantity: number;
    productName: string;
    variantInfo: string | null;
};

type Transfer = {
    id: string;
    folio: number;
    createdAt: string | Date;
    totalItems: number;
    sourceLocation: { id: string; name: string; address?: string | null; ticketHeader?: string | null; ticketFooter?: string | null } | null;
    destLocation: { id: string; name: string; address?: string | null } | null;
    user: { id: string; name: string } | null;
    seller?: { id: string; name: string; businessName?: string | null; logoUrl?: string | null } | null;
    items: TransferItem[];
};

export default function TransferTicket({
    transfer,
    elementId,
    isReprint = false,
    storeName,
    logoUrl,
}: {
    transfer: Transfer;
    elementId: string;
    isReprint?: boolean;
    storeName?: string | null;
    logoUrl?: string | null;
}) {
    const folioStr = `T-${String(transfer.folio).padStart(6, '0')}`;
    const headerLogo = logoUrl || transfer.seller?.logoUrl;
    const headerName = storeName || transfer.seller?.businessName || transfer.seller?.name || 'PUNTO DE VENTA';

    return (
        <div id={elementId} className="bg-white text-black w-[80mm] min-h-[100mm] shadow-md p-4 flex flex-col font-mono text-sm leading-tight shrink-0">
            <div className="text-center mb-3 flex flex-col items-center">
                {headerLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={headerLogo} alt="Logo" className="h-14 object-contain mb-1 grayscale" />
                ) : (
                    <h1 className="font-black text-lg mb-1 uppercase">{headerName}</h1>
                )}
                <p className="text-xs font-black uppercase tracking-widest">Traspaso de Inventario</p>
            </div>
            <hr className="border-dashed border-gray-400 my-2" />
            <div className="flex justify-between text-xs">
                <span>{isReprint ? 'REIMPRESIÓN' : 'COMPROBANTE'}</span>
                <span className="font-bold">Folio: #{folioStr}</span>
            </div>
            <div className="text-xs mb-1">
                {new Date(transfer.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
            {transfer.user?.name && <div className="text-xs mb-1">Usuario: {transfer.user.name}</div>}
            <hr className="border-dashed border-gray-400 my-2" />
            <div className="text-xs space-y-0.5 mb-2">
                <div className="flex justify-between"><span className="font-bold">ORIGEN:</span><span className="text-right">{transfer.sourceLocation?.name || '—'}</span></div>
                <div className="flex justify-between"><span className="font-bold">DESTINO:</span><span className="text-right">{transfer.destLocation?.name || '—'}</span></div>
            </div>
            <hr className="border-dashed border-gray-400 my-2" />
            <table className="w-full text-xs mb-2">
                <thead>
                    <tr className="border-b border-gray-300">
                        <th className="text-left pb-1">Artículo</th>
                        <th className="text-right pb-1">Cant</th>
                    </tr>
                </thead>
                <tbody>
                    {transfer.items.map((item) => (
                        <tr key={item.id} className="border-b border-dashed border-gray-200">
                            <td className="py-1 pr-1">
                                <span>{item.productName}</span>
                                {item.variantInfo && (
                                    <div className="text-[9px] text-gray-500">{item.variantInfo}</div>
                                )}
                            </td>
                            <td className="text-right py-1 font-bold">{item.quantity}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <hr className="border-dashed border-gray-400 my-1" />
            <div className="flex justify-between font-black text-sm mt-1">
                <span>TOTAL ARTÍCULOS</span>
                <span>{transfer.totalItems}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                <div className="text-center">
                    <div className="border-t border-black pt-1">Entrega</div>
                </div>
                <div className="text-center">
                    <div className="border-t border-black pt-1">Recibe</div>
                </div>
            </div>
            <p className="text-[9px] text-center text-gray-400 mt-3">*** {isReprint ? 'REIMPRESIÓN — ' : ''}TRASPASO ***</p>
        </div>
    );
}
