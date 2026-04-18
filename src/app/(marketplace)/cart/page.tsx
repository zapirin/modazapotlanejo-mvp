"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/lib/CartContext';
import { createOrder } from '@/app/actions/orders';
import { createCheckoutSession } from '@/app/actions/stripe';
import { getMarketplacePriceTiers, getProductImages, getSellerTransferSettings } from '../actions';
import { calculateAutoDiscount } from '@/lib/discountUtils';
import { validateCoupon, incrementCouponUsage } from '@/app/actions/coupons';
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
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | 'transfer'>('stripe');
    const [isKalexa, setIsKalexa] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    // Cupones: { [sellerId]: { code, couponId, discountType, discountValue, discountAmount } }
    const [appliedCoupons, setAppliedCoupons] = useState<Map<string, any>>(new Map());
    const [couponInputs, setCouponInputs] = useState<Record<string, string>>({});
    const [couponLoading, setCouponLoading] = useState<Record<string, boolean>>({});
    const [couponErrors, setCouponErrors] = useState<Record<string, string>>({});

    // Detect if we're on kalexafashion.com
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hostname.includes('kalexa')) {
            setIsKalexa(true);
            setPaymentMethod('paypal'); // Default to PayPal for Kalexa
        }
    }, []);

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

    // Transferencia bancaria del vendedor
    const [sellerTransfer, setSellerTransfer] = useState<{
        acceptsTransfer: boolean;
        transferBank?: string;
        transferAccountHolder?: string;
        transferCLABE?: string;
        transferAccountNumber?: string;
        transferInstructions?: string;
    }>({ acceptsTransfer: false });

    const sellerGroups = getItemsBySeller();

    // Cargar niveles de precio de cada vendedor en el carrito
    useEffect(() => {
        const loadTiers = async () => {
            const groups = getItemsBySeller();
            if (groups.size === 0) return;
            const tierMap = new Map<string, any[]>();
            for (const [sellerId] of groups) {
                const tiers = await getMarketplacePriceTiers(sellerId);
                if (tiers.length > 0) tierMap.set(sellerId, tiers);
            }
            setSellerTiers(tierMap);
        };
        loadTiers();

        // Cargar datos de transferencia del primer vendedor
        const firstId = Array.from(getItemsBySeller().keys())[0];
        if (firstId) {
            getSellerTransferSettings(firstId).then(data => {
                setSellerTransfer(data);
                // Si el vendedor solo acepta transferencia (no Stripe), seleccionarla por defecto
                if (data.acceptsTransfer && !isKalexa) {
                    setPaymentMethod(prev => prev === 'stripe' ? 'transfer' : prev);
                }
            });
        }

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
            // Peso estimado: 1 kg por prenda (cubre pantalones hasta 0.8 kg)
            // + 0.5 kg fijo de empaque. Se sobreestima intencionalmente para
            // evitar cargos por sobrepeso de Skydropx.
            const parcel = {
                weight: Math.round((totalQty * 1.0 + 0.5) * 10) / 10,
                height: 20,
                width:  40,
                length: 50,
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

    // Aplica el cupón para un vendedor
    const handleApplyCoupon = async (sellerId: string, groupTotal: number) => {
        const code = (couponInputs[sellerId] || '').trim();
        if (!code) return;
        setCouponLoading(prev => ({ ...prev, [sellerId]: true }));
        setCouponErrors(prev => ({ ...prev, [sellerId]: '' }));
        const result = await validateCoupon(code, sellerId, groupTotal);
        setCouponLoading(prev => ({ ...prev, [sellerId]: false }));
        if (result.error) {
            setCouponErrors(prev => ({ ...prev, [sellerId]: result.error! }));
            return;
        }
        setAppliedCoupons(prev => {
            const next = new Map(prev);
            next.set(sellerId, result.coupon);
            return next;
        });
        toast.success(`Cupón ${result.coupon!.code} aplicado ✓`);
    };

    const handleRemoveCoupon = (sellerId: string) => {
        setAppliedCoupons(prev => { const next = new Map(prev); next.delete(sellerId); return next; });
        setCouponInputs(prev => ({ ...prev, [sellerId]: '' }));
        setCouponErrors(prev => ({ ...prev, [sellerId]: '' }));
    };

    // Total con descuentos de volumen aplicados (sin envío, sin cupones)
    const getSubtotalWithDiscounts = () => {
        let total = 0;
        for (const [sellerId, group] of sellerGroups) {
            const discountResult = getGroupDiscount(sellerId, group);
            total += discountResult ? discountResult.finalTotal : group.total;
        }
        return total;
    };

    // Total con descuentos de volumen + cupones aplicados (sin envío)
    const getSubtotalWithAll = () => {
        let total = 0;
        for (const [sellerId, group] of sellerGroups) {
            const discountResult = getGroupDiscount(sellerId, group);
            const volumeTotal = discountResult ? discountResult.finalTotal : group.total;
            const coupon = appliedCoupons.get(sellerId);
            const couponDiscount = coupon ? coupon.discountAmount : 0;
            total += Math.max(0, volumeTotal - couponDiscount);
        }
        return total;
    };

    const hasFreeShippingCoupon = Array.from(appliedCoupons.values()).some((c: any) => c.freeShipping);
    const totalCouponSavings = Array.from(appliedCoupons.values()).reduce((s, c: any) => {
        if (c.freeShipping) return s + (selectedRate?.totalPrice || 0);
        return s + c.discountAmount;
    }, 0);

    // Total final con envío
    const getTotalWithShipping = () => {
        const shipping = (!pickupMode && selectedRate && !hasFreeShippingCoupon) ? selectedRate.totalPrice : 0;
        return getSubtotalWithAll() + shipping;
    };

    const handleCheckout = async () => {
        setIsSubmitting(true);
        const loadingToast = toast.loading('Preparando tu pedido...');
        try {
            const orderIds: string[] = [];
            const realOrderNumbers: number[] = [];
            const allItems: any[] = [];

            for (const [sellerId, group] of sellerGroups) {
                const discountResult = getGroupDiscount(sellerId, group);
                const coupon = appliedCoupons.get(sellerId);
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
                    notes: pickupMode ? '📍 RECOGER EN TIENDA DEL VENDEDOR' : (notes || undefined),
                    priceTierId: discountResult?.tier?.id || undefined,
                    discount: (discountResult?.discount || 0) + (coupon?.discountAmount || 0),
                    status: 'PENDING_PAYMENT',
                    shippingAddressId: pickupMode ? undefined : (selectedAddressId || undefined),
                    shippingCost: (pickupMode || hasFreeShippingCoupon) ? 0 : (selectedRate?.totalPrice || 0),
                    skydropxRateId: pickupMode ? undefined : (selectedRate?.rateId || undefined),
                    skydropxQuotationId: pickupMode ? undefined : (selectedRate?.quotationId || undefined),
                    shippingCarrier: pickupMode ? undefined : (selectedRate?.carrier || undefined),
                    shippingServiceName: pickupMode ? undefined : (selectedRate?.serviceName || undefined),
                    paymentMethod: isKalexa
                        ? (paymentMethod === 'paypal' ? 'Tarjeta de Débito/Crédito' : 'Depósito/Transferencia')
                        : (paymentMethod === 'transfer' ? 'Depósito/Transferencia' : undefined),
                    domain: typeof window !== 'undefined' ? window.location.hostname : undefined,
                });

                if (result.success && result.orderId) {
                    orderIds.push(result.orderId);
                    if (result.orderNumber) realOrderNumbers.push(result.orderNumber);
                    // Incrementar uso del cupón si se aplicó
                    if (coupon?.id) await incrementCouponUsage(coupon.id);
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

            // Kalexa domain: PayPal or Transfer flows
            if (isKalexa) {
                if (paymentMethod === 'paypal') {
                    toast.success('Pedido creado. Te contactaremos por WhatsApp para coordinar el pago por PayPal.', { id: loadingToast });
                } else {
                    toast.success('Pedido creado. Revisa los datos de transferencia en pantalla.', { id: loadingToast });
                }
                clearCart();
                setSuccess(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
                setOrderNumbers(realOrderNumbers);
                return;
            }

            // Transferencia bancaria para vendedores normales
            if (paymentMethod === 'transfer') {
                toast.success('Pedido creado. Realiza tu transferencia con los datos indicados.', { id: loadingToast });
                clearCart();
                setSuccess(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
                setOrderNumbers(realOrderNumbers);
                return;
            }

            // Agregar envío como línea en Stripe si aplica
            const shippingLinePrice = (pickupMode || hasFreeShippingCoupon) ? 0 : (selectedRate?.totalPrice || 0);
            if (shippingLinePrice > 0) {
                allItems.push({
                    productName: `Envío — ${selectedRate?.carrier || 'Paquetería'} (${selectedRate?.serviceName || ''})`.replace(/\(\)$/, '').trim(),
                    quantity: 1,
                    price: shippingLinePrice,
                });
            }

            // Default: Stripe Checkout
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
        const showTransferDetails = paymentMethod === 'transfer' && sellerTransfer.acceptsTransfer;
        return (
            <div className="pt-32 pb-20 max-w-2xl mx-auto px-6 text-center">
                <div className="bg-card rounded-3xl border border-border shadow-xl p-12 space-y-6">
                    <span className="text-6xl block">{showTransferDetails ? '🏦' : '🎉'}</span>
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

                    {/* Datos bancarios para transferencia */}
                    {showTransferDetails && (
                        <div className="text-left bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 space-y-4">
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 text-center">
                                Realiza tu transferencia o depósito a:
                            </p>
                            <div className="grid grid-cols-1 gap-3">
                                {sellerTransfer.transferBank && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase tracking-wider text-gray-400">Banco</span>
                                        <span className="text-sm font-black text-foreground">{sellerTransfer.transferBank}</span>
                                    </div>
                                )}
                                {sellerTransfer.transferAccountHolder && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase tracking-wider text-gray-400">Titular</span>
                                        <span className="text-sm font-bold text-foreground">{sellerTransfer.transferAccountHolder}</span>
                                    </div>
                                )}
                                {sellerTransfer.transferCLABE && (
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-xs font-black uppercase tracking-wider text-gray-400 shrink-0">CLABE</span>
                                        <span className="text-sm font-black text-foreground tracking-widest font-mono select-all">{sellerTransfer.transferCLABE}</span>
                                    </div>
                                )}
                                {sellerTransfer.transferAccountNumber && (
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="text-xs font-black uppercase tracking-wider text-gray-400 shrink-0">No. Cuenta</span>
                                        <span className="text-sm font-black text-foreground tracking-widest font-mono select-all">{sellerTransfer.transferAccountNumber}</span>
                                    </div>
                                )}
                            </div>
                            {sellerTransfer.transferInstructions && (
                                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium border-t border-emerald-200 dark:border-emerald-700 pt-3 mt-2">
                                    {sellerTransfer.transferInstructions}
                                </p>
                            )}
                            <p className="text-[10px] text-gray-400 text-center">
                                Guarda una captura de tu comprobante. El vendedor confirmará el pedido al recibir el pago.
                            </p>
                        </div>
                    )}

                    {!showTransferDetails && (
                        <p className="text-sm text-gray-400">
                            El vendedor revisará tu pedido y te contactará para coordinar el pago y envío.
                        </p>
                    )}

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
                        {confirmClear ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-red-600 uppercase tracking-widest">¿Vaciar carrito?</span>
                                <button
                                    onClick={() => { clearCart(); setConfirmClear(false); }}
                                    className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                                >
                                    Sí, vaciar
                                </button>
                                <button
                                    onClick={() => setConfirmClear(false)}
                                    className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                        <button
                            onClick={() => setConfirmClear(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            Vaciar carrito
                        </button>
                        )}
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

                                    <div className="px-6 py-4 border-t border-border bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
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

                                        {/* ── CAMPO DE CUPÓN ── */}
                                        {(() => {
                                            const applied = appliedCoupons.get(sellerId);
                                            const volumeTotal = discountResult ? discountResult.finalTotal : group.total;
                                            return applied ? (
                                                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                                                    <div>
                                                        <p className="text-xs font-black text-green-700 dark:text-green-300 font-mono tracking-wider">{applied.code}</p>
                                                        <p className="text-[10px] text-green-600 font-bold">
                                                            -{applied.discountType === 'PERCENTAGE' ? `${applied.discountValue}%` : `$${applied.discountValue.toFixed(2)}`}
                                                            {' '}= -${applied.discountAmount.toFixed(2)}
                                                        </p>
                                                    </div>
                                                    <button onClick={() => handleRemoveCoupon(sellerId)} className="text-green-400 hover:text-red-500 transition-colors text-xs font-bold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">✕ Quitar</button>
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">🏷️ {isKalexa ? 'Cupón de descuento' : `Cupón de ${group.sellerName}`}</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={couponInputs[sellerId] || ''}
                                                            onChange={e => setCouponInputs(p => ({ ...p, [sellerId]: e.target.value.toUpperCase() }))}
                                                            onKeyDown={e => e.key === 'Enter' && handleApplyCoupon(sellerId, volumeTotal)}
                                                            placeholder="Código"
                                                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono font-black text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        <button
                                                            onClick={() => handleApplyCoupon(sellerId, volumeTotal)}
                                                            disabled={couponLoading[sellerId]}
                                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black hover:bg-blue-700 transition disabled:opacity-60 whitespace-nowrap"
                                                        >
                                                            {couponLoading[sellerId] ? '...' : 'Aplicar'}
                                                        </button>
                                                    </div>
                                                    {couponErrors[sellerId] && (
                                                        <p className="text-[10px] text-red-500 font-bold">⚠️ {couponErrors[sellerId]}</p>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Total del grupo tras cupón */}
                                        {appliedCoupons.has(sellerId) && (() => {
                                            const volumeTotal = discountResult ? discountResult.finalTotal : group.total;
                                            const coupon = appliedCoupons.get(sellerId)!;
                                            const groupFinal = Math.max(0, volumeTotal - coupon.discountAmount);
                                            return (
                                                <div className="flex justify-between items-center pt-1 border-t border-green-200 dark:border-green-800">
                                                    <span className="text-xs font-black uppercase tracking-widest text-green-700 dark:text-green-300">Total con cupón</span>
                                                    <span className="text-xl font-black text-green-600">${groupFinal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            );
                                        })()}
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
                                    const coupon = appliedCoupons.get(sellerId);
                                    const volumeTotal = discountResult ? discountResult.finalTotal : group.total;
                                    const groupFinal = coupon ? Math.max(0, volumeTotal - coupon.discountAmount) : volumeTotal;
                                    return (
                                        <div key={sellerId} className="flex justify-between text-sm">
                                            <span className="text-gray-500 font-medium truncate mr-4">{group.sellerName}</span>
                                            <span className="font-bold text-foreground">${groupFinal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {totalSavings > 0 && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                    <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Ahorro por descuentos de volumen</p>
                                    <p className="text-lg font-black text-emerald-600">-${totalSavings.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                </div>
                            )}
                            {totalCouponSavings > 0 && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800">
                                    <p className="text-[10px] font-black text-green-700 dark:text-green-300 uppercase tracking-wider">🏷️ Ahorro por cupones</p>
                                    <p className="text-lg font-black text-green-600">-${totalCouponSavings.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
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
                                    <span className="font-bold text-foreground">${getSubtotalWithAll().toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {selectedRate && !pickupMode && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 font-medium">Envío ({selectedRate.carrier})</span>
                                        {hasFreeShippingCoupon ? (
                                            <span className="font-bold flex items-center gap-2">
                                                <span className="line-through text-gray-400">${selectedRate.totalPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                                <span className="text-emerald-600">$0.00 🚚</span>
                                            </span>
                                        ) : (
                                            <span className="font-bold text-foreground">${selectedRate.totalPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                        )}
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

                            {/* Payment Method Selector (Kalexa) */}
                            {isKalexa && (
                                <div className="border-t border-border pt-4 space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">💳 Método de Pago</h4>
                                    <div className="space-y-2">
                                        <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'paypal' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-border hover:border-blue-300'}`}>
                                            <input type="radio" name="paymentMethod" value="paypal" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod('paypal')} className="accent-blue-600" />
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-foreground">💳 Tarjeta de Débito/Crédito</p>
                                                <p className="text-[10px] text-gray-500 font-medium">Visa, Mastercard, American Express</p>
                                            </div>
                                        </label>
                                        <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'transfer' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-border hover:border-emerald-300'}`}>
                                            <input type="radio" name="paymentMethod" value="transfer" checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} className="accent-emerald-600" />
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-foreground">🏦 Depósito / Transferencia</p>
                                                <p className="text-[10px] text-gray-500 font-medium">Te enviaremos los datos por WhatsApp</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Payment Method Selector (vendedores normales con transferencia activa) */}
                            {!isKalexa && sellerTransfer.acceptsTransfer && (
                                <div className="border-t border-border pt-4 space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">💳 Método de Pago</h4>
                                    <div className="space-y-2">
                                        <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'stripe' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-border hover:border-blue-300'}`}>
                                            <input type="radio" name="paymentMethod" value="stripe" checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')} className="accent-blue-600" />
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-foreground">💳 Tarjeta de Débito/Crédito</p>
                                                <p className="text-[10px] text-gray-500 font-medium">Visa, Mastercard — pago inmediato</p>
                                            </div>
                                        </label>
                                        <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'transfer' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-border hover:border-emerald-300'}`}>
                                            <input type="radio" name="paymentMethod" value="transfer" checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} className="accent-emerald-600" />
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-foreground">🏦 Depósito / Transferencia SPEI</p>
                                                <p className="text-[10px] text-gray-500 font-medium">Los datos bancarios aparecen al confirmar</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleCheckout}
                                disabled={isSubmitting || (!pickupMode && (!selectedAddressId || !selectedRate))}
                                className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl ${
                                    isSubmitting || (!pickupMode && (!selectedAddressId || !selectedRate))
                                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500'
                                        : isKalexa
                                            ? 'text-white hover:scale-[1.02]'
                                            : pickupMode
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-[1.02] shadow-emerald-500/20'
                                                : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-[1.02] shadow-blue-500/20'
                                }`}
                                style={isKalexa && !(isSubmitting || (!pickupMode && (!selectedAddressId || !selectedRate))) ? {backgroundColor: '#8124E3'} : undefined}
                            >
                                {isSubmitting ? 'Procesando...' : pickupMode
                                    ? `Confirmar Pedido — Recoger en Tienda`
                                    : !selectedAddressId ? 'Agrega una dirección o selecciona Recoger en Tienda'
                                    : !selectedRate ? 'Selecciona paquetería'
                                    : isKalexa
                                        ? `Confirmar Pedido — ${paymentMethod === 'paypal' ? 'Tarjeta Déb/Créd' : 'Transferencia'}`
                                        : paymentMethod === 'transfer'
                                            ? `Confirmar Pedido — Transferencia`
                                            : `Pagar $${getTotalWithShipping().toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
                            </button>

                            <p className="text-[10px] text-center text-gray-400 font-medium leading-relaxed">
                                {isKalexa
                                    ? 'Tu pedido será confirmado y te contactaremos por WhatsApp para coordinar el pago.'
                                    : 'Tu pedido será procesado y el vendedor preparará tu envío con la paquetería seleccionada.'
                                }
                            </p>

                            {isKalexa && (
                                
                                <a
                                    href={'https://wa.me/523339242571?text=' + encodeURIComponent(
                                        'Hola! Me interesa hacer el siguiente pedido:' + String.fromCharCode(10) +
                                        items.map(i => i.productName + ' - ' + i.color + ' / ' + i.size + ' x' + i.quantity + ' = $' + (i.price * i.quantity).toLocaleString('es-MX')).join(String.fromCharCode(10)) +
                                        String.fromCharCode(10) + 'Total: $' + getSubtotalWithDiscounts().toLocaleString('es-MX', { minimumFractionDigits: 2 }) +
                                        String.fromCharCode(10) + 'Forma de pago preferida: ' + (paymentMethod === 'paypal' ? 'Tarjeta de Debito/Credito' : 'Deposito/Transferencia')
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 text-white hover:scale-[1.02] shadow-lg"
                                    style={{backgroundColor: '#25D366'}}
                                >
                                    💬 Enviar pedido por WhatsApp
                                </a>
                            )}

                            {isKalexa && success && (
                                
                                <a
                                    href={'https://wa.me/523339242571?text=' + encodeURIComponent('Hola! Acabo de hacer un pedido en Kalexa Fashion.' + String.fromCharCode(10) + 'Metodo de pago: ' + (paymentMethod === 'paypal' ? 'Tarjeta de Debito/Credito' : 'Deposito/Transferencia') + String.fromCharCode(10) + 'Total: $' + getTotalWithShipping().toLocaleString('es-MX', { minimumFractionDigits: 2 }) + String.fromCharCode(10) + 'Quedo en espera de confirmacion.')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 text-white hover:scale-[1.02]"
                                    style={{backgroundColor: '#25D366'}}
                                >
                                    💬 Contactar por WhatsApp
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
