"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/CartContext';
import { useRecentlyViewed } from '@/lib/RecentlyViewedContext';
import { toggleWishlist } from '@/app/actions/wishlist';
import { getMarketplacePriceTiers } from '../../actions';
import { calculateAutoDiscount } from '@/lib/discountUtils';

export default function ProductDetailClient({ 
    product,
    user,
    isWholesale = false,
    prevProduct = null,
    nextProduct = null
}: { 
    product: any;
    user: any;
    isWholesale?: boolean;
    prevProduct?: { id: string; name: string; image: string | null } | null;
    nextProduct?: { id: string; name: string; image: string | null } | null;
}) {
    const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [currentImage, setCurrentImage] = useState(product.images?.[0] || null);
    const [addedToCart, setAddedToCart] = useState(false);
    const [wishlisted, setWishlisted] = useState(false);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const [openSection, setOpenSection] = useState<string | null>(null);
    const [priceTiers, setPriceTiers] = useState<any[]>([]);

    const { addItem, items: cartItems } = useCart();
    const { addItem: addRecentlyViewed } = useRecentlyViewed();

    useEffect(() => {
        addRecentlyViewed({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || '',
            category: product.category?.name,
        });
    }, [product.id]);

    // Cargar niveles de precio del vendedor para mostrar descuentos aplicables
    useEffect(() => {
        if (product.sellerId && user) {
            getMarketplacePriceTiers(product.sellerId).then(setPriceTiers).catch(() => {});
        }
    }, [product.sellerId, user]);

    const handleToggleWishlist = async () => {
        setWishlistLoading(true);
        const result = await toggleWishlist(product.id);
        if (!result.error) setWishlisted(result.added!);
        setWishlistLoading(false);
    };

    const getWhatsAppLink = () => {
        const sellerPhone = product.seller?.whatsapp || product.seller?.phone;
        if (!sellerPhone) return null;
        const text = encodeURIComponent(`Hola, me interesa el producto: ${product.name} ($${product.price}). Lo vi en Moda Zapotlanejo.`);
        return `https://wa.me/${sellerPhone.replace(/[^0-9]/g, '')}?text=${text}`;
    };

    // Colores y tallas en el orden original de creación del vendedor
    // Se preserva el orden de las variantes tal como vienen de la BD (orderBy: createdAt)
    // Si TODAS las tallas son numéricas se ordenan numéricamente, si no se respeta el orden original
    const colors: string[] = [];
    const colorsSeen = new Set<string>();
    product.variants.forEach((v: any) => {
        if (v.color && !colorsSeen.has(v.color)) {
            colorsSeen.add(v.color);
            colors.push(v.color);
        }
    });

    const sizesInOrder: string[] = [];
    const sizesSeen = new Set<string>();
    product.variants.forEach((v: any) => {
        if (v.size && !sizesSeen.has(v.size)) {
            sizesSeen.add(v.size);
            sizesInOrder.push(v.size);
        }
    });

    // Solo ordenar numéricamente si TODAS las tallas son números puros
    const allNumeric = sizesInOrder.every(s => !isNaN(parseFloat(s)) && isFinite(Number(s)));
    const sortedSizes = allNumeric
        ? [...sizesInOrder].sort((a, b) => parseFloat(a) - parseFloat(b))
        : sizesInOrder; // Respetar orden original del vendedor

    // Stock disponible por talla (filtrando por color si está seleccionado)
    const stockForSize = (size: string) => {
        return product.variants
            .filter((v: any) => v.size === size && (!selectedColor || v.color === selectedColor))
            .reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
    };

    // Cantidad total seleccionada
    const totalSelected = Object.values(sizeQuantities).reduce((a: number, b: any) => a + (b || 0), 0);

    // Los niveles de precio solo aplican cuando seleccionan por tallas individuales
    // NO aplican para Corrida/Paquete/Caja (ya tienen precio con descuento incluido)
    // Se suma lo que ya está en el carrito del mismo vendedor para calcular descuento real
    const qtyAlreadyInCart = cartItems
        .filter((item: any) => item.sellerId === product.sellerId && !item.sellByPackage)
        .reduce((sum: number, item: any) => sum + item.quantity, 0);
    const subtotalInCart = cartItems
        .filter((item: any) => item.sellerId === product.sellerId && !item.sellByPackage)
        .reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    const totalCombinedQty = totalSelected + qtyAlreadyInCart;
    const subtotalSelected = totalSelected * (product.price || 0);
    const subtotalCombined = subtotalSelected + subtotalInCart;

    const discountResult = priceTiers.length > 0 && totalCombinedQty > 0
        ? calculateAutoDiscount(priceTiers, totalCombinedQty, subtotalCombined)
        : null;
    // Precio con descuento solo sobre las piezas nuevas que se están seleccionando
    const pricePerPieceWithDiscount = discountResult && totalCombinedQty > 0
        ? discountResult.finalTotal / totalCombinedQty
        : product.price || 0;

    const updateSizeQty = (size: string, delta: number) => {
        const stock = stockForSize(size);
        setSizeQuantities(prev => {
            const current = prev[size] || 0;
            const next = Math.max(0, Math.min(current + delta, stock));
            const updated = { ...prev, [size]: next };
            if (updated[size] === 0) delete updated[size];
            return updated;
        });
    };

    // Agregar todas las tallas seleccionadas al carrito de una vez
    const handleAddToCart = () => {
        const entries = Object.entries(sizeQuantities).filter(([, qty]) => qty > 0);
        if (entries.length === 0) {
            alert('Selecciona al menos una talla y cantidad');
            return;
        }
        entries.forEach(([size, qty]) => {
            const variant = product.variants.find((v: any) =>
                v.size === size && (!selectedColor || v.color === selectedColor)
            ) || product.variants.find((v: any) => v.size === size);
            if (!variant) return;
            addItem({
                variantId: variant.id,
                productId: product.id,
                productName: product.name,
                sellerId: product.sellerId || '',
                sellerName: product.seller?.businessName || product.seller?.name || 'Vendedor',
                color: variant.color || selectedColor || 'Único',
                size,
                price: product.price,
                quantity: qty,
                image: product.images?.[0] || '',
                sellByPackage: false,
                packageSize: 1,
            });
        });
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    // Agregar corrida/paquete/caja completa al carrito
    const handleAddWholesaleMethod = (method: any) => {
        const composition = method.composition || {};
        const pieces = Object.values(composition).reduce((a: number, b: any) => a + (parseInt(b) || 0), 0) as number;
        if (pieces === 0) return alert('Este método no tiene piezas configuradas.');

        // Verificar stock para cada talla de la composición
        let hasStock = true;
        Object.entries(composition).forEach(([attrKey, qty]: [string, any]) => {
            let size = attrKey;
            try { size = JSON.parse(attrKey)?.Talla || JSON.parse(attrKey)?.Color || attrKey; } catch {}
            const available = stockForSize(size);
            if (available < parseInt(qty)) hasStock = false;
        });

        if (!hasStock) {
            alert('No hay stock suficiente para agregar esta corrida completa.');
            return;
        }

        // price ya está guardado como precio/pz
        const pricePerPiece = method.price ? parseFloat(method.price) : product.price;
        // ID único para identificar esta corrida como grupo
        const groupId = `${product.id}_${method.id || method.name}_${Date.now()}`;

        Object.entries(composition).forEach(([attrKey, qty]: [string, any]) => {
            let size = attrKey;
            try { size = JSON.parse(attrKey)?.Talla || JSON.parse(attrKey)?.Color || attrKey; } catch {}
            const qtyNum = parseInt(qty) || 0;
            if (qtyNum === 0) return;
            const variant = product.variants.find((v: any) => v.size === size) || product.variants[0];
            if (!variant) return;
            addItem({
                variantId: variant.id,
                productId: product.id,
                productName: `${product.name} [${method.name}]`,
                sellerId: product.sellerId || '',
                sellerName: product.seller?.businessName || product.seller?.name || 'Vendedor',
                color: variant.color || 'Único',
                size,
                price: pricePerPiece,
                normalPrice: product.price, // precio normal para revertir si rompen la corrida
                quantity: qtyNum,
                image: product.images?.[0] || '',
                sellByPackage: true,
                packageSize: pieces,
                wholesaleGroupId: groupId,
                wholesaleTotal: pieces,
            });
        });
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2000);
    };

    const toggleSection = (key: string) => setOpenSection(openSection === key ? null : key);

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            {/* BREADCRUMBS + Prev/Next Nav */}
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <Link href="/" className="hover:text-blue-600">Inicio</Link>
                    <span>/</span>
                    <Link href="/catalog" className="hover:text-blue-600">Catálogo</Link>
                    <span>/</span>
                    <Link href={`/catalog?category=${product.category?.slug}`} className="hover:text-blue-600">{product.category?.name}</Link>
                    <span>/</span>
                    <span className="text-foreground">{product.name}</span>
                </div>

                {/* Prev/Next Navigation */}
                <div className="flex items-center gap-2">
                    {prevProduct ? (
                        <Link
                            href={`/catalog/${prevProduct.id}`}
                            className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center text-gray-400 hover:border-blue-600 hover:text-blue-600 transition-all hover:scale-110"
                            title={prevProduct.name}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </Link>
                    ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center text-gray-200 dark:text-gray-700 cursor-not-allowed">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </div>
                    )}
                    {nextProduct ? (
                        <Link
                            href={`/catalog/${nextProduct.id}`}
                            className="w-10 h-10 rounded-full border-2 border-blue-600 bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 transition-all hover:scale-110 shadow-lg shadow-blue-500/20"
                            title={nextProduct.name}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </Link>
                    ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center text-gray-200 dark:text-gray-700 cursor-not-allowed">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </div>
                    )}
                    {/* Next product thumbnail */}
                    {nextProduct?.image && (
                        <Link href={`/catalog/${nextProduct.id}`} className="w-14 h-14 rounded-xl overflow-hidden border-2 border-border hover:border-blue-600 transition-all hover:scale-105 shrink-0 hidden sm:block">
                            <Image src={nextProduct.image} alt={nextProduct.name} width={56} height={56} className="w-full h-full object-cover" />
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                {/* LEFT: IMAGES */}
                <div className="space-y-6">
                    <div className="aspect-[3/4] rounded-[40px] overflow-hidden bg-gray-100 dark:bg-gray-900 relative shadow-2xl">
                        {currentImage ? (
                            <Image src={currentImage} alt={product.name} fill className="object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 font-black italic text-4xl leading-tight text-center px-10">
                                <span>MODA</span><span>ZAPOTLANEJO</span>
                            </div>
                        )}
                        <div className="absolute top-8 left-8">
                            <span className="px-5 py-2 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-xl">
                                {product.brand?.name || 'Genérico'}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                        {product.images?.map((img: string, idx: number) => (
                            <button key={idx} onClick={() => setCurrentImage(img)}
                                className={`w-24 h-32 rounded-2xl overflow-hidden shrink-0 border-2 transition-all ${currentImage === img ? 'border-blue-600 scale-105 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                <Image src={img} alt={`${product.name} ${idx}`} width={96} height={128} className="object-cover w-full h-full" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* RIGHT: DETAILS */}
                <div className="space-y-8 py-6">
                    {/* Nombre y vendedor */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-start gap-4">
                            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none text-foreground flex-1">{product.name}</h1>
                            <button onClick={handleToggleWishlist} disabled={wishlistLoading}
                                className={`p-3 rounded-2xl border-2 transition-all hover:scale-110 shrink-0 ${wishlisted ? 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-500' : 'border-border text-gray-300 hover:text-red-400 hover:border-red-200'}`}>
                                <svg className="w-6 h-6" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                            </button>
                        </div>
                        {product.seller && (
                            <Link href={`/vendor/${product.seller.id}`} className="text-sm font-bold text-blue-500 flex items-center gap-2 hover:text-blue-700 transition-colors group">
                                {/* Mini logo o inicial del vendedor */}
                                <span className="w-6 h-6 rounded-lg overflow-hidden shrink-0 border border-blue-200 dark:border-blue-800 inline-flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
                                    {(product.seller as any).logoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={(product.seller as any).logoUrl}
                                            alt={product.seller.businessName || product.seller.name}
                                            className="w-full h-full object-contain"
                                            suppressHydrationWarning
                                        />
                                    ) : (
                                        <span className="text-[10px] font-black text-blue-600">
                                            {(product.seller.businessName || product.seller.name).charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </span>
                                {product.seller.businessName || product.seller.name}
                            </Link>
                        )}
                    </div>

                    {/* PRECIO */}
                    {user ? (
                        <div className="space-y-4">
                            {/* Precio menudeo + descuento si aplica */}
                            <div className="flex items-baseline gap-3 flex-wrap">
                                {discountResult ? (
                                    <>
                                        <span className="text-4xl font-black tracking-tight text-emerald-600">
                                            ${pricePerPieceWithDiscount.toFixed(2)}
                                        </span>
                                        <span className="text-2xl font-black text-gray-300 line-through">
                                            ${(product.price || 0).toFixed(2)}
                                        </span>
                                        <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-black">
                                            {discountResult.tier.name} aplicado
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-4xl font-black tracking-tight text-blue-600">
                                        ${(product.price || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </span>
                                )}
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">por pieza</span>
                            </div>

                            {/* Niveles de precio disponibles para todos */}
                            {priceTiers.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Descuentos por volumen
                                        {qtyAlreadyInCart > 0 && (
                                            <span className="ml-2 text-blue-500 normal-case font-bold text-[9px]">
                                                (+{qtyAlreadyInCart} pz ya en carrito)
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {priceTiers.map((tier: any) => (
                                            <span key={tier.id} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl text-[10px] font-black">
                                                {tier.minQuantity > 0 ? `${tier.minQuantity}+ pz` : 'Siempre'} →{' '}
                                                {tier.discountPercentage ? `-${tier.discountPercentage}%` : `-$${tier.defaultPriceMinusFixed}/pz`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Opciones de mayoreo — SOLO para mayoristas */}
                            {isWholesale && product.sellByPackage && Array.isArray(product.wholesaleComposition) && product.wholesaleComposition.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Opciones de mayoreo</p>
                                    <div className="flex flex-col gap-2">
                                        {product.wholesaleComposition.map((method: any, i: number) => {
                                            const composition = method.composition || {};
                                            const pieces = Object.values(composition).reduce((a: number, b: any) => a + (parseInt(b) || 0), 0) as number;
                                            // price ya está guardado como precio/pz
                                            const pricePerPiece = method.price ? parseFloat(method.price) : 0;

                                            // Verificar si hay stock completo
                                            let hasFullStock = true;
                                            Object.entries(composition).forEach(([attrKey, qty]: [string, any]) => {
                                                let size = attrKey;
                                                try { size = JSON.parse(attrKey)?.Talla || JSON.parse(attrKey)?.Color || attrKey; } catch {}
                                                if (stockForSize(size) < parseInt(qty)) hasFullStock = false;
                                            });

                                            return (
                                                <button key={i}
                                                    onClick={() => handleAddWholesaleMethod(method)}
                                                    disabled={!hasFullStock}
                                                    className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all text-left w-full ${hasFullStock
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 hover:shadow-md'
                                                        : 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                                                    }`}>
                                                    <div>
                                                        <p className="font-black text-sm text-foreground">{method.name}</p>
                                                        <p className="text-[10px] font-bold text-gray-500">{pieces} piezas · {hasFullStock ? '✓ Stock disponible' : '✗ Sin stock suficiente'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-black text-emerald-600">${pricePerPiece.toFixed(0)}<span className="text-xs">/pz</span></p>
                                                        <p className="text-[10px] text-gray-400">Total ${(pricePerPiece * pieces).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/50 space-y-3">
                            <p className="text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest text-sm">Precios Exclusivos</p>
                            <p className="text-gray-500 text-xs font-bold leading-relaxed">Para ver los precios y empezar a comprar, inicia sesión o crea una cuenta.</p>
                            <Link href="/register/buyer" className="inline-flex px-6 py-2.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                                Crear Cuenta Gratis
                            </Link>
                        </div>
                    )}

                    {/* SELECTOR DE COLORES */}
                    {colors.length > 0 && (
                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Color</label>
                            <div className="flex flex-wrap gap-2">
                                {colors.map(color => (
                                    <button key={color} onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                                        className={`px-5 py-2 rounded-xl border-2 text-xs font-bold transition-all ${selectedColor === color ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 text-blue-600' : 'border-border text-gray-500 hover:border-gray-400'}`}>
                                        {color}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SELECTOR DE TALLAS CON CANTIDAD */}
                    {sortedSizes.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Tallas y cantidades</label>
                                {totalSelected > 0 && (
                                    <span className="text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                                        {totalSelected} pz seleccionadas
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {sortedSizes.map(size => {
                                    const stock = stockForSize(size);
                                    const qty = sizeQuantities[size] || 0;
                                    const outOfStock = stock === 0;
                                    return (
                                        <div key={size} className={`rounded-2xl border-2 p-3 flex flex-col items-center gap-2 transition-all ${qty > 0 ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : outOfStock ? 'border-border opacity-40' : 'border-border hover:border-gray-300'}`}>
                                            <span className={`text-sm font-black ${qty > 0 ? 'text-blue-600' : outOfStock ? 'text-gray-300' : 'text-foreground'}`}>{size}</span>
                                            {!outOfStock ? (
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => updateSizeQty(size, -1)} disabled={qty === 0}
                                                        className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-black text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors">−</button>
                                                    <span className="w-6 text-center text-sm font-black text-foreground">{qty}</span>
                                                    <button onClick={() => updateSizeQty(size, 1)} disabled={qty >= stock}
                                                        className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-black text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors">+</button>
                                                </div>
                                            ) : (
                                                <span className="text-[9px] font-black text-gray-300 uppercase">Agotado</span>
                                            )}
                                            {!outOfStock && <span className="text-[9px] text-gray-400 font-medium">{stock} disp.</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* RESUMEN DE SELECCIÓN */}
                    {totalSelected > 0 && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Resumen</p>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-foreground">{totalSelected} pz × ${(product.price || 0).toFixed(2)}</span>
                                {discountResult ? (
                                    <div className="text-right">
                                        <span className="text-gray-400 line-through text-sm">${subtotalSelected.toFixed(2)}</span>
                                        <span className="ml-2 text-emerald-600 font-black text-lg">${discountResult.finalTotal.toFixed(2)}</span>
                                    </div>
                                ) : (
                                    <span className="text-lg font-black text-blue-600">${subtotalSelected.toFixed(2)}</span>
                                )}
                            </div>
                            {discountResult && (
                                <p className="text-[10px] text-emerald-600 font-black">
                                    Ahorro: ${discountResult.discount.toFixed(2)} ({discountResult.tier.name})
                                </p>
                            )}
                        </div>
                    )}

                    {/* BOTONES DE ACCIÓN */}
                    {user ? (
                        <div className="flex gap-3">
                            <button onClick={handleAddToCart}
                                className={`flex-1 px-6 py-5 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all shadow-2xl ${addedToCart ? 'bg-green-600 text-white shadow-green-500/20' : 'bg-foreground text-background shadow-foreground/20 hover:scale-105'}`}>
                                {addedToCart ? '✓ Agregado' : `🛒 Agregar al Carrito${totalSelected > 0 ? ` (${totalSelected} pz)` : ''}`}
                            </button>
                            <Link href="/cart" className="px-6 py-5 bg-white dark:bg-gray-800 border-2 border-border rounded-full text-xs font-black uppercase tracking-[0.2em] hover:border-blue-600 transition-all flex items-center whitespace-nowrap">
                                Ver Carrito
                            </Link>
                        </div>
                    ) : (
                        <Link href="/login" className="block w-full text-center px-8 py-5 bg-foreground text-background rounded-full text-xs font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl shadow-foreground/20">
                            Inicia Sesión para Comprar
                        </Link>
                    )}

                    {/* ACORDEONES */}
                    <div className="space-y-2 pt-4 border-t border-border">
                        {/* Descripción */}
                        <div className="border border-border rounded-2xl overflow-hidden">
                            <button onClick={() => toggleSection('description')}
                                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <span className="text-xs font-black uppercase tracking-widest text-foreground">Descripción</span>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSection === 'description' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                            </button>
                            {openSection === 'description' && (
                                <div className="px-5 pb-5 space-y-4 border-t border-border bg-gray-50/50 dark:bg-gray-800/20">
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 leading-relaxed pt-4">
                                        {product.description || "Este modelo de alta calidad ha sido fabricado siguiendo los más altos estándares de Zapotlanejo. Perfecto para tu negocio."}
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {product.brand && <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Marca</p><p className="text-sm font-bold text-foreground">{product.brand.name}</p></div>}
                                        {product.category && <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Categoría</p><p className="text-sm font-bold text-foreground">{product.category.name}</p></div>}
                                        {product.sku && <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">SKU</p><p className="text-sm font-bold text-foreground">{product.sku}</p></div>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Info de corrida — solo si tiene mayoreo y el usuario es mayorista */}
                        {isWholesale && product.sellByPackage && Array.isArray(product.wholesaleComposition) && product.wholesaleComposition.length > 0 && (
                            <div className="border border-border rounded-2xl overflow-hidden">
                                <button onClick={() => toggleSection('pack')}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <span className="text-xs font-black uppercase tracking-widest text-foreground">Info de corrida / mayoreo</span>
                                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSection === 'pack' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                                </button>
                                {openSection === 'pack' && (
                                    <div className="px-5 pb-5 space-y-3 border-t border-border bg-gray-50/50 dark:bg-gray-800/20 pt-4">
                                        {product.wholesaleComposition.map((method: any, idx: number) => {
                                            const composition = method.composition || {};
                                            const pieces = Object.values(composition).reduce((a: number, b: any) => a + (parseInt(b) || 0), 0) as number;
                                            // price ya está guardado como precio/pz
                                            const pricePerPiece = method.price ? parseFloat(method.price) : 0;
                                            return (
                                                <div key={idx} className="border border-border rounded-xl overflow-hidden">
                                                    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-border">
                                                        <span className="font-black text-foreground text-sm">{method.name}</span>
                                                        <span className="text-emerald-600 font-black text-sm">${pricePerPiece.toFixed(0)}/pz · {pieces} pz</span>
                                                    </div>
                                                    <div className="p-3 flex flex-wrap gap-2">
                                                        {Object.entries(composition).map(([attrKey, qty]: [string, any]) => {
                                                            let label = attrKey;
                                                            try { label = JSON.parse(attrKey)?.Talla || JSON.parse(attrKey)?.Color || attrKey; } catch {}
                                                            return (
                                                                <span key={attrKey} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold">
                                                                    T.{label}: <span className="text-blue-600">{qty}</span>
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Vendedor */}
                        <div className="border border-border rounded-2xl overflow-hidden">
                            <button onClick={() => toggleSection('vendor')}
                                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <span className="text-xs font-black uppercase tracking-widest text-foreground">Vendedor</span>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${openSection === 'vendor' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                            </button>
                            {openSection === 'vendor' && product.seller && (
                                <div className="px-5 pb-5 border-t border-border bg-gray-50/50 dark:bg-gray-800/20 pt-4 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-xl font-black">
                                            {(product.seller.businessName || product.seller.name).charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-black text-foreground">{product.seller.businessName || product.seller.name}</p>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">✓ Verificado</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Link href={`/vendor/${product.seller.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                                            🏪 Ver Tienda
                                        </Link>
                                        <Link href={`/messages?with=${product.seller.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition border border-border">
                                            💬 Mensaje
                                        </Link>
                                        {getWhatsAppLink() && (
                                            <a href={getWhatsAppLink()!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-600 transition shadow-lg shadow-green-500/20">
                                                📱 WhatsApp
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <p className="text-[9px] text-center font-bold text-gray-400 uppercase tracking-widest">Garantía de calidad y autenticidad regional</p>
                </div>
            </div>
        </div>
    );
}
