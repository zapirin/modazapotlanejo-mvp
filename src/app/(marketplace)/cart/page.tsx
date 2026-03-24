"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/lib/CartContext';
import { createOrder } from '@/app/actions/orders';
import { createCheckoutSession } from '@/app/actions/stripe';
import { getMarketplacePriceTiers, getProductImages } from '../actions';
import { calculateAutoDiscount } from '@/lib/discountUtils';
import { toast } from 'sonner';
import {
    getMyShippingAddresses,
    saveShippingAddress,
    deleteShippingAddress,
    quoteShipping,
} from '@/app/actions/shipping';
import type { ShippingRate } from '@/lib/skydropx';

const MEXICAN_STATES = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
    'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
    'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
    'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
    'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

export default function CartPage() {
    const { items, removeItem, updateQuantity, clearCart, getTotal, getItemsBySeller, getItemCount } = useCart();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notes, setNotes] = useState('');
    const [success, setSuccess] = useState(false);
    const [orderNumbers, setOrderNumbers] = useState<number[]>([]);
    const [sellerTiers, setSellerTiers] = useState<Map<string, any[]>>(new Map());
    const [freshImages, setFreshImages] = useState<Record<string, string>>({});

    // Shipping state
    const [addresses, setAddresses] = useState<any[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [pickupMode, setPickupMode] = useState(false); // Recoger en tienda del vendedor
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [addressForm, setAddressForm] = useState({
        name: '', phone: '', street: '', colonia: '', city: '', state: '', zip: '', label: 'Principal',
    });
    const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
    const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
    const [isLoadingRates, setIsLoadingRates] = useState(false);
    const [savingAddress, setSavingAddress] = useState(false);

    const sellerGroups = getItemsBySeller();

    // Cargar niveles de precio de cada vendedor en el carrito
    useEffect(() => {
        const loadTiers = async () => {
            const tierMap = new Map<string, any[]>();
            for (const [sellerId] of sellerGroups) {
                const tiers = await getMarketplacePriceTiers(sellerId);
                if (tiers.length > 0) tierMap.set(sellerId, tiers);
            }
            setSellerTiers(tierMap);
        };
        if (sellerGroups.size > 0) loadTiers();

        // Recargar imágenes frescas para items sin imagen (base64 no persiste en localStorage)
        const missingIds = [...new Set(items.filter(i => !i.image).map(i => i.productId))];
        if (missingIds.length > 0) {
            getProductImages(missingIds).then(setFreshImages);
        }
    }, [items]);

    // Cargar direcciones de envío
    useEffect(() => {
        getMyShippingAddresses().then(addrs => {
            setAddresses(addrs);
            const defaultAddr = addrs.find((a: any) => a.isDefault);
            if (defaultAddr) setSelectedAddressId(defaultAddr.id);
        });
    }, []);

    // Cotizar envío cuando cambie la dirección seleccionada
    useEffect(() => {
        if (!selectedAddressId || items.length === 0) {
            setShippingRates([]);
            setSelectedRate(null);
            return;
        }

        const fetchRates = async () => {
            setIsLoadingRates(true);
            setSelectedRate(null);
            // Usar el primer vendedor para cotizar (simplificación para MVP)
            const firstSellerId = Array.from(sellerGroups.keys())[0];
            if (!firstSellerId) return;

            const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
            // Paquete estimado basado en la cantidad de artículos
            const parcel = {
                weight: Math.max(1, totalQty * 0.3), // ~300g por artículo
                height: 15,
                width: 30,
                length: 40,
            };

            const result = await quoteShipping(firstSellerId, selectedAddressId, parcel);
            if (result.success) {
                setShippingRates(result.rates);
                // Auto-seleccionar la opción más barata
                if (result.rates.length > 0) {
                    const cheapest = result.rates.reduce((min, r) => r.totalPrice < min.totalPrice ? r : min, result.rates[0]);
                    setSelectedRate(cheapest);
                }
            } else {
                toast.error(result.error || 'No se pudieron obtener cotizaciones de envío.');
            }
            setIsLoadingRates(false);
        };

        fetchRates();
    }, [selectedAddressId, items.length]);

    const handleSaveAddress = async () => {
        if (!addressForm.name || !addressForm.phone || !addressForm.street ||
            !addressForm.colonia || !addressForm.city || !addressForm.state || !addressForm.zip) {
            toast.error('Completa todos los campos de la dirección.');
            return;
        }
        if (addressForm.zip.length !== 5) {
            toast.error('El código postal debe tener exactamente 5 dígitos.');
            return;
        }

        setSavingAddress(true);
        const result = await saveShippingAddress({
            ...addressForm,
            isDefault: addresses.length === 0,
        });

        if (result.success && result.address) {
            toast.success('Dirección guardada.');
            const updatedAddrs = await getMyShippingAddresses();
            setAddresses(updatedAddrs);
            setSelectedAddressId(result.address.id);
            setShowAddressForm(false);
            setAddressForm({ name: '', phone: '', street: '', colonia: '', city: '', state: '', zip: '', label: 'Principal' });
        } else {
            toast.error(result.error || 'Error al guardar la dirección.');
        }
        setSavingAddress(false);
    };

    const handleDeleteAddress = async (id: string) => {
        if (!confirm('¿Eliminar esta dirección?')) return;
        const result = await deleteShippingAddress(id);
        if (result.success) {
            const updatedAddrs = await getMyShippingAddresses();
            setAddresses(updatedAddrs);
            if (selectedAddressId === id) {
                setSelectedAddressId(updatedAddrs[0]?.id || '');
            }
            toast.success('Dirección eliminada.');
        }
    };

    // Calcular descuento para un grupo de vendedor
    // Los niveles de precio NO aplican si el grupo tiene items de mayoreo
    // (Corrida/Paquete/Caja ya tienen su propio precio con descuento incluido)
    const getGroupDiscount = (sellerId: string, group: any) => {
        const tiers = sellerTiers.get(sellerId);
        if (!tiers || tiers.length === 0) return null;

        // Separar items sueltos (menudeo) de corridas/paquetes (ya tienen precio mayoreo propio)
        const looseItems = group.items.filter((item: any) => !item.sellByPackage);
        const wholesaleItems = group.items.filter((item: any) => item.sellByPackage === true);

        // Si no hay items sueltos, no hay descuento por volumen que aplicar
        if (looseItems.length === 0) return null;

        // Calcular descuento solo sobre items sueltos
        const looseQty = looseItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const looseTotal = looseItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
        const wholesaleTotal = wholesaleItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

        const discountResult = calculateAutoDiscount(tiers, looseQty, looseTotal);
        if (!discountResult) return null;

        // Devolver resultado combinado: descuento aplicado solo a sueltos, total incluye corridas
        return {
            ...discountResult,
            originalTotal: discountResult.originalTotal + wholesaleTotal,
            finalTotal: discountResult.finalTotal + wholesaleTotal,
            looseQty,
            looseTotal,
        };
    };

    // Total con descuentos aplicados (sin envío)
    const getSubtotalWithDiscounts = () => {
        let total = 0;
        for (const [sellerId, group] of sellerGroups) {
            const discountResult = getGroupDiscount(sellerId, group);
            total += discountResult ? discountResult.finalTotal : group.total;
        }
        return total;
    };

    // Total final con envío
    const getTotalWithShipping = () => {
        return getSubtotalWithDiscounts() + (selectedRate?.totalPrice || 0);
    };

    const handleCheckout = async () => {
        setIsSubmitting(true);
        const loadingToast = toast.loading('Preparando tu pedido...');
        try {
            const orderIds: string[] = [];
            const allItems: any[] = [];

            for (const [sellerId, group] of sellerGroups) {
                const discountResult = getGroupDiscount(sellerId, group);
                const result = await createOrder({
                    sellerId,
                    items: group.items.map((item: any) => ({
                        variantId: item.variantId,
                        quantity: item.quantity,
                        price: item.price,
                        productName: item.productName,
                        color: item.color,
                        size: item.size,
                    })),
                    notes,
                    priceTierId: discountResult?.tier?.id || undefined,
                    discount: discountResult?.discount || 0,
                    status: 'PENDING_PAYMENT',
                    shippingAddressId: pickupMode ? undefined : (selectedAddressId || undefined),
                    notes: pickupMode ? '📍 RECOGER EN TIENDA DEL VENDEDOR' : undefined,
                    shippingCost: selectedRate?.totalPrice || 0,
                    skydropxRateId: selectedRate?.rateId || undefined,
                    skydropxQuotationId: selectedRate?.quotationId || undefined,
                });

                if (result.success && result.orderId) {
                    orderIds.push(result.orderId);
                    // Denormalize items for Stripe Checkout session display
                    group.items.forEach((item: any) => {
                        allItems.push({
                            productName: item.productName,
                            quantity: item.quantity,
                            price: item.price,
                            image: item.image,
                            size: item.size,
                            color: item.color,
                        });
                    });
                } else {
                    throw new Error(result.error || 'Error al crear uno de los pedidos.');
                }
            }

            // Iniciar sesión de pago en Stripe
            const stripeResult = await createCheckoutSession({
                orderIds,
                items: allItems,
                total: getTotalWithShipping(),
            });

            if (stripeResult.success && stripeResult.url) {
                toast.success('Pedido creado. Redirigiendo al pago...', { id: loadingToast });
                window.location.href = stripeResult.url;
            } else {
                throw new Error(stripeResult.error || 'No se pudo iniciar el pago.');
            }
        } catch (error: any) {
            toast.error(error.message || 'Hubo un error al procesar tu pedido.', { id: loadingToast });
            console.error(error);
        }
        setIsSubmitting(false);
    };

    if (success) {
        return (
            <div className="pt-32 pb-20 max-w-2xl mx-auto px-6 text-center">
                <div className="bg-card rounded-3xl border border-border shadow-xl p-12 space-y-6">
                    <span className="text-6xl block">🎉</span>
                    <h1 className="text-3xl font-black text-foreground">¡Pedido Enviado!</h1>
                    <p className="text-gray-500 font-medium">
                        {orderNumbers.length > 1
                            ? `Se crearon ${orderNumbers.length} pedidos (uno por cada vendedor).`
                            : 'Tu pedido ha sido enviado al vendedor.'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {orderNumbers.map(n => (
                            <span key={n} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full text-sm font-black">
                                Pedido #{n}
                            </span>
                        ))}
                    </div>
                    <p className="text-sm text-gray-400">
                        El vendedor revisará tu pedido y te contactará para coordinar el pago y envío.
                    </p>
                    <div className="flex gap-4 justify-center pt-4">
                        <Link href="/orders" className="px-8 py-4 bg-foreground text-background font-black rounded-xl hover:opacity-90 transition">
                            Ver Mis Pedidos
                        </Link>
                        <Link href="/catalog" className="px-8 py-4 bg-gray-100 dark:bg-gray-800 text-foreground font-bold rounded-xl hover:bg-gray-200 transition">
                            Seguir Comprando
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="pt-32 pb-20 max-w-2xl mx-auto px-6 text-center">
                <div className="bg-card rounded-3xl border border-border shadow-xl p-12 space-y-6">
                    <span className="text-6xl block">🛒</span>
                    <h1 className="text-3xl font-black text-foreground">Tu carrito está vacío</h1>
                    <p className="text-gray-500 font-medium">Explora el catálogo y agrega productos para realizar tu pedido.</p>
                    <Link href="/catalog" className="inline-block px-10 py-4 bg-foreground text-background font-black rounded-xl hover:opacity-90 transition">
                        Ir al Catálogo
                    </Link>
                </div>
            </div>
        );
    }

    const totalWithDiscounts = getSubtotalWithDiscounts();
    const originalTotal = getTotal();
    const totalSavings = originalTotal - totalWithDiscounts;

    return (
        <div className="pt-28 pb-20">
            <div className="max-w-5xl mx-auto px-6">
                <div className="mb-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <Link href="/catalog" className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest mb-3 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
                                Seguir comprando
                            </Link>
                            <h1 className="text-4xl font-black text-foreground tracking-tight">Mi Carrito</h1>
                            <p className="text-gray-500 font-medium mt-2">{getItemCount()} pieza{getItemCount() !== 1 ? 's' : ''} en tu carrito ({items.length} variante{items.length !== 1 ? 's' : ''})</p>
                        </div>
                        <button
                            onClick={() => { if (confirm('¿Vaciar todo el carrito?')) clearCart(); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            Vaciar carrito
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Cart Items */}
                    <div className="lg:col-span-2 space-y-6">
                        {Array.from(sellerGroups.entries()).map(([sellerId, group]) => {
                            const discountResult = getGroupDiscount(sellerId, group);
                            const tiers = sellerTiers.get(sellerId) || [];
                            // Contar solo piezas sueltas (no corridas) para el nivel de descuento
                            const looseItems = group.items.filter((item: any) => !item.sellByPackage);
                            const looseQty = looseItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
                            const totalQty = group.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

                            // Siguiente nivel basado en piezas sueltas
                            const nextTier = looseItems.length > 0 ? tiers
                                .filter((t: any) => t.autoApplyMarketplace && t.minQuantity > looseQty)
                                .sort((a: any, b: any) => a.minQuantity - b.minQuantity)[0] : null;

                            return (
                                <div key={sellerId} className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-border bg-gray-50/50 dark:bg-gray-800/50">
                                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                                            Vendedor: <span className="text-blue-600">{group.sellerName}</span>
                                        </p>
                                    </div>

                                    {/* Banner de descuento activo */}
                                    {discountResult && (
                                        <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                                            <span className="text-emerald-600 text-lg">🎉</span>
                                            <div>
                                                <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                                                    {discountResult.tier.name} aplicado en piezas sueltas
                                                </p>
                                                <p className="text-[10px] text-emerald-600 font-bold">
                                                    Ahorro: ${discountResult.discount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                    {discountResult.tier.discountPercentage ? ` (-${discountResult.tier.discountPercentage}%)` : ''}
                                                    {' '}· Las corridas/paquetes mantienen su precio propio
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Banner para alcanzar el siguiente nivel — aplica a piezas sueltas */}
                                    {!discountResult && nextTier && looseItems.length > 0 && (
                                        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
                                            <span className="text-blue-500 text-lg">💡</span>
                                            <p className="text-xs font-bold text-blue-600">
                                                Agrega {nextTier.minQuantity - looseQty} pieza{nextTier.minQuantity - looseQty > 1 ? 's' : ''} sueltas más para obtener{' '}
                                                <span className="font-black">
                                                    {nextTier.discountPercentage ? `-${nextTier.discountPercentage}%` : `-$${nextTier.defaultPriceMinusFixed}/pz`}
                                                </span>{' '}de descuento en piezas sueltas ({nextTier.name})
                                            </p>
                                        </div>
                                    )}

                                    <div className="divide-y divide-border">
                                        {group.items.map((item: any) => (
                                            <div key={item.variantId} className="p-6 flex gap-4 items-start">
                                                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden flex-shrink-0">
                                                    {(item.image || freshImages[item.productId]) ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={item.image || freshImages[item.productId]}
                                                            alt={item.productName} width={80} height={80}
                                                            className="w-full h-full object-cover" suppressHydrationWarning />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-2xl">👕</div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-sm text-foreground truncate">{item.productName}</h3>
                                                    <p className="text-xs text-gray-500 font-medium mt-0.5">{item.color} / {item.size}</p>
                                                    <div className="flex items-baseline gap-2 mt-1">
                                                        {(() => {
                                                            const dr = getGroupDiscount(sellerId, group);
                                                            // Items de corrida/paquete: siempre muestran su precio propio sin descuento
                                                            if (!dr || item.sellByPackage) {
                                                                return <p className="text-blue-600 font-black text-lg">${item.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>;
                                                            }
                                                            // Descuento dividido solo entre piezas sueltas
                                                            const looseQtyLocal = group.items
                                                                .filter((i: any) => !i.sellByPackage)
                                                                .reduce((s: number, i: any) => s + i.quantity, 0);
                                                            const unitDiscount = looseQtyLocal > 0 ? dr.discount / looseQtyLocal : 0;
                                                            const discountedUnit = Math.max(0, item.price - unitDiscount);
                                                            return (
                                                                <>
                                                                    <p className="text-emerald-600 font-black text-lg">${discountedUnit.toFixed(2)}</p>
                                                                    <p className="text-gray-400 font-bold text-sm line-through">${item.price.toFixed(2)}</p>
                                                                </>
                                                            );
                                                        })()}
                                                        <span className="text-[9px] text-gray-400 font-bold">c/u</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                                            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition font-bold">−</button>
                                                        <span className="w-10 text-center font-black text-foreground">{item.quantity}</span>
                                                        <button onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                                            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition font-bold">+</button>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeItem(item.variantId)}
                                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="px-6 py-4 border-t border-border bg-gray-50/50 dark:bg-gray-800/50 space-y-1">
                                        {discountResult ? (
                                            <>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-400 line-through font-medium">Subtotal</span>
                                                    <span className="text-gray-400 line-through">${group.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Total con descuento</span>
                                                    <span className="text-lg font-black text-emerald-600">${discountResult.finalTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Subtotal</span>
                                                <span className="text-lg font-black text-foreground">${group.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Order Summary + Shipping */}
                    <div className="lg:col-span-1">
                        <div className="bg-card rounded-3xl border border-border shadow-sm p-6 space-y-5 sticky top-28">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Resumen del Pedido</h3>

                            <div className="space-y-2">
                                {Array.from(sellerGroups.entries()).map(([sellerId, group]) => {
                                    const discountResult = getGroupDiscount(sellerId, group);
                                    return (
                                        <div key={sellerId} className="flex justify-between text-sm">
                                            <span className="text-gray-500 font-medium truncate mr-4">{group.sellerName}</span>
                                            <span className="font-bold text-foreground">
                                                ${(discountResult ? discountResult.finalTotal : group.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {totalSavings > 0 && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                    <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Ahorro total por descuentos</p>
                                    <p className="text-lg font-black text-emerald-600">-${totalSavings.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                </div>
                            )}

                            {/* ── DIRECCIÓN DE ENVÍO / RECOGER ── */}
                            <div className="border-t border-border pt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">📦 Dirección de Envío</h4>
                                </div>

                                {/* Toggle Recoger en Tienda */}
                                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${pickupMode ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-border hover:border-emerald-300'}`}>
                                    <input type="checkbox" checked={pickupMode} onChange={e => setPickupMode(e.target.checked)}
                                        className="w-4 h-4 accent-emerald-600 rounded" />
                                    <div>
                                        <p className="text-sm font-black text-foreground">🏪 Recoger en tienda del vendedor</p>
                                        <p className="text-[10px] text-gray-500 font-medium">Sin costo de envío — coordina con el vendedor</p>
                                    </div>
                                </label>

                                {!pickupMode && <>

                                {addresses.length > 0 ? (
                                    <div className="space-y-2">
                                        {addresses.map((addr: any) => (
                                            <label
                                                key={addr.id}
                                                className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                                                    selectedAddressId === addr.id
                                                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                                                        : 'border-border hover:border-gray-300 dark:hover:border-gray-600'
                                                }`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <input
                                                        type="radio"
                                                        name="shippingAddress"
                                                        value={addr.id}
                                                        checked={selectedAddressId === addr.id}
                                                        onChange={() => setSelectedAddressId(addr.id)}
                                                        className="mt-1 accent-blue-600"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-foreground">{addr.label}</span>
                                                            {addr.isDefault && (
                                                                <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">DEFAULT</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">{addr.name} · {addr.phone}</p>
                                                        <p className="text-[10px] text-gray-400 truncate">{addr.street}, {addr.colonia}, {addr.city}, {addr.state} {addr.zip}</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); handleDeleteAddress(addr.id); }}
                                                        className="text-gray-300 hover:text-red-400 transition-colors p-0.5"
                                                        title="Eliminar"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                                    </button>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                ) : !showAddressForm ? (
                                    <p className="text-xs text-gray-400 italic">No tienes direcciones guardadas.</p>
                                ) : null}

                                {!showAddressForm ? (
                                    <button
                                        onClick={() => setShowAddressForm(true)}
                                        className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-all"
                                    >
                                        + Agregar nueva dirección
                                    </button>
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-2.5 border border-border">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                placeholder="Nombre destinatario *"
                                                value={addressForm.name}
                                                onChange={e => setAddressForm(f => ({ ...f, name: e.target.value }))}
                                                className="col-span-2 px-3 py-2 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <input
                                                placeholder="Teléfono *"
                                                value={addressForm.phone}
                                                onChange={e => setAddressForm(f => ({ ...f, phone: e.target.value }))}
                                                className="px-3 py-2 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <input
                                                placeholder="Etiqueta"
                                                value={addressForm.label}
                                                onChange={e => setAddressForm(f => ({ ...f, label: e.target.value }))}
                                                className="px-3 py-2 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <input
                                                placeholder="Calle y número *"
                                                value={addressForm.street}
                                                onChange={e => setAddressForm(f => ({ ...f, street: e.target.value }))}
                                                className="col-span-2 px-3 py-2 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <input
                                                placeholder="Colonia *"
                                                value={addressForm.colonia}
                                                onChange={e => setAddressForm(f => ({ ...f, colonia: e.target.value }))}
                                                className="px-3 py-2 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <input
                                                placeholder="Ciudad *"
                                                value={addressForm.city}
                                                onChange={e => setAddressForm(f => ({ ...f, city: e.target.value }))}
                                                className="px-3 py-2 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <select
                                                value={addressForm.state}
                                                onChange={e => setAddressForm(f => ({ ...f, state: e.target.value }))}
                                                className="px-3 py-2 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="">Estado *</option>
                                                {MEXICAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <input
                                                placeholder="C.P. *"
                                                maxLength={5}
                                                value={addressForm.zip}
                                                onChange={e => setAddressForm(f => ({ ...f, zip: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                                                className="px-3 py-2 bg-white dark:bg-gray-900 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setShowAddressForm(false); setAddressForm({ name: '', phone: '', street: '', colonia: '', city: '', state: '', zip: '', label: 'Principal' }); }}
                                                className="flex-1 py-2 text-xs font-bold text-gray-500 border border-border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleSaveAddress}
                                                disabled={savingAddress}
                                                className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                            >
                                                {savingAddress ? 'Guardando...' : 'Guardar'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                </>
                                }
                            </div>

                            {/* ── OPCIONES DE ENVÍO — ocultar si va a recoger ── */}
                            {!pickupMode && <>
                            {selectedAddressId && (
                                <div className="border-t border-border pt-4 space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">🚚 Paquetería</h4>

                                    {isLoadingRates ? (
                                        <div className="flex items-center gap-2 py-3">
                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs text-gray-500 font-medium">Cotizando envíos...</span>
                                        </div>
                                    ) : shippingRates.length > 0 ? (
                                        <div className="space-y-2">
                                            {shippingRates.sort((a, b) => a.totalPrice - b.totalPrice).map(rate => (
                                                <label
                                                    key={rate.rateId}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                        selectedRate?.rateId === rate.rateId
                                                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                                                            : 'border-border hover:border-gray-300 dark:hover:border-gray-600'
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="shippingRate"
                                                        value={rate.rateId}
                                                        checked={selectedRate?.rateId === rate.rateId}
                                                        onChange={() => setSelectedRate(rate)}
                                                        className="accent-blue-600"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-foreground">{rate.carrier}</p>
                                                        <p className="text-[10px] text-gray-400 font-medium">{rate.serviceName} · ~{rate.estimatedDays} día{rate.estimatedDays > 1 ? 's' : ''}</p>
                                                    </div>
                                                    <span className="text-sm font-black text-blue-600 whitespace-nowrap">
                                                        ${rate.totalPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Selecciona una dirección para ver opciones de envío.</p>
                                    )}
                                </div>
                            )}

                            </>
                            }

                            {/* ── TOTALES ── */}
                            <div className="border-t border-border pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 font-medium">Subtotal</span>
                                    <span className="font-bold text-foreground">${totalWithDiscounts.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {selectedRate && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 font-medium">Envío ({selectedRate.carrier})</span>
                                        <span className="font-bold text-foreground">${selectedRate.totalPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-2">
                                    <span className="font-black text-foreground uppercase tracking-tight">Total</span>
                                    <span className="text-2xl font-black text-blue-600">${getTotalWithShipping().toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Notas para el vendedor (opcional)</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Ej: Comunicarme si no hay todo disponible, o prefiero recoger en tienda..."
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-xl text-sm font-medium resize-none h-20 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>

                            <button
                                onClick={handleCheckout}
                                disabled={isSubmitting || (!pickupMode && (!selectedAddressId || !selectedRate))}
                                className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl ${
                                    isSubmitting || (!pickupMode && (!selectedAddressId || !selectedRate))
                                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500'
                                        : pickupMode
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-[1.02] shadow-emerald-500/20'
                                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-[1.02] shadow-blue-500/20'
                                }`}
                            >
                                {isSubmitting ? 'Procesando...' : pickupMode
                                    ? `Confirmar Pedido — Recoger en Tienda`
                                    : !selectedAddressId ? 'Agrega una dirección o selecciona Recoger en Tienda'
                                    : !selectedRate ? 'Selecciona paquetería'
                                    : `Pagar $\${getTotalWithShipping().toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                            </button>

                            <p className="text-[10px] text-center text-gray-400 font-medium leading-relaxed">
                                Tu pedido será procesado y el vendedor preparará tu envío con la paquetería seleccionada.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
