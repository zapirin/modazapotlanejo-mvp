"use client";

import React, { useEffect, useState } from 'react';
import SaleTicket from '@/app/(seller-center)/pos/SaleTicket';
import { getStoreSettings } from '@/app/(seller-center)/settings/actions';

const TICKET_ELEMENT_ID = 'sale-ticket-modal';

// Imprime solo el ticket: esconde el resto del body, inserta una copia del
// ticket, manda a imprimir y restaura todo. Movido tal cual desde
// ProductSalesHistoryModal.tsx.
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

export default function SaleTicketModal({
    sale,
    onClose,
}: {
    sale: any;
    onClose: () => void;
}) {
    // El logo y el nombre de la tienda los resuelve el propio modal, para que
    // ninguna pantalla que lo use tenga que acordarse de pasarlos.
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        let cancelled = false;
        getStoreSettings().then(res => {
            if (cancelled) return;
            if (res.success) setConfig(res.data);
        });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-border bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl shrink-0 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-foreground">🖨️ Ticket #{sale.receiptNumber || sale.id.slice(-6)}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{new Date(sale.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 flex items-center justify-center font-bold transition-colors">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900 flex justify-center">
                    <SaleTicket
                        sale={sale}
                        elementId={TICKET_ELEMENT_ID}
                        isReprint
                        logoUrl={config?.logoUrl}
                        storeName={config?.storeName}
                    />
                </div>
                <div className="p-4 bg-card border-t border-border flex gap-3 rounded-b-3xl">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >Cerrar</button>
                    <button
                        onClick={() => printSaleTicket(TICKET_ELEMENT_ID)}
                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors flex justify-center items-center gap-2"
                    >🖨️ Imprimir</button>
                </div>
            </div>
        </div>
    );
}
