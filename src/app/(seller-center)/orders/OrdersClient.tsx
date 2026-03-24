"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateOrderStatus, deleteOrder } from "@/app/actions/orders";
import Link from "next/link";

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

export default function OrdersClient({ orders: initial, isBuyer, isSeller }: {
    orders: any[];
    isBuyer: boolean;
    isSeller: boolean;
}) {
    const [orders, setOrders]       = useState(initial);
    const [activeTab, setActiveTab] = useState("active");
    const [processing, setProcessing] = useState<string | null>(null);
    const [showNotes, setShowNotes]   = useState<string | null>(null);
    const [notes, setNotes]           = useState<Record<string, string>>({});

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
                            <div className="p-6 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Pedido #{order.orderNumber}</p>
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
                                </div>
                            </div>

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
                                            </div>
                                        ))}
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
                                        {order.shippingAddress && (
                                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-0.5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">📦 Envío</p>
                                                <p className="text-xs font-bold text-foreground">{order.shippingAddress.name} · {order.shippingAddress.phone}</p>
                                                <p className="text-[11px] text-gray-500">{order.shippingAddress.street}, {order.shippingAddress.colonia}, {order.shippingAddress.city}, {order.shippingAddress.state}</p>
                                            </div>
                                        )}
                                        {order.shipment?.trackingNumber && (
                                            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">🚚 Guía de envío</p>
                                                <p className="text-sm font-bold text-foreground">{order.shipment.trackingNumber}</p>
                                                {order.shipment.carrier && <p className="text-xs text-gray-500">{order.shipment.carrier}</p>}
                                            </div>
                                        )}

                                        {/* ── ACCIONES VENDEDOR ── */}
                                        {isSeller && (
                                            <div className="space-y-2 pt-1">
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
