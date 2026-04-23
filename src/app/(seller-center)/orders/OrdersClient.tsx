"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { updateOrderStatus, deleteOrder, searchOrderVariants, updateOrderItems } from "@/app/actions/orders";
import { releasePayment, refundPayment } from "@/app/actions/escrow";
import Link from "next/link";

// ── Modal para editar artículos de un pedido ─────────────────────────────────
function EditOrderModal({ order, onClose, onSaved }: {
    order: any;
    onClose: () => void;
    onSaved: (orderId: string, newItems: any[], newTotal: number) => void;
}) {
    const [items, setItems] = useState<any[]>(
        order.items.map((i: any) => ({ ...i, _key: i.id }))
    );
    const [query, setQuery]           = useState('');
    const [results, setResults]       = useState<any[]>([]);
    const [searching, setSearching]   = useState(false);
    const [saving, setSaving]         = useState(false);
    const [noteForBuyer, setNoteForBuyer] = useState('');
    const timerRef = useRef<any>(null);

    const doSearch = useCallback(async (q: string) => {
        setSearching(true);
        const res = await searchOrderVariants(order.sellerId, q);
        setResults(res.variants || []);
        setSearching(false);
    }, [order.sellerId]);

    useEffect(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => doSearch(query), 350);
        return () => clearTimeout(timerRef.current);
    }, [query, doSearch]);

    // Load initial results on open
    useEffect(() => { doSearch(''); }, [doSearch]);

    const addVariant = (v: any) => {
        const exists = items.find(i => i.variantId === v.id);
        if (exists) {
            setItems(prev => prev.map(i => i.variantId === v.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
            setItems(prev => [...prev, {
                _key: `new-${v.id}`,
                variantId: v.id,
                quantity: 1,
                price: v.product.wholesalePrice || v.product.price,
                productName: v.product.name,
                color: v.color || null,
                size: v.size || null,
            }]);
        }
    };

    const removeItem = (key: string) => setItems(prev => prev.filter(i => i._key !== key));
    const setQty = (key: string, qty: number) => {
        if (qty < 1) return;
        setItems(prev => prev.map(i => i._key === key ? { ...i, quantity: qty } : i));
    };

    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

    const handleSave = async (notifyBuyer: boolean) => {
        if (items.length === 0) { toast.error('El pedido debe tener al menos un artículo'); return; }
        setSaving(true);
        const payload = items.map(i => ({
            variantId: i.variantId,
            quantity: i.quantity,
            price: i.price,
            productName: i.productName,
            color: i.color,
            size: i.size,
        }));
        const res = await updateOrderItems(order.id, payload, {
            notifyBuyer,
            sellerNotes: noteForBuyer || undefined,
        });
        if (res.success) {
            toast.success(notifyBuyer ? 'Pedido actualizado y comprador notificado' : 'Pedido actualizado');
            onSaved(order.id, items, res.newTotal ?? total);
        } else {
            toast.error(res.error || 'Error al guardar');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card rounded-3xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-foreground">Editar Pedido #{order.orderNumber}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Agrega o quita productos según lo acordado con el comprador</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition font-bold">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">

                    {/* Artículos actuales */}
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Artículos del pedido</h3>
                        {items.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-border rounded-2xl text-gray-400 text-sm font-medium">
                                Sin artículos — agrega productos abajo
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {items.map(item => (
                                    <div key={item._key} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                        <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center text-base shrink-0">👕</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{item.productName}</p>
                                            <p className="text-[11px] text-gray-500">
                                                {[item.color && item.color !== 'Único' ? item.color : null, item.size && item.size !== 'Único' ? `Talla ${item.size}` : null].filter(Boolean).join(' · ')}
                                                {' · '}${item.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}/pz
                                            </p>
                                        </div>
                                        {/* Cantidad */}
                                        <div className="flex items-center gap-1 border border-border rounded-xl overflow-hidden shrink-0">
                                            <button onClick={() => setQty(item._key, item.quantity - 1)} className="px-2.5 py-1.5 text-sm font-black hover:bg-gray-100 dark:hover:bg-gray-700 transition">−</button>
                                            <span className="px-2 text-sm font-black tabular-nums min-w-[2ch] text-center">{item.quantity}</span>
                                            <button onClick={() => setQty(item._key, item.quantity + 1)} className="px-2.5 py-1.5 text-sm font-black hover:bg-gray-100 dark:hover:bg-gray-700 transition">+</button>
                                        </div>
                                        <p className="text-sm font-black tabular-nums text-foreground shrink-0 w-20 text-right">
                                            ${(item.price * item.quantity).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                        </p>
                                        <button onClick={() => removeItem(item._key)} className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition flex items-center justify-center shrink-0 text-xs font-black">✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Buscador de productos de reemplazo */}
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Agregar producto de reemplazo</h3>
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Buscar por nombre de producto..."
                            className="w-full px-4 py-3 bg-input border border-border rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                        />
                        {searching ? (
                            <div className="text-center py-4 text-gray-400 text-xs font-black uppercase tracking-widest">Buscando...</div>
                        ) : results.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-sm">Sin resultados</div>
                        ) : (
                            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                                {results.map((v: any) => (
                                    <div key={v.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition">
                                        {v.product.images?.[0] ? (
                                            <img src={v.product.images[0]} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-border" />
                                        ) : (
                                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-lg shrink-0">👕</div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{v.product.name}</p>
                                            <p className="text-[11px] text-gray-500">
                                                {[v.color && v.color !== 'Único' ? v.color : null, v.size && v.size !== 'Único' ? `T.${v.size}` : null].filter(Boolean).join(' · ')}
                                                {' · '}<span className="font-black">{v.stock} pz</span>
                                                {' · '}${(v.product.wholesalePrice || v.product.price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => addVariant(v)}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition shrink-0"
                                        >+ Agregar</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border space-y-4 shrink-0">
                    {/* Nota para el comprador */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1.5">
                            Mensaje para el comprador <span className="normal-case font-medium">(opcional)</span>
                        </label>
                        <textarea
                            rows={2}
                            value={noteForBuyer}
                            onChange={e => setNoteForBuyer(e.target.value)}
                            placeholder="Ej: Reemplazamos el modelo X por el Y que acordamos, mismo precio..."
                            className="w-full px-4 py-3 bg-input border border-border rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nuevo total</p>
                            <p className="text-2xl font-black text-foreground tabular-nums">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                            <button onClick={onClose} className="px-4 py-3 border border-border rounded-2xl text-sm font-black text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleSave(false)}
                                disabled={saving || items.length === 0}
                                className="px-4 py-3 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 font-black text-sm rounded-2xl hover:opacity-90 transition disabled:opacity-50"
                            >{saving ? '...' : '✓ Solo guardar'}</button>
                            <button
                                onClick={() => handleSave(true)}
                                disabled={saving || items.length === 0}
                                className="px-4 py-3 bg-blue-600 text-white font-black text-sm rounded-2xl hover:bg-blue-700 transition disabled:opacity-50"
                            >{saving ? 'Enviando...' : '✉️ Guardar y notificar al comprador'}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    PENDING:         { label: "Pendiente",      class: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    PENDING_PAYMENT: { label: "Pago Pendiente", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    ACCEPTED:        { label: "Aceptado",       class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    PAID:            { label: "Pagado",         class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    SHIPPED:         { label: "Enviado",        class: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    COMPLETED:       { label: "Completado",     class: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    REJECTED:        { label: "Rechazado",      class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    CANCELLED:       { label: "Cancelado",      class: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
    REFUNDED:        { label: "Devuelto",       class: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

const TIMELINE = [
    { key: "PENDING",   label: "Recibido" },
    { key: "ACCEPTED",  label: "Aceptado" },
    { key: "SHIPPED",   label: "Enviado"  },
    { key: "COMPLETED", label: "Entregado"},
];

const TABS = [
    { key: "active",    label: "Activos",     statuses: ["PENDING", "PENDING_PAYMENT", "ACCEPTED", "PAID", "SHIPPED"] },
    { key: "completed", label: "Completados", statuses: ["COMPLETED"] },
    { key: "cancelled", label: "Cancelados",  statuses: ["CANCELLED", "REJECTED", "REFUNDED"] },
];

function Timeline({ status }: { status: string }) {
    if (["REJECTED","CANCELLED","REFUNDED"].includes(status)) return null;
    const cur = TIMELINE.findIndex(s => s.key === status);
    const idx = cur === -1 ? 0 : cur;
    return (
        <div className="px-6 py-4 border-b border-border bg-blue-50/30 dark:bg-blue-900/10">
            <div className="flex items-center justify-between relative">
                <div className="absolute left-8 right-8 top-4 h-0.5 bg-gray-200 dark:bg-gray-700 z-0" />
                <div className="absolute left-8 top-4 h-0.5 bg-blue-500 z-0 transition-all duration-500"
                    style={{ width: idx === 0 ? "0%" : `${(idx / (TIMELINE.length - 1)) * 85}%` }} />
                {TIMELINE.map((step, i) => {
                    const done = i <= idx;
                    return (
                        <div key={step.key} className="flex flex-col items-center gap-1 z-10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border-2 transition-all ${done ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400"}`}>
                                {done ? "✓" : i + 1}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-wider ${done ? "text-blue-600" : "text-gray-400"}`}>{step.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Determina el origen legible del pedido basado en el dominio donde se realizó la compra
function getOrderSource(domain?: string | null, fallbackDomain?: string | null): { label: string; color: string } {
    const d = domain || fallbackDomain || '';
    if (d.includes('kalexa')) {
        return { label: 'Kalexa Fashion', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
    }
    if (d.includes('zonadelvestir')) {
        return { label: 'Zona del Vestir', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
    }
    return { label: 'Moda Zapotlanejo', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
}

export default function OrdersClient({ orders: initial, isBuyer, isSeller, isAdmin, isKalexa }: {
    orders: any[];
    isBuyer: boolean;
    isSeller: boolean;
    isAdmin?: boolean;
    isKalexa?: boolean;
}) {
    const [orders, setOrders]       = useState(initial);
    const [activeTab, setActiveTab] = useState("active");
    const [processing, setProcessing] = useState<string | null>(null);
    const [showNotes, setShowNotes]   = useState<string | null>(null);
    const [notes, setNotes]           = useState<Record<string, string>>({});
    const [editingOrder, setEditingOrder] = useState<any | null>(null);
    const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

    const toggleOrder = (orderId: string) => {
        setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
    };

    const tabDef = TABS.find(t => t.key === activeTab)!;
    const visible = orders.filter(o => tabDef.statuses.includes(o.status));

    const counts = TABS.map(t => ({
        key: t.key,
        count: orders.filter(o => t.statuses.includes(o.status)).length,
    }));

    const handleStatus = async (orderId: string, newStatus: string) => {
        setProcessing(orderId + newStatus);
        const res = await updateOrderStatus(orderId, newStatus, notes[orderId]);
        if (res.success) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, sellerNotes: notes[orderId] || o.sellerNotes } : o));
            toast.success(`Pedido ${STATUS_CONFIG[newStatus]?.label}`);
            setShowNotes(null);
        } else {
            toast.error(res.error || "Error");
        }
        setProcessing(null);
    };

    const handleRelease = async (orderId: string, orderNumber: number) => {
        if (!confirm(`¿Liberar el pago del pedido #${orderNumber} al vendedor?\n\nEsto es irreversible.`)) return;
        setProcessing(orderId + "RELEASE");
        const res = await releasePayment(orderId);
        if (res.success) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "COMPLETED", paymentReleasedAt: new Date().toISOString() } : o));
            toast.success("Pago liberado al vendedor");
        } else {
            toast.error(res.error || "Error al liberar");
        }
        setProcessing(null);
    };

    const handleRefund = async (orderId: string, orderNumber: number) => {
        if (!confirm(`¿Reembolsar el pago completo al comprador del pedido #${orderNumber}?\n\nEsto cancelará el cobro y no se puede revertir.`)) return;
        setProcessing(orderId + "REFUND");
        const res = await refundPayment(orderId);
        if (res.success) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "REFUNDED", refundedAt: new Date().toISOString() } : o));
            toast.success("Reembolso procesado al comprador");
        } else {
            toast.error(res.error || "Error al reembolsar");
        }
        setProcessing(null);
    };

    const handleDelete = async (orderId: string) => {
        if (!confirm("¿Eliminar este pedido definitivamente? No se puede deshacer.")) return;
        setProcessing(orderId + "DELETE");
        const res = await deleteOrder(orderId);
        if (res.success) {
            setOrders(prev => prev.filter(o => o.id !== orderId));
            toast.success("Pedido eliminado");
        } else {
            toast.error(res.error || "Error");
        }
        setProcessing(null);
    };

    if (orders.length === 0) return (
        <div className="bg-card p-12 rounded-3xl border border-border text-center shadow-sm">
            <span className="text-6xl mb-6 block">🛍️</span>
            <h2 className="text-2xl font-black text-foreground mb-2">
                {isBuyer ? "Aún no tienes pedidos" : "No has recibido pedidos"}
            </h2>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                {isBuyer ? "Explora el catálogo y realiza tu primer pedido." : "Los pedidos de compradores aparecerán aquí."}
            </p>
            {isBuyer && <Link href="/catalog" className="px-10 py-4 bg-foreground text-background font-black rounded-xl hover:opacity-90 transition">Ir al Catálogo</Link>}
        </div>
    );

    return (
        <>
        <div className="space-y-6">
            {/* Pestañas */}
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
                {TABS.map(tab => {
                    const c = counts.find(x => x.key === tab.key)?.count || 0;
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === tab.key ? "bg-white dark:bg-gray-700 text-foreground shadow-sm" : "text-gray-500 hover:text-foreground"}`}>
                            {tab.label}
                            {c > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                    tab.key === "active" ? "bg-blue-100 text-blue-700" :
                                    tab.key === "completed" ? "bg-green-100 text-green-700" :
                                    "bg-red-100 text-red-600"
                                }`}>{c}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Lista */}
            {visible.length === 0 ? (
                <div className="bg-card p-10 rounded-3xl border border-dashed border-border text-center text-gray-400">
                    <p className="text-3xl mb-3">📭</p>
                    <p className="text-sm font-black uppercase tracking-widest">Sin pedidos en esta sección</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {visible.map((order: any) => (
                        <div key={order.id} className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">

                            {/* Cabecera */}
                            <div 
                                onClick={() => toggleOrder(order.id)}
                                className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pedido #{order.orderNumber}</p>
                                        {/* Badge de origen — solo para Kalexa */}
                                        {isKalexa && order.buyer && (() => {
                                            const src = getOrderSource(order.sourceDomain, order.buyer?.registeredDomain);
                                            return (
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${src.color}`}>
                                                    🌐 {src.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <p className="text-sm font-bold text-foreground">
                                        {new Date(order.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                    {isSeller && order.buyer && (
                                        <p className="text-xs text-blue-600 font-bold mt-0.5">👤 {order.buyer.businessName || order.buyer.name} · {order.buyer.email}</p>
                                    )}
                                    {isBuyer && order.seller && (
                                        <p className="text-xs text-gray-500 font-bold mt-0.5">🏭 {order.seller.businessName || order.seller.name}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm ${STATUS_CONFIG[order.status]?.class || "bg-gray-100 text-gray-700"}`}>
                                        {STATUS_CONFIG[order.status]?.label || order.status}
                                    </span>
                                    <p className="text-xl font-black text-foreground">${order.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                    
                                    <div className={`w-8 h-8 rounded-full bg-white dark:bg-gray-700 shadow-sm border border-border flex items-center justify-center transform transition-transform ${expandedOrders[order.id] ? 'rotate-180' : ''}`}>
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Contenido Colapsable */}
                            {expandedOrders[order.id] && (
                                <>

                            {/* Timeline */}
                            <Timeline status={order.status} />

                            {/* Contenido */}
                            <div className="p-6">
                                <div className="grid md:grid-cols-2 gap-8">
                                    {/* Artículos */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Artículos</h3>
                                        {order.items.map((item: any) => (
                                            <div key={item.id} className="flex gap-3 items-center">
                                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-lg shrink-0">👕</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-foreground truncate">{item.productName}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {[item.color !== "Único" ? item.color : null, item.size !== "Único" ? `Talla ${item.size}` : null].filter(Boolean).join(" · ")} · {item.quantity} pz · ${item.price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}/pz
                                                    </p>
                                                </div>
                                                <p className="text-sm font-bold text-foreground shrink-0">${(item.price * item.quantity).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        ))}

                                        {/* ── Resumen de totales ── */}
                                        {(() => {
                                            const subtotal = order.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
                                            const shipping = order.shippingCost || 0;
                                            const totalPiezas = order.items.reduce((s: number, i: any) => s + i.quantity, 0);
                                            return (
                                                <div className="border-t border-border pt-3 mt-1 space-y-1.5">
                                                    <div className="flex justify-between text-xs text-gray-500">
                                                        <span>Subtotal ({totalPiezas} pz)</span>
                                                        <span className="font-bold">${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    {shipping > 0 && (
                                                        <div className="flex justify-between text-xs text-gray-500">
                                                            <span>Envío {order.shippingCarrier ? `· ${order.shippingCarrier}` : ''}</span>
                                                            <span className="font-bold">${shipping.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center pt-1 border-t border-border">
                                                        <span className="text-xs font-black uppercase tracking-widest text-foreground">Total</span>
                                                        <span className="text-lg font-black text-foreground">${(subtotal + shipping).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Detalles + Acciones */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Detalles</h3>

                                        {order.notes && (
                                            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3">
                                                <p className="text-[10px] font-black uppercase tracking-tighter text-gray-400 mb-1">Notas del comprador</p>
                                                <p className="text-sm text-foreground font-medium">{order.notes}</p>
                                            </div>
                                        )}
                                        {order.sellerNotes && (
                                            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3">
                                                <p className="text-[10px] font-black uppercase tracking-tighter text-gray-400 mb-1">Tu respuesta</p>
                                                <p className="text-sm text-foreground font-medium">{order.sellerNotes}</p>
                                            </div>
                                        )}
                                        {order.paymentMethod && isSeller && (
                                            <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1">💳 Forma de Pago</p>
                                                <p className="text-sm font-bold text-foreground">{order.paymentMethod}</p>
                                            </div>
                                        )}
                                        {order.shippingAddress && (
                                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-0.5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">📦 Envío</p>
                                                <p className="text-xs font-bold text-foreground">{order.shippingAddress.name} · {order.shippingAddress.phone}</p>
                                                <p className="text-[11px] text-gray-500">{order.shippingAddress.street}, {order.shippingAddress.colonia}, {order.shippingAddress.city}, {order.shippingAddress.state}</p>
                                                {(order.shippingCarrier || order.shippingServiceName) && (
                                                    <p className="text-[11px] font-black text-blue-600 pt-0.5">
                                                        🚚 {[order.shippingCarrier, order.shippingServiceName].filter(Boolean).join(' · ')}
                                                        {order.shippingCost > 0 && <span className="text-gray-400 font-medium ml-1">(${order.shippingCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })})</span>}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {order.shipment?.trackingNumber && (
                                            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">🚚 Guía de envío</p>
                                                <p className="text-sm font-bold text-foreground">{order.shipment.trackingNumber}</p>
                                                {order.shipment.carrier && <p className="text-xs text-gray-500">{order.shipment.carrier}</p>}
                                            </div>
                                        )}

                                        {/* ── CONTACTO DEL COMPRADOR — solo Kalexa ── */}
                                        {isKalexa && order.buyer && (
                                            <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">👤 Datos del Comprador</p>
                                                <p className="text-sm font-bold text-foreground">{order.buyer.businessName || order.buyer.name}</p>
                                                <div className="flex flex-col gap-1">
                                                    <a href={`mailto:${order.buyer.email}`}
                                                        className="text-xs text-blue-600 font-bold flex items-center gap-1.5 hover:underline">
                                                        ✉️ {order.buyer.email}
                                                    </a>
                                                    {(order.buyer.phone || order.shippingAddress?.phone) && (
                                                        <a href={`tel:${order.buyer.phone || order.shippingAddress?.phone}`}
                                                            className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 hover:underline">
                                                            📞 {order.buyer.phone || order.shippingAddress?.phone}
                                                        </a>
                                                    )}
                                                    {(order.buyer.phone || order.shippingAddress?.phone) && (
                                                        <a href={`https://wa.me/52${(order.buyer.phone || order.shippingAddress?.phone || '').replace(/\D/g, '')}`}
                                                            target="_blank" rel="noopener noreferrer"
                                                            className="text-xs text-green-600 font-bold flex items-center gap-1.5 hover:underline">
                                                            💬 WhatsApp
                                                        </a>
                                                    )}
                                                    {order.shippingAddress && (
                                                        <p className="text-xs text-gray-500 font-medium pt-1 border-t border-purple-100 dark:border-purple-800 mt-1">
                                                            📍 {order.shippingAddress.street}, {order.shippingAddress.colonia}, {order.shippingAddress.city}, {order.shippingAddress.state} <span className="font-black text-foreground">CP {order.shippingAddress.zip}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── ACCIONES VENDEDOR ── */}
                                        {isSeller && (
                                            <div className="space-y-2 pt-1">
                                                {/* Editar artículos */}
                                                {["PENDING", "PENDING_PAYMENT", "ACCEPTED", "PAID"].includes(order.status) && (
                                                    <button
                                                        onClick={() => setEditingOrder(order)}
                                                        className="w-full py-2.5 border-2 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 transition flex items-center justify-center gap-2"
                                                    >
                                                        ✏️ Editar artículos del pedido
                                                    </button>
                                                )}
                                                {order.status === "PENDING" && (
                                                    <>
                                                        {showNotes === order.id && (
                                                            <textarea rows={2} placeholder="Mensaje opcional al comprador..."
                                                                value={notes[order.id] || ""}
                                                                onChange={e => setNotes(p => ({...p, [order.id]: e.target.value}))}
                                                                className="w-full px-3 py-2 bg-input border border-border rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                                                        )}
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleStatus(order.id, "ACCEPTED")}
                                                                disabled={processing === order.id + "ACCEPTED"}
                                                                className="flex-1 py-3 bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-green-700 transition disabled:opacity-50">
                                                                {processing === order.id + "ACCEPTED" ? "..." : "✓ Aceptar"}
                                                            </button>
                                                            <button onClick={() => showNotes === order.id ? handleStatus(order.id, "REJECTED") : setShowNotes(order.id)}
                                                                disabled={processing === order.id + "REJECTED"}
                                                                className="flex-1 py-3 bg-red-500 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-600 transition disabled:opacity-50">
                                                                {processing === order.id + "REJECTED" ? "..." : "✕ Rechazar"}
                                                            </button>
                                                        </div>
                                                        <button onClick={() => setShowNotes(showNotes === order.id ? null : order.id)}
                                                            className="w-full py-2 border border-border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                                                            {showNotes === order.id ? "Ocultar nota" : "✏️ Agregar nota"}
                                                        </button>
                                                    </>
                                                )}
                                                {order.status === "PENDING_PAYMENT" && (
                                                    <button onClick={() => handleStatus(order.id, "PAID")}
                                                        disabled={processing === order.id + "PAID"}
                                                        className="w-full py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition disabled:opacity-50">
                                                        {processing === order.id + "PAID" ? "..." : "✅ Confirmar pago recibido"}
                                                    </button>
                                                )}
                                                {(order.status === "ACCEPTED" || order.status === "PAID") && (
                                                    <button onClick={() => handleStatus(order.id, "SHIPPED")}
                                                        disabled={processing === order.id + "SHIPPED"}
                                                        className="w-full py-3 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-purple-700 transition disabled:opacity-50">
                                                        {processing === order.id + "SHIPPED" ? "..." : "🚚 Marcar como Enviado"}
                                                    </button>
                                                )}
                                                {order.status === "SHIPPED" && (
                                                    <button onClick={() => handleStatus(order.id, "COMPLETED")}
                                                        disabled={processing === order.id + "COMPLETED"}
                                                        className="w-full py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition disabled:opacity-50">
                                                        {processing === order.id + "COMPLETED" ? "..." : "📦 Marcar como Entregado"}
                                                    </button>
                                                )}
                                                {!["COMPLETED","REJECTED","CANCELLED","REFUNDED"].includes(order.status) && (
                                                    <button onClick={() => { if (confirm("¿Cancelar este pedido?")) handleStatus(order.id, "CANCELLED"); }}
                                                        disabled={!!processing}
                                                        className="w-full py-2 border border-red-200 dark:border-red-900 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                                                        Cancelar pedido
                                                    </button>
                                                )}
                                                {/* Borrar si está cancelado/rechazado */}
                                                {["CANCELLED","REJECTED"].includes(order.status) && (
                                                    <button onClick={() => handleDelete(order.id)}
                                                        disabled={processing === order.id + "DELETE"}
                                                        className="w-full py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition disabled:opacity-50">
                                                        {processing === order.id + "DELETE" ? "Eliminando..." : "🗑 Eliminar pedido"}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* ── ACCIONES ADMIN (Escrow) ── */}
                                        {isAdmin && order.status === "PAID" && !order.paymentReleasedAt && !order.refundedAt && (
                                            <div className="space-y-2 pt-2 border-t border-border mt-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">💰 Control de Pago (Admin)</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleRelease(order.id, order.orderNumber)}
                                                        disabled={!!processing}
                                                        className="flex-1 py-2.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition disabled:opacity-50">
                                                        {processing === order.id + "RELEASE" ? "..." : "✅ Liberar pago"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleRefund(order.id, order.orderNumber)}
                                                        disabled={!!processing}
                                                        className="flex-1 py-2.5 bg-rose-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-rose-700 transition disabled:opacity-50">
                                                        {processing === order.id + "REFUND" ? "..." : "💸 Reembolsar"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {isAdmin && order.paymentReleasedAt && (
                                            <p className="text-[10px] text-emerald-600 font-bold pt-2 border-t border-border mt-2">✅ Pago liberado al vendedor</p>
                                        )}
                                        {isAdmin && order.refundedAt && (
                                            <p className="text-[10px] text-rose-600 font-bold pt-2 border-t border-border mt-2">💸 Reembolsado al comprador</p>
                                        )}

                                        {/* ── INFO COMPRADOR ── */}
                                        {isBuyer && (
                                            <>
                                                {order.status === "PENDING" && <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-3"><p className="text-xs font-bold text-yellow-700 dark:text-yellow-400">⏳ Esperando confirmación del vendedor</p></div>}
                                                {order.status === "ACCEPTED" && <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3"><p className="text-xs font-bold text-blue-700 dark:text-blue-400">✅ Pedido aceptado — el vendedor lo está preparando</p></div>}
                                                {order.status === "SHIPPED" && <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3"><p className="text-xs font-bold text-purple-700 dark:text-purple-400">🚚 Tu pedido está en camino</p></div>}
                                                {order.status === "COMPLETED" && <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3"><p className="text-xs font-bold text-green-700 dark:text-green-400">✅ Pedido entregado — ¡gracias por tu compra!</p></div>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Modal de edición de artículos */}
        {editingOrder && (
            <EditOrderModal
                order={editingOrder}
                onClose={() => setEditingOrder(null)}
                onSaved={(orderId, newItems, newTotal) => {
                    setOrders(prev => prev.map(o => o.id === orderId
                        ? { ...o, items: newItems, total: newTotal }
                        : o
                    ));
                    setEditingOrder(null);
                }}
            />
        )}
        </>
    );
}
