"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBuyerOrders, releasePayment } from '@/app/actions/escrow';
import { toast } from 'sonner';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    PENDING:         { label: 'Pendiente',           color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
    PENDING_PAYMENT: { label: 'Esperando pago',      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
    PAID:            { label: 'Pagado · En proceso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
    SHIPPED:         { label: 'Enviado',             color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
    COMPLETED:       { label: 'Entregado',           color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
    CANCELLED:       { label: 'Cancelado',           color: 'bg-gray-100 text-gray-500' },
    REFUNDED:        { label: 'Reembolsado',         color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' },
};

export default function BuyerOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [releasing, setReleasing] = useState<string | null>(null);

    useEffect(() => { loadOrders(); }, []);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const res = await getBuyerOrders();
            if (res.success) setOrders(res.data);
        } catch (error) {
            console.error('Error loading orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDelivery = async (orderId: string, orderNumber: number) => {
        if (!confirm(`¿Confirmas que recibiste el pedido #${orderNumber} completo y en buen estado?\n\nEsto liberará el pago al vendedor y no podrá revertirse.`)) return;
        setReleasing(orderId);
        const res = await releasePayment(orderId);
        if (res.success) {
            toast.success('¡Gracias! El pago fue liberado al vendedor.');
            loadOrders();
        } else {
            toast.error(res.error || 'Error al confirmar');
        }
        setReleasing(null);
    };

    if (loading) return (
        <div className="pt-32 flex justify-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="pt-28 pb-20 max-w-4xl mx-auto px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-black tracking-tight">Mis Pedidos</h1>
                <p className="text-gray-500 mt-1 font-medium">Historial de tus compras y estado de entrega</p>
            </div>

            {orders.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                    <span className="text-6xl">📦</span>
                    <p className="text-xl font-black">Aún no tienes pedidos</p>
                    <Link href="/catalog" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-full text-sm font-black hover:bg-blue-700 transition">
                        Explorar catálogo
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {orders.map((order: any) => {
                        const statusInfo = STATUS_LABEL[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-500' };
                        const canConfirm = order.status === 'PAID' || order.status === 'SHIPPED';
                        const sellerName = order.seller?.businessName || order.seller?.name || 'Vendedor';

                        return (
                            <div key={order.id} className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <p className="font-black text-sm">Pedido #{order.orderNumber}</p>
                                            <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-lg">${order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</p>
                                        <p className="text-xs text-gray-400">{sellerName}</p>
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="px-6 py-4 space-y-3">
                                    {order.items.map((item: any) => {
                                        const product = item.variant?.product;
                                        const image = Array.isArray(product?.images) ? product.images[0] : null;
                                        return (
                                            <div key={item.id} className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                                                    {image ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={image} alt={product?.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-2xl">👕</div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm truncate">{item.productName || product?.name}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {[item.color, item.size].filter(Boolean).join(' · ')} · x{item.quantity}
                                                    </p>
                                                </div>
                                                <p className="font-black text-sm shrink-0">${(item.price * item.quantity).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Shipment info */}
                                {order.shipment?.trackingNumber && (
                                    <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/10 border-t border-border flex items-center gap-3">
                                        <span className="text-lg">🚚</span>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">En camino</p>
                                            <p className="text-xs text-gray-500">Guía: <span className="font-bold">{order.shipment.trackingNumber}</span></p>
                                        </div>
                                    </div>
                                )}

                                {/* Confirm delivery */}
                                {canConfirm && !order.paymentReleasedAt && (
                                    <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/10 border-t border-border">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div>
                                                <p className="font-black text-sm text-amber-800 dark:text-amber-300">¿Ya recibiste tu pedido?</p>
                                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                                    Confirma la entrega para liberar el pago al vendedor. Si hay algún problema, contacta al soporte antes de confirmar.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleConfirmDelivery(order.id, order.orderNumber)}
                                                disabled={releasing === order.id}
                                                className="shrink-0 px-6 py-2.5 bg-emerald-600 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {releasing === order.id ? (
                                                    <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando...</>
                                                ) : (
                                                    '✅ Confirmar entrega'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {order.paymentReleasedAt && (
                                    <div className="px-6 py-3 border-t border-border">
                                        <p className="text-xs text-emerald-600 font-bold">✅ Entrega confirmada el {new Date(order.paymentReleasedAt).toLocaleDateString('es-MX')}</p>
                                    </div>
                                )}

                                {order.refundedAt && (
                                    <div className="px-6 py-3 border-t border-border">
                                        <p className="text-xs text-rose-600 font-bold">💸 Reembolso procesado el {new Date(order.refundedAt).toLocaleDateString('es-MX')}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
