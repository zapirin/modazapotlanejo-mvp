"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface CartItem {
    variantId: string;
    productId: string;
    productName: string;
    sellerId: string;
    sellerName: string;
    color: string;
    size: string;
    price: number;
    normalPrice?: number;  // precio normal sin corrida — para revertir si se rompe
    quantity: number;
    image: string;
    // Wholesale/Package info
    sellByPackage?: boolean;
    packageSize?: number;
    wholesaleGroupId?: string; // ID único para agrupar items de la misma corrida
    wholesaleTotal?: number;   // total de piezas que debe tener la corrida completa
}

interface CartContextType {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (variantId: string) => void;
    updateQuantity: (variantId: string, quantity: number) => void;
    clearCart: () => void;
    getTotal: () => number;
    getItemCount: () => number;
    getItemsBySeller: () => Map<string, { sellerName: string; items: CartItem[]; total: number }>;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = 'mz_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(CART_KEY);
            if (saved) setItems(JSON.parse(saved));
        } catch {}
        setLoaded(true);
    }, []);

    // Save to localStorage on change — excluir imágenes base64 para no exceder la cuota
    useEffect(() => {
        if (loaded) {
            try {
                // Guardar items sin la imagen (puede ser base64 enorme)
                const itemsToSave = items.map(item => ({
                    ...item,
                    // Si es base64, no guardar; si es URL normal, sí guardar
                    image: item.image?.startsWith('data:') ? '' : (item.image || '')
                }));
                localStorage.setItem(CART_KEY, JSON.stringify(itemsToSave));
            } catch (e) {
                // Si aun así falla, guardar sin imágenes
                try {
                    const minimal = items.map(({ image: _img, ...rest }) => ({ ...rest, image: '' }));
                    localStorage.setItem(CART_KEY, JSON.stringify(minimal));
                } catch {
                    console.warn('No se pudo guardar el carrito en localStorage');
                }
            }
        }
    }, [items, loaded]);

    const addItem = useCallback((item: CartItem) => {
        setItems(prev => {
            // Asegurar que normalPrice siempre tenga valor
            const normalizedItem = { ...item, normalPrice: item.normalPrice ?? item.price, wholesaleTotal: (item as any).wholesaleTotal };
            const existing = prev.find(i => i.variantId === item.variantId);
            if (existing) {
                return prev.map(i =>
                    i.variantId === item.variantId
                        ? { ...i, quantity: i.quantity + item.quantity }
                        : i
                );
            }
            return [...prev, normalizedItem];
        });
    }, []);

    const removeItem = useCallback((variantId: string) => {
        setItems(prev => {
            const removing = prev.find(i => i.variantId === variantId);
            let next = prev.filter(i => i.variantId !== variantId);

            // Si era parte de una corrida, revertir precio de las piezas restantes
            if (removing?.wholesaleGroupId) {
                const groupId = removing.wholesaleGroupId;
                next = next.map(i =>
                    i.wholesaleGroupId === groupId
                        ? { ...i, sellByPackage: false, wholesaleGroupId: undefined, price: i.normalPrice ?? i.price }
                        : i
                );
            }
            return next;
        });
    }, []);

    const updateQuantity = useCallback((variantId: string, quantity: number) => {
        setItems(prev => {
            const target = prev.find(i => i.variantId === variantId);
            if (quantity <= 0) {
                let next = prev.filter(i => i.variantId !== variantId);
                // Revertir precio del resto de la corrida si se elimina una pieza
                if (target?.wholesaleGroupId) {
                    const groupId = target.wholesaleGroupId;
                    next = next.map(i =>
                        i.wholesaleGroupId === groupId
                            ? { ...i, sellByPackage: false, wholesaleGroupId: undefined, price: i.normalPrice ?? i.price } as CartItem
                            : i
                    );
                }
                return next;
            }
            // Si reduce cantidad de un item de corrida, revertir todo el grupo a precio normal
            if (target?.wholesaleGroupId && quantity < target.quantity) {
                const groupId = target.wholesaleGroupId;
                return prev.map(i => {
                    if (i.variantId === variantId) {
                        return { ...i, quantity, sellByPackage: false, wholesaleGroupId: undefined, price: i.normalPrice ?? i.price } as CartItem;
                    }
                    if (i.wholesaleGroupId === groupId) {
                        return { ...i, sellByPackage: false, wholesaleGroupId: undefined, price: i.normalPrice ?? i.price } as CartItem;
                    }
                    return i;
                });
            }
            return prev.map(i => i.variantId === variantId ? { ...i, quantity } : i);
        });
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
    }, []);

    const getTotal = useCallback(() => {
        return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    }, [items]);

    const getItemCount = useCallback(() => {
        return items.reduce((sum, i) => sum + i.quantity, 0);
    }, [items]);

    const getItemsBySeller = useCallback(() => {
        const map = new Map<string, { sellerName: string; items: CartItem[]; total: number }>();
        items.forEach(item => {
            if (!map.has(item.sellerId)) {
                map.set(item.sellerId, { sellerName: item.sellerName, items: [], total: 0 });
            }
            const group = map.get(item.sellerId)!;
            group.items.push(item);
            group.total += item.price * item.quantity;
        });
        return map;
    }, [items]);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, getTotal, getItemCount, getItemsBySeller }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within CartProvider');
    return context;
}
