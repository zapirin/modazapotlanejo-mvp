"use client";

import React from 'react';

type SaleItem = {
    id?: string;
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
    subtotal?: number;
    discount?: number;
    amountPaid?: number;
    balance?: number;
    dueDate?: string | Date | null;
    status?: string | null;
    paymentSplit?: string | null;
    items: SaleItem[];
    client?: { name: string } | null;
    paymentMethod?: { name: string } | null;
    priceTier?: { name: string } | null;
    location?: {
        name?: string | null;
        address?: string | null;
        ticketHeader?: string | null;
        ticketFooter?: string | null;
    } | null;
    soldBy?: { name: string } | null;
    salesperson?: { name: string } | null;
};

// Este componente es la ÚNICA reimpresión del sistema: lo usan el modal de
// ventas del cliente, el historial del producto y los tickets del día del POS.
// Está calcado del ticket original que arma `pos/page.tsx` (#thermal-receipt)
// al cerrar una venta, campo por campo, para que la reimpresión no le quite
// nada al papel que ya se le dio al cliente.
export default function SaleTicket({
    sale,
    elementId,
    isReprint = true,
    storeName,
    logoUrl,
    address,
    phone,
    taxId,
}: {
    sale: Sale;
    elementId: string;
    isReprint?: boolean;
    storeName?: string | null;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    taxId?: string | null;
}) {
    const splits: any[] | null = (() => {
        if (!sale.paymentSplit) return null;
        try {
            const parsed = JSON.parse(sale.paymentSplit);
            return Array.isArray(parsed) ? parsed : null;
        } catch { return null; }
    })();

    const piezas = (sale.items || []).reduce((s, i) => s + (i.quantity || 0), 0);

    // El original marca la devolución por el signo del subtotal, que es lo
    // mismo que decir "las piezas suman negativo". No hay campo en la base:
    // se reconstruye igual que allá.
    const esDevolucion = piezas < 0;
    // Un apartado es una venta que quedó debiendo. El estado LAYAWAY es el
    // camino normal; el saldo pendiente cubre las que se guardaron de otro modo.
    // Medio centavo de tolerancia: el dinero es Float y un residuo no es deuda.
    const esApartado = sale.status === 'LAYAWAY' || (sale.balance || 0) > 0.005;

    const subtotal = sale.subtotal ?? sale.total;
    const descuento = sale.discount ?? 0;
    const pagado = sale.amountPaid || 0;
    const metodo = sale.paymentMethod?.name || '';
    const esEfectivo = metodo.toLowerCase().includes('efectivo');

    const dominio = (storeName || 'modazapotlanejo').toLowerCase().replace(/\s/g, '');

    return (
        <div id={elementId} className="bg-white text-black w-[80mm] shadow-md p-3 flex flex-col font-mono text-[11px] leading-snug relative shrink-0">
            <div className="text-center mb-2 flex flex-col items-center">
                {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Store Logo" className="h-16 object-contain mb-2 grayscale" />
                ) : (
                    <h1 className="font-black text-xl mb-1 uppercase">
                        {sale.location?.name || storeName || 'MODA ZAPOTLANEJO'}
                    </h1>
                )}

                {/* Con logo, el nombre de la sucursal va debajo. Sin logo, el h1 ya es la sucursal. */}
                {logoUrl && sale.location?.name && (
                    <h2 className="font-bold text-sm uppercase mb-1">{sale.location.name}</h2>
                )}

                {sale.location?.ticketHeader && (
                    <p className="text-xs font-bold mt-1">{sale.location.ticketHeader}</p>
                )}

                <p className="text-xs">{sale.location?.address || address || 'Zapotlanejo, Jalisco'}</p>
                {phone && <p className="text-xs">Tel: {phone}</p>}
                {taxId && <p className="text-xs">RFC: {taxId}</p>}
            </div>

            <div className="border-t border-b border-dashed border-black py-2 mb-2 text-xs">
                <p>Ticket: #PDV{sale.receiptNumber || sale.id?.slice(-6).toUpperCase()}</p>
                <p>Fecha: {new Date(sale.createdAt).toLocaleString()}</p>
                {sale.soldBy?.name && <p>Cajero: {sale.soldBy.name}</p>}
                {sale.salesperson?.name && <p>Vendedor: {sale.salesperson.name}</p>}
                <p>Cliente: {sale.client?.name || 'Venta de Mostrador'}</p>
                {esApartado && <p className="font-bold">* APARTADO *</p>}
                {esDevolucion && <p className="font-bold">* DEVOLUCIÓN *</p>}
            </div>

            <table className="w-full text-xs text-left mb-2">
                <thead>
                    <tr className="border-b border-black">
                        <th className="py-1 w-8">Cant</th>
                        <th className="py-1 text-left">Desc</th>
                        <th className="py-1 text-right">Imp</th>
                    </tr>
                </thead>
                <tbody>
                    {(sale.items || []).map((item, idx) => (
                        <tr key={item.id || idx} className="align-top">
                            <td className="py-0.5 pr-1 leading-tight w-6">{item.quantity}</td>
                            <td className="py-0.5 break-words pr-1 leading-tight">
                                {item.variant?.product?.name || 'Producto'}
                                {(item.variant?.color || item.variant?.size) && (
                                    <span className="block text-[9px] opacity-60">
                                        {[item.variant?.color, item.variant?.size].filter(Boolean).join(' / ')}
                                    </span>
                                )}
                            </td>
                            <td className="py-0.5 text-right leading-tight whitespace-nowrap">
                                ${(item.price * item.quantity).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {descuento > 0 && (
                <div className="flex justify-between items-center text-xs mb-1">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
            )}
            {descuento > 0 && (
                <div className="flex justify-between items-center text-xs mb-2">
                    <span>Descuento{sale.priceTier?.name ? ` (${sale.priceTier.name})` : ''}:</span>
                    <span>-${descuento.toFixed(2)}</span>
                </div>
            )}

            <div className="flex justify-between items-center font-black text-lg border-t border-black pt-2 mb-2">
                <span>TOTAL:</span>
                <span>${sale.total.toFixed(2)}</span>
            </div>

            {esEfectivo && pagado >= sale.total && (
                <div className="border-t border-black pt-2 space-y-1 mb-2">
                    <div className="flex justify-between items-center text-xs">
                        <span>Efectivo:</span>
                        <span>${pagado.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold">
                        <span>Cambio:</span>
                        <span>${(pagado - sale.total).toFixed(2)}</span>
                    </div>
                </div>
            )}

            {esApartado && (
                <>
                    <div className="flex justify-between items-center text-xs mt-2 border-t border-black pt-1">
                        <span>Enganche:</span>
                        <span>${pagado.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span>Resta por pagar:</span>
                        <span className="font-bold">${(sale.balance || 0).toFixed(2)}</span>
                    </div>
                    {sale.dueDate && (
                        <div className="flex justify-between items-center text-[10px] mt-1 text-gray-700">
                            <span>Vence:</span>
                            <span>{new Date(sale.dueDate).toLocaleDateString()}</span>
                        </div>
                    )}
                </>
            )}

            <div className="text-xs mb-1 mt-0.5">
                {splits && splits.length > 0 ? (
                    <div>
                        {splits.map((p: any, i: number) => (
                            <div key={i}>Pago {i + 1}: {p.method} — ${(p.amount || 0).toFixed(2)}</div>
                        ))}
                    </div>
                ) : (
                    <span>Pago: {metodo}</span>
                )}
                {' · '}
                <span>{piezas} artículo(s)</span>
            </div>

            <div className="text-center text-[10px] border-t border-dashed border-black pt-2 mt-2">
                {sale.location?.ticketFooter ? (
                    <p className="font-bold whitespace-pre-line">{sale.location.ticketFooter}</p>
                ) : (
                    <>
                        <p className="font-bold">¡GRACIAS POR SU COMPRA!</p>
                        <p>No hay cambios ni devoluciones</p>
                        <p>salvo por defecto de fábrica en 7 días.</p>
                    </>
                )}
                <p className="mt-2 opacity-50 text-[8px]">{dominio}.com</p>
            </div>

            {isReprint && <p className="text-[9px] text-center text-gray-400 mt-3">*** REIMPRESIÓN ***</p>}
        </div>
    );
}
