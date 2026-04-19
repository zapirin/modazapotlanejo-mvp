"use client";

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { getSessionUser } from '@/app/actions/auth';
import { getDenominations, seedDefaultDenominations } from '../settings/denominations/actions';
import { savePendingSale, getPendingSales, markSaleSynced, markSaleSyncError, countPendingSales } from '@/lib/posOfflineStore';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { searchProducts, getPriceTiers, getPaymentMethods, getPOSCategories, getProductsByCategory, processSale, getSuspendedSales, suspendSale, deleteSuspendedSale, createLayaway, getSaleById, updateSale } from '../products/new/actions';
import { getCurrentCashSession, openCashSession, addCashMovement, closeCashSession, createTransfer, getAllowedLocations, checkSellerPOSAccess, getSalesBySession, getSalespersons } from './actions';
import { getStoreSettings, getLocationsSettings, getRequireSalesperson } from '../settings/actions';
import { createClient, searchClients, getClientById } from '../clients/actions';
import InventoryRealtimeSync from '@/components/InventoryRealtimeSync';
import { toast } from 'sonner';

// Orden estándar de tallas de ropa — de menor a mayor
const SIZE_ORDER: Record<string, number> = {
    'xs': 0, 'extra chica': 0,
    's': 1, 'small': 1, 'ch': 1, 'chica': 1, 'pequeña': 1,
    'm': 2, 'medium': 2, 'med': 2, 'mediana': 2,
    'l': 3, 'large': 3, 'grande': 3, 'g': 3,
    'xl': 4, 'extra grande': 4,
    'xxl': 5, '2xl': 5, 'doble xl': 5,
    'xxxl': 6, '3xl': 6, 'triple xl': 6,
    'unico': 99, 'único': 99, 'talla unica': 99,
};
const sizeRank = (size: string): number => SIZE_ORDER[size?.toLowerCase?.()?.trim()] ?? -1;
const sortVariants = (variants: any[]): any[] =>
    variants.slice().sort((a, b) => {
        const aSize = String(a.size ?? '');
        const bSize = String(b.size ?? '');
        const allNumeric = variants.every(v => !isNaN(parseFloat(v.size)) && isFinite(Number(v.size)));
        if (allNumeric) return parseFloat(aSize) - parseFloat(bSize);
        const ra = sizeRank(aSize), rb = sizeRank(bSize);
        if (ra !== -1 && rb !== -1) return ra - rb;
        if (ra !== -1) return -1;
        if (rb !== -1) return 1;
        return 0; // Desconocido: preservar orden DB (createdAt asc)
    });


function POSContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const editSaleId = searchParams.get('edit');

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [categoryProducts, setCategoryProducts] = useState<any[]>([]);

    // Refs para hotkeys
    const searchInputRef  = useRef<HTMLInputElement>(null);
    const paymentInputRef = useRef<HTMLInputElement>(null);

    // Store data
    const [priceTiers, setPriceTiers] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

    // POS State
    const [cart, setCart] = useState<any[]>([]);
    const [selectedTier, setSelectedTier] = useState<any>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('Efectivo');
    const [receivedAmount, setReceivedAmount] = useState('');
    const [partialPayments, setPartialPayments] = useState<{ method: string, amount: number }[]>([]);
    const [isReturnMode, setIsReturnMode] = useState(false);
    const [isTransferMode, setIsTransferMode] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [useVariationSelector, setUseVariationSelector] = useState(false);
    const [showModeDropdown, setShowModeDropdown] = useState(false);
    
    // Transfer State
    const [locations, setLocations] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [transferSourceId, setTransferSourceId] = useState<string>('');
    const [transferDestId, setTransferDestId] = useState<string>('');

    // Edit State
    const [originalSale, setOriginalSale] = useState<any>(null);

    // Salesperson State
    const [salespersons, setSalespersons] = useState<{ id: string; name: string }[]>([]);
    const [selectedSalesperson, setSelectedSalesperson] = useState<{ id: string; name: string } | null>(null);

    // Client Modal State
    const [showClientModal, setShowClientModal] = useState(false);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');

    // Client History Modal State
    const [showClientHistory, setShowClientHistory] = useState(false);
    const [clientHistoryData, setClientHistoryData] = useState<any>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Discount Modal State
    const [showDiscountModal, setShowDiscountModal] = useState(false);
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
    const [discountValue, setDiscountValue] = useState<string>('');
    const [globalDiscount, setGlobalDiscount] = useState<{ type: 'percent' | 'fixed', value: number } | null>(null);

    // Variation Modal State
    const [showVariationModal, setShowVariationModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [bulkPrice, setBulkPrice] = useState('');
    const [variationInputs, setVariationInputs] = useState<any>({});
    const [singleVariantMode, setSingleVariantMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Cash Management State
    const [currentSession, setCurrentSession] = useState<any>(null);
    const [showOpenSessionModal, setShowOpenSessionModal] = useState(false);
    const [otherCashierSession, setOtherCashierSession] = useState<any>(null); // Sesión abierta por otro cajero
    const [showOtherCashierModal, setShowOtherCashierModal] = useState(false);
    const [showMobileRight, setShowMobileRight] = useState(false); // Panel derecho en móvil
    const [denominations, setDenominations] = useState<any[]>([]);
    const [denCounts, setDenCounts] = useState<Record<string, string>>({});
    const [isOnline, setIsOnline] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [allowedLocations, setAllowedLocations] = useState<any[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [showZReportModal, setShowZReportModal] = useState(false);
    const [showTodayTicketsModal, setShowTodayTicketsModal] = useState(false);
    const [todayTickets, setTodayTickets] = useState<any[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [reprintSale, setReprintSale] = useState<any>(null);
    const [cashAmount, setCashAmount] = useState('');
    const [cashReason, setCashReason] = useState('');
    const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");

    // Receipt State
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [showTicketOptions, setShowTicketOptions] = useState(false);
    const [offlineSyncTime, setOfflineSyncTime] = useState<string>('');
    useEffect(() => {
        setOfflineSyncTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
    }, []);

    // Cajón de dinero
    const openCashDrawer = (reason?: string) => {
        const drawerHtml = `
            <html>
            <head>
                <style>
                    body { margin: 0; }
                    @page { margin: 0; size: 1mm 1mm; }
                </style>
            </head>
            <body>
                <!-- ESC/POS: ESC p 0 50 255 — comando de apertura de cajón -->
                <div style="font-family:monospace;font-size:1px;color:white;">
                    \x1B\x70\x00\x32\xFF
                    ${reason ? `Apertura manual: ${reason}` : 'Apertura de cajón'}
                </div>
            </body>
            </html>`;
        const win = window.open('', '', 'width=1,height=1');
        if (win) {
            win.document.write(drawerHtml);
            win.document.close();
            setTimeout(() => { win.print(); win.close(); }, 200);
        }
    };
    const [lastSaleData, setLastSaleData] = useState<any>(null);

    // Suspended Sales State
    const [showSuspendedModal, setShowSuspendedModal] = useState(false);
    const [suspendedSales, setSuspendedSales] = useState<any[]>([]);
    const [showSuspendNoteModal, setShowSuspendNoteModal] = useState(false);
    const [suspendNote, setSuspendNote] = useState('');

    // Layaway State
    const [showLayawayModal, setShowLayawayModal] = useState(false);
    const [layawayPayment, setLayawayPayment] = useState<string>('');
    const [layawayDueDate, setLayawayDueDate] = useState<string>('');
    // const [receivedAmount, setReceivedAmount] = useState<string>(''); // Moved to POS State

    // Global Store & Location Config
    const [globalConfig, setGlobalConfig] = useState<any>(null);
    const [requireSalesperson, setRequireSalesperson] = useState(false);

    // Hook de conectividad — detecta online/offline y sincroniza automáticamente
    useEffect(() => {
        const updateOnline = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', updateOnline);
        window.addEventListener('offline', updateOnline);
        setIsOnline(navigator.onLine);
        // Contar ventas pendientes al cargar
        countPendingSales().then(setPendingCount).catch(() => {});
        return () => {
            window.removeEventListener('online', updateOnline);
            window.removeEventListener('offline', updateOnline);
        };
    }, []);

    // Auto-sincronizar cuando vuelve la conexión
    useEffect(() => {
        if (isOnline && pendingCount > 0) {
            syncPendingSales();
        }
    }, [isOnline]);

    const syncPendingSales = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            const pending = await getPendingSales();
            if (pending.length === 0) { setIsSyncing(false); return; }

            const res = await fetch('/api/pos/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sales: pending.map(p => ({ localId: p.localId, data: p.data })) }),
            });
            const json = await res.json();
            if (json.success) {
                for (const result of json.results) {
                    if (result.success) {
                        await markSaleSynced(result.localId);
                    } else {
                        await markSaleSyncError(result.localId, result.error);
                    }
                }
                const synced = json.results.filter((r: any) => r.success).length;
                const failed = json.results.filter((r: any) => !r.success).length;
                if (synced > 0) toast.success(`✅ ${synced} venta${synced > 1 ? 's' : ''} sincronizada${synced > 1 ? 's' : ''}`);
                if (failed > 0) toast.error(`⚠️ ${failed} venta${failed > 1 ? 's' : ''} no pudieron sincronizarse`);
            }
        } catch (err) {
            console.error('Sync error:', err);
        } finally {
            const remaining = await countPendingSales();
            setPendingCount(remaining);
            setIsSyncing(false);
        }
    };

    // ─── Hotkeys globales ────────────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            // Ignorar si el foco está en un input/textarea/select (excepto los nuestros)
            const tag = (e.target as HTMLElement)?.tagName;
            const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

            if (e.key === 'F1') {
                e.preventDefault();
                window.location.reload();
            } else if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
            } else if (e.key === 'F3') {
                e.preventDefault();
                setShowClientModal(true);
            } else if (e.key === 'F7') {
                e.preventDefault();
                paymentInputRef.current?.focus();
                paymentInputRef.current?.select();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);
    // ─────────────────────────────────────────────────────────────────────

    // ─── Cart persistence ────────────────────────────────────────────────
    const CART_STORAGE_KEY = 'pos_cart_draft';
    const clearCartStorage = () => localStorage.removeItem(CART_STORAGE_KEY);

    useEffect(() => {
        const hasData = cart.length > 0 || selectedClient || selectedTier || globalDiscount || partialPayments.length > 0;
        if (hasData) {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ cart, selectedClient, selectedTier, globalDiscount, partialPayments }));
        }
    }, [cart, selectedClient, selectedTier, globalDiscount, partialPayments]);
    // ─────────────────────────────────────────────────────────────────────

    useEffect(() => {
        async function loadData() {
            // Paso 1: cargar datos que no dependen de sesión ni locación
            const [tiers, methods, cats, storeSettingsRes, initialSuspended, locationsRes, spRes] = await Promise.all([
                getPriceTiers(),
                getPaymentMethods(),
                getPOSCategories(),
                getStoreSettings(),
                getSuspendedSales(),
                getLocationsSettings(),
                getRequireSalesperson(),
            ]);

            setSuspendedSales(initialSuspended);
            if (storeSettingsRes.success) setGlobalConfig(storeSettingsRes.data);
            if (locationsRes.success && locationsRes.data) setLocations(locationsRes.data);
            setRequireSalesperson(spRes.requireSalesperson);

            const sortedMethods = methods.sort((a: any, b: any) => {
                if (a.name.toLowerCase().includes('efectivo')) return -1;
                if (b.name.toLowerCase().includes('efectivo')) return 1;
                return 0;
            });
            setPriceTiers(tiers);
            setPaymentMethods(sortedMethods);
            setCategories(cats);

            // Restaurar carrito guardado (solo si no estamos editando una venta existente)
            if (!editSaleId) {
                try {
                    const savedDraft = localStorage.getItem(CART_STORAGE_KEY);
                    if (savedDraft) {
                        const parsed = JSON.parse(savedDraft);
                        if (parsed.cart?.length > 0)         setCart(parsed.cart);
                        if (parsed.selectedClient)           setSelectedClient(parsed.selectedClient);
                        if (parsed.selectedTier) {
                            const match = tiers.find((t: any) => t.id === parsed.selectedTier.id);
                            setSelectedTier(match ?? parsed.selectedTier);
                        }
                        if (parsed.globalDiscount)           setGlobalDiscount(parsed.globalDiscount);
                        if (parsed.partialPayments?.length > 0) setPartialPayments(parsed.partialPayments);
                    }
                } catch { localStorage.removeItem(CART_STORAGE_KEY); }
            }

            // Paso 2: usuario, locaciones, denominaciones y vendedores de piso
            const [sessionUser, allowedLocs, dens, spersons] = await Promise.all([
                getSessionUser(),
                getAllowedLocations(),
                getDenominations(),
                getSalespersons(undefined),
            ]);
            setCurrentUser(sessionUser);
            setSalespersons(spersons);
            setAllowedLocations(allowedLocs);
            if (allowedLocs.length === 1) {
                setSelectedLocationId(allowedLocs[0].id);
            }

            // Verificar que el vendedor tiene POS habilitado
            if (sessionUser?.role === 'SELLER') {
                const seller = await checkSellerPOSAccess();
                if (!seller.posEnabled) {
                    window.location.href = '/dashboard?error=pos_disabled';
                    return;
                }
            }
            if (dens.length > 0) {
                setDenominations(dens);
            } else {
                // Auto-seed MXN si nunca se configuraron
                await seedDefaultDenominations();
                const freshDens = await getDenominations();
                setDenominations(freshDens);
            }

            // Paso 3: determinar locación y verificar sesión de caja
            let locId: string | undefined;
            if (allowedLocs.length === 1) {
                locId = allowedLocs[0].id;
                setSelectedLocationId(locId);
            }

            // Buscar sesión activa en la locación (o cualquiera si no hay locId)
            const activeSession = locId
                ? await getCurrentCashSession(locId)
                : await getCurrentCashSession();

            if (activeSession) {
                if (activeSession.openedById === sessionUser?.id) {
                    // Misma sesión del mismo cajero — continuar
                    setCurrentSession(activeSession);
                } else {
                    // Sesión abierta por otro cajero
                    setOtherCashierSession(activeSession);
                    setShowOtherCashierModal(true);
                }
            } else {
                // Sin sesión — mostrar modal para abrir caja
                setCurrentSession(null);
                if (locId || allowedLocs.length === 0) {
                    // Si solo hay 1 locación o no hay locaciones, mostrar modal directo
                    setShowOpenSessionModal(true);
                }
                // Si tiene más de 1 locación, el modal pedirá elegir primero
            }
            // currentSession se setea arriba
            
            if (editSaleId) {
                const sale = await getSaleById(editSaleId);
                if (sale) {
                    setOriginalSale(sale);
                    if (sale.client) setSelectedClient(sale.client);
                    if (sale.priceTier) setSelectedTier(sale.priceTier);
                    if (sale.paymentMethod) setSelectedPaymentMethod(sale.paymentMethod.name);
                    
                    setIsReturnMode(sale.status === 'REFUNDED');
                    setGlobalDiscount(sale.discount > 0 ? { type: 'fixed', value: sale.discount } : null);

                    const restoredCart = sale.items.map((i: any) => ({
                        productId: i.variant.productId,
                        variantId: i.variant.id,
                        name: `${i.variant.product.name} [${formatVariantName(i.variant)}]`,
                        price: i.price,
                        quantity: sale.status === 'REFUNDED' ? -i.quantity : i.quantity,
                        discount: 0
                    }));
                    setCart(restoredCart);
                }
            } else if (sortedMethods.length > 0) {
                const efectivoMethod = sortedMethods.find((m: any) => m.name.toLowerCase().includes('efectivo'));
                setSelectedPaymentMethod(efectivoMethod ? efectivoMethod.name : sortedMethods[0].name);
            }
        }
        loadData();
    }, [editSaleId]);

    // Re-fetch salespeople filtered by active location when location changes
    useEffect(() => {
        if (!selectedLocationId) return;
        getSalespersons(selectedLocationId).then(spersons => setSalespersons(spersons));
    }, [selectedLocationId]);

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    };

    const formatVariantName = (variant: any) => {
        if (variant.attributes && typeof variant.attributes === 'object') {
            const attrs = variant.attributes as Record<string, any>;
            const parts = Object.values(attrs);
            if (parts.length > 0) return parts.join(' / ');
        }
        if (variant.color && variant.size) return `${variant.color} / ${variant.size}`;
        if (variant.color) return variant.color;
        if (variant.size) return variant.size;
        return 'Única';
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery && searchQuery.length >= 3) {
                handleSearch();
            } else if (!searchQuery) {
                setSearchResults([]);
            }
        }, 250);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (clientSearchQuery) {
                const results = await searchClients(clientSearchQuery);
                setClientSearchResults(results);
            } else {
                setClientSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [clientSearchQuery]);

    const handleSearch = async () => {
        // Implementamos la búsqueda de forma segura
        try {
            const results = await searchProducts(searchQuery);
            setSearchResults(results);
        } catch (error) {
            console.error("Error searching in POS", error);
        }
    };

    const openVariationModal = (product: any, isSingleMode: boolean) => {
        setSingleVariantMode(isSingleMode);
        setSelectedProduct(product);
        const initialInputs: any = {};

        if (!isSingleMode) {
            product.variants.forEach((v: any) => {
                initialInputs[v.id] = { quantity: 0, price: product.price };
            });
        }

        setVariationInputs(initialInputs);
        setBulkPrice('');
        setShowVariationModal(true);
    };

    const handleBulkPriceChange = (val: string) => {
        setBulkPrice(val);
        if (val) {
            const newInputs = { ...variationInputs };
            Object.keys(newInputs).forEach(key => {
                newInputs[key].price = parseFloat(val);
            });
            setVariationInputs(newInputs);
        }
    };

    const saveVariationsToCart = () => {
        const newCartItems: any[] = [];
        selectedProduct.variants.forEach((v: any) => {
            const input = variationInputs[v.id];
            if (input && input.quantity > 0) {
                newCartItems.push({
                    productId: selectedProduct.id,
                    variantId: v.id,
                    name: `${selectedProduct.name} [${formatVariantName(v)}]`,
                    price: input.price || selectedProduct.price,
                    quantity: isReturnMode ? -input.quantity : input.quantity,
                    discount: 0
                });
            }
        });

        if (newCartItems.length > 0) {
            setCart([...newCartItems, ...cart]);
        }
        setShowVariationModal(false);
    };

    const handleSingleVariantSelect = (variant: any) => {
        const newItem = {
            productId: selectedProduct.id,
            variantId: variant.id,
            name: `${selectedProduct.name} [${formatVariantName(variant)}]`,
            price: selectedProduct.price,
            quantity: isReturnMode ? -1 : 1,
            discount: 0
        };

        // Comprobar si ya existe para sumar cantidad
        const existingIdx = cart.findIndex(item => item.variantId === variant.id);
        if (existingIdx >= 0) {
            const newCart = [...cart];
            newCart[existingIdx].quantity += (isReturnMode ? -1 : 1);
            setCart(newCart);
        } else {
            setCart([newItem, ...cart]);
        }
        setShowVariationModal(false);
    };

    const handleProductSelect = (product: any) => {
        if (!product.variants || product.variants.length === 0) {
            toast.error('Este producto no tiene tallas o colores registrados en inventario.');
            return;
        }

        if (useVariationSelector) {
            // Modo Tabular Múltiple / Corrida
            openVariationModal(product, false);
        } else {
            // Modo Simple: Escoger solo una variante
            openVariationModal(product, true);
        }
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const updateItemPrice = (index: number, newPrice: number) => {
        const newCart = [...cart];
        newCart[index].price = newPrice;
        setCart(newCart);
    };

    const updateItemQuantity = (index: number, newQuantity: number) => {
        const newCart = [...cart];
        newCart[index].quantity = newQuantity;
        setCart(newCart);
    };

    const calculateSubtotal = () => cart.reduce((acc, item) => acc + (item.price * (item.quantity || 0)), 0);

    // In Kalexa style, discounts are often calculated linearly or based on total. 
    // We'll calculate total based on tier if applied, AND then apply global manual discounts.
    const calculateTotal = () => {
        let subtotal = calculateSubtotal();
        let totalDiscount = 0;

        // 1. Tier Discount
        if (selectedTier) {
            if (selectedTier.discountPercentage) {
                const tierDiscAmount = subtotal * (selectedTier.discountPercentage / 100);
                subtotal -= tierDiscAmount;
            } else if (selectedTier.defaultPriceMinusFixed) {
                const totalItemsQty = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
                const tierDiscAmount = totalItemsQty * selectedTier.defaultPriceMinusFixed;
                subtotal -= tierDiscAmount;
            }
        }

        // 2. Global Manual Discount
        if (globalDiscount) {
            if (globalDiscount.type === 'percent') {
                const percentDiscAmount = subtotal * (globalDiscount.value / 100);
                subtotal -= percentDiscAmount;
            } else if (globalDiscount.type === 'fixed') {
                subtotal -= globalDiscount.value;
            }
        }

        return isReturnMode ? Math.abs(subtotal) : Math.max(0, subtotal);
    };

    const calculateBalance = () => {
        if (isReturnMode) return 0; // En devolución no hay saldo pendiente del cliente
        const paid = partialPayments.reduce((acc, p) => acc + p.amount, 0);
        return Math.max(0, calculateTotal() - paid);
    };

    const handleAddPartialPayment = () => {
        const amount = parseFloat(receivedAmount);
        if (isNaN(amount) || amount <= 0) return;
        
        const balance = calculateBalance();
        const finalAmount = Math.min(amount, balance);

        const newPayments = [...partialPayments, { 
            method: selectedPaymentMethod || 'Efectivo', 
            amount: finalAmount 
        }];

        setPartialPayments(newPayments);
        setReceivedAmount('');

        // AUTOMATIC PROCESS SALE IF TOTAL IS REACHED
        if (amount >= balance) {
            handleProcessSale(newPayments, amount);
        }
    };

    const handleRemovePartialPayment = (index: number) => {
        setPartialPayments(partialPayments.filter((_, i) => i !== index));
    };

    const handleProcessSale = async (overriddenPayments?: { method: string, amount: number }[], explicitReceivedAmount?: number) => {
        if (cart.length === 0) return;

        // BLOQUEO DURO — no se puede vender sin caja abierta
        if (!currentSession) {
            toast.error("⚠️ Debes abrir la caja antes de realizar ventas.");
            setShowOpenSessionModal(true);
            return;
        }
        
        if (selectedPaymentMethod === 'Crédito de Tienda' && !selectedClient) {
            toast.error("Debe seleccionar un cliente del panel derecho para procesar una venta a crédito.");
            return;
        }

        if (requireSalesperson && salespersons.length > 1 && !selectedSalesperson) {
            toast.error("⚠️ Debes asignar un vendedor de piso antes de procesar la venta.");
            return;
        }

        let paymentsToUse = overriddenPayments || partialPayments;
        const totalPaidSoFar = paymentsToUse.reduce((acc, p) => acc + p.amount, 0);

        // Si no hay pagos registrados, intentamos validar el monto directo en el input
        // Excepción: si el total es $0 (ej. cambio de producto mismo precio) no se requiere pago
        if (paymentsToUse.length === 0 && !isTransferMode && calculateTotal() > 0) {
            const directReceived = explicitReceivedAmount !== undefined ? explicitReceivedAmount : parseFloat(receivedAmount);
            if (isNaN(directReceived) || directReceived < calculateTotal()) {
                toast.error("Debe ingresar un monto válido que cubra el total de la venta.");
                return;
            }
            // Para consistencia con el backend, si no hay pagos parciales,
            // el sistema asume un pago único por el total con el método seleccionado.
        } else if (totalPaidSoFar < calculateTotal() && !isTransferMode && calculateTotal() > 0) {
            toast.warning("Aún queda un saldo pendiente por pagar.");
            return;
        }

        setIsProcessing(true);
        try {
            const saleData = {
                cart: cart.map(item => ({
                    variantId: item.variantId,
                    quantity: item.quantity || 0,
                    price: item.price
                })).filter(item => item.quantity !== 0),
                total: calculateTotal(),
                subtotal: calculateSubtotal(),
                discount: calculateSubtotal() - calculateTotal(),
                paymentMethodName: selectedPaymentMethod,
                clientId: selectedClient?.id || null,
                priceTierId: selectedTier?.id || null,
                isReturn: isReturnMode,
                cashSessionId: currentSession?.id || null,
                partialPayments: paymentsToUse.length > 0 ? paymentsToUse : null,
                soldBySalespersonId: selectedSalesperson?.id || null,
            };

            // === MODO OFFLINE ===
            if (!isOnline && !editSaleId) {
                const localId = await savePendingSale({ data: saleData });
                const newCount = await countPendingSales();
                setPendingCount(newCount);
                toast.warning(`📴 Sin conexión — venta guardada localmente (${newCount} pendiente${newCount > 1 ? 's' : ''})`);
                // Limpiar carrito igual que si fuera exitosa
                clearCartStorage();
                setCart([]);
                setSelectedClient(null);
                setSelectedTier(null);
                setGlobalDiscount(null);
                setReceivedAmount('');
                setPartialPayments([]);
                setIsProcessing(false);
                return;
            }

            let res;
            if (editSaleId) {
                res = await updateSale(editSaleId, {
                    cart: saleData.cart,
                    subtotal: saleData.subtotal,
                    total: saleData.total,
                    discount: saleData.discount,
                    paymentMethodName: saleData.paymentMethodName,
                    clientId: saleData.clientId,
                    priceTierId: saleData.priceTierId,
                    isReturn: saleData.isReturn
                });
            } else {
                res = await processSale(saleData);
            }

            if (res.success) {
                // Save data for the receipt before clearing the cart
                setLastSaleData({
                    id: res.saleId,
                    receiptNumber: res.receiptNumber,
                    date: new Date(),
                    cart: [...cart],
                    total: calculateTotal(),
                    subtotal: calculateSubtotal(),
                    discount: calculateSubtotal() - calculateTotal(),
                    paymentMethodName: selectedPaymentMethod,
                    tierName: selectedTier ? selectedTier.name : 'Precio Público',
                    clientName: selectedClient ? selectedClient.name : 'Venta de Mostrador',
                    salespersonName: selectedSalesperson ? selectedSalesperson.name : null,
                    isReturn: isReturnMode,
                    receivedAmount: explicitReceivedAmount !== undefined
                        ? explicitReceivedAmount
                        : (selectedPaymentMethod?.toLowerCase().includes('efectivo') ? (parseFloat(receivedAmount) || 0) : null),
                    partialPayments: paymentsToUse.length > 0 ? paymentsToUse : null,
                });

                clearCartStorage();
                setCart([]);
                setSelectedTier(null);
                setSelectedClient(null);
                setSelectedSalesperson(null);
                setGlobalDiscount(null);
                setReceivedAmount('');
                setPartialPayments([]);
                setIsReturnMode(false);
                // Resetear método de pago a Efectivo
                const efectivoAfterSale = paymentMethods.find((m: any) => m.name.toLowerCase().includes('efectivo'));
                setSelectedPaymentMethod(efectivoAfterSale ? efectivoAfterSale.name : (paymentMethods[0]?.name || 'Efectivo'));
                setShowReceiptModal(true);
            } else {
                toast.error(res.error || "Ocurrió un error al procesar la venta.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al procesar la venta.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSuspendSale = async (noteOverride?: string) => {
        if (cart.length === 0) return;
        // Si no hay cliente, pedir nota antes de suspender
        if (!selectedClient && noteOverride === undefined) {
            setSuspendNote('');
            setShowSuspendNoteModal(true);
            return;
        }
        setIsProcessing(true);
        try {
            const suspendedData = {
                cart: cart.map(item => ({
                    variantId: item.variantId,
                    quantity: item.quantity || 0,
                    price: item.price
                })).filter(item => item.quantity !== 0),
                total: calculateTotal(),
                subtotal: calculateSubtotal(),
                discount: calculateSubtotal() - calculateTotal(),
                priceTierId: selectedTier?.id || null,
                clientId: selectedClient?.id || null,
                amountPaid: partialPayments.reduce((acc, p) => acc + p.amount, 0),
                balance: calculateBalance(),
                notes: noteOverride || null,
            };
            const res = await suspendSale(suspendedData);
            if (res.success) {
                toast.success("Venta suspendida exitosamente.");
                clearCartStorage();
                setCart([]);
                setSelectedTier(null);
                setSelectedClient(null);
                setReceivedAmount('');
                setPartialPayments([]);
                setIsReturnMode(false);
                setSuspendedSales(await getSuspendedSales());
            } else {
                toast.error(res.error || "Ocurrió un error al suspender la venta.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al suspender la venta.");
        } finally {
            setIsProcessing(false);
        }
    };

    const loadSuspendedSales = async () => {
        const sales = await getSuspendedSales();
        setSuspendedSales(sales);
        if (sales.length > 0) {
            setShowSuspendedModal(true);
        } else {
            toast.info("No hay ventas suspendidas en este momento.");
        }
    };

    const handleLayawaySale = async () => {
        if (cart.length === 0) return;
        const initialPayment = parseFloat(layawayPayment);
        if (isNaN(initialPayment) || initialPayment < 0 || !layawayDueDate) {
            toast.error("Ingrese un pago inicial válido y una fecha límite.");
            return;
        }
        
        setIsProcessing(true);
        try {
            const layawayData = {
                cart: cart.map(item => ({
                    variantId: item.variantId,
                    quantity: item.quantity || 0,
                    price: item.price
                })).filter(item => item.quantity !== 0),
                total: calculateTotal(),
                subtotal: calculateSubtotal(),
                discount: calculateSubtotal() - calculateTotal(),
                initialPayment,
                paymentMethodName: selectedPaymentMethod,
                dueDate: new Date(layawayDueDate),
                priceTierId: selectedTier?.id || null,
                cashSessionId: currentSession?.id || null
            };
            
            const res = await createLayaway(layawayData);
            if (res.success) {
                // Preparamos el recibo
                setLastSaleData({
                    id: res.saleId,
                    receiptNumber: res.receiptNumber,
                    date: new Date(),
                    cart: [...cart],
                    total: calculateTotal(),
                    subtotal: calculateSubtotal(),
                    discount: calculateSubtotal() - calculateTotal(),
                    paymentMethodName: selectedPaymentMethod,
                    tierName: selectedTier ? selectedTier.name : 'Precio Público',
                    clientName: selectedClient ? selectedClient.name : 'Venta de Mostrador',
                    isReturn: false,
                    isLayaway: true,
                    amountPaid: initialPayment,
                    balance: calculateTotal() - initialPayment,
                    dueDate: new Date(layawayData.dueDate)
                });
                
                toast.success("Apartado registrado exitosamente.");
                clearCartStorage();
                setCart([]);
                setSelectedTier(null);
                setGlobalDiscount(null);
                setReceivedAmount('');
                setPartialPayments([]);
                setIsReturnMode(false);
                setShowLayawayModal(false);
                setLayawayPayment('');
                setLayawayDueDate('');
                const efectivoAfterLayaway = paymentMethods.find((m: any) => m.name.toLowerCase().includes('efectivo'));
                setSelectedPaymentMethod(efectivoAfterLayaway ? efectivoAfterLayaway.name : (paymentMethods[0]?.name || 'Efectivo'));
                setShowReceiptModal(true); // Imprimir ticket normal pero como apartado
            } else {
                toast.error(res.error || "Ocurrió un error al crear el apartado.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al crear el apartado.");
        } finally {
            setIsProcessing(false);
        }
    };

    const resumeSuspendedSale = async (sale: any) => {
        // Load the suspended items back into the cart
        const restoredCart = sale.items.map((i: any) => ({
            id: i.variant.product.id,
            name: `${i.variant.product.name} - ${formatVariantName(i.variant)}`,
            price: i.price,
            originalPrice: i.price,
            stock: i.variant.stock, // Warning: Should fetch current stock, but MVP
            sku: i.variant.sku,
            variantId: i.variant.id,
            quantity: i.quantity,
            image: i.variant.product.images?.[0] || 'https://via.placeholder.com/150'
        }));
        
        setCart(restoredCart);
        
        // Restore partial payments if any
        if (sale.amountPaid > 0) {
            setPartialPayments([{
                method: sale.paymentMethod?.name || 'Abono Previo',
                amount: sale.amountPaid
            }]);
        } else {
            setPartialPayments([]);
        }

        // Restore tier if it had one
        if (sale.priceTierId) {
            const tier = priceTiers.find(t => t.id === sale.priceTierId);
            if (tier) setSelectedTier(tier);
        } else {
            setSelectedTier(null);
        }

        // Restore Client if it had one
        if (sale.client) {
            setSelectedClient(sale.client);
        } else {
            setSelectedClient(null);
        }

        // Delete the suspended sale from DB since we are resuming it
        await deleteSuspendedSale(sale.id);
        
        setShowSuspendedModal(false);
        setIsReturnMode(false);
    };


    // Calcular total desde denominaciones
    const calcDenTotal = (counts: Record<string, string>, dens: any[]): number => {
        return dens.reduce((sum, d) => sum + (parseFloat(counts[d.id] || '0') || 0) * d.value, 0);
    };

    const handleOpenSession = async () => {
        const amount = parseFloat(cashAmount);
        if (isNaN(amount) || amount < 0) {
            toast.error("Ingrese un monto válido");
            return;
        }
        const res = await openCashSession(amount, selectedLocationId || undefined);
        if (res.success) {
            setCurrentSession(res.session);
            setShowOpenSessionModal(false);
            setCashAmount('');
        } else {
            toast.error(res.error || "No se pudo abrir la caja.");
        }
    };

    const handleAddMovement = async () => {
        if (!currentSession) return;
        const amount = parseFloat(cashAmount);
        if (isNaN(amount) || amount <= 0 || !cashReason) {
            toast.error("Complete los datos correctamente");
            return;
        }
        const res = await addCashMovement(currentSession.id, movementType, amount, cashReason);
        if (res.success) {
            setShowMovementModal(false);
            setCashAmount('');
            setCashReason('');
            // Reload session
            const updated = await getCurrentCashSession();
            setCurrentSession(updated);
            toast.success("Movimiento registrado");
        } else {
            toast.error(res.error || "No se pudo registrar el movimiento.");
        }
    };

    const handleCloseSession = async () => {
        if (!currentSession) return;
        const amount = parseFloat(cashAmount);
        if (isNaN(amount) || amount < 0) {
            toast.error("Ingrese el conteo real en caja");
            return;
        }
        const res = await closeCashSession(currentSession.id, amount);
        if (res.success) {
            setCurrentSession(null);
            setShowZReportModal(false);
            setCashAmount('');
            toast.success("Caja cerrada correctamente. Corte Z generado.");
        } else {
            toast.error(res.error || "No se pudo cerrar la caja.");
        }
    };

    const handleTransfer = async () => {
        if (!isTransferMode || cart.length === 0 || !transferSourceId || !transferDestId) return;
        
        if (transferSourceId === transferDestId) {
            toast.error("La sucursal de origen y destino no pueden ser la misma.");
            return;
        }

        const totalItems = cart.reduce((acc, item) => acc + (item.quantity || 0), 0);
        if (!confirm(`¿Estás seguro de transferir ${totalItems} artículos de la sucursal origen a la sucursal destino?`)) {
            return;
        }

        setIsProcessing(true);
        try {
            const res = await createTransfer(cart, transferSourceId, transferDestId);
            if (res.success) {
                toast.success("¡Traspaso completado exitosamente!");
                clearCartStorage();
                setCart([]);
                setTransferSourceId('');
                setTransferDestId('');
                setIsTransferMode(false);
            } else {
                toast.error(res.error || "Ocurrió un error al procesar el traspaso.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al procesar el traspaso.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePreviewSuspended = (sale: any) => {
        setLastSaleData({
            id: sale.id,
            receiptNumber: sale.receiptNumber,
            date: new Date(sale.createdAt),
            cart: sale.items.map((i: any) => ({
                name: `${i.variant.product.name} - ${i.variant.color} / ${i.variant.size}`,
                price: i.price,
                quantity: i.quantity
            })),
            total: sale.total,
            subtotal: sale.subtotal,
            discount: sale.discount,
            paymentMethodName: 'Cotización / Pendiente',
            tierName: sale.priceTier ? sale.priceTier.name : 'Precio Público',
            clientName: sale.client ? sale.client.name : 'Venta de Mostrador',
            isReturn: false,
            isLayaway: false,
            amountPaid: 0,
            balance: sale.total
        });
        setShowReceiptModal(true);
    };

    const handleShareWhatsApp = (sale: any) => {
        if (!sale.client) {
            toast.error("Esta venta no tiene un cliente asignado.");
            return;
        }
        
        let text = `Hola ${sale.client.name}, aquí está el detalle de tus artículos en pausa en Moda Zapotlanejo:\n\n`;
        sale.items.forEach((item: any) => {
            const v = item.variant;
            const variantLabel = formatVariantName(v);
            const variantStr = variantLabel ? ` — Talla ${variantLabel}` : '';
            text += `• ${v.product.name}${variantStr} (x${item.quantity}): $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        text += `\nTotal: $${sale.total.toFixed(2)}\n\n¡Te esperamos en nuestra sucursal!`;
        
        const encodedText = encodeURIComponent(text);
        // Fix regex for phone cleaning
        const cleanPhone = sale.client.phone ? sale.client.phone.replace(/\D/g, '') : '';
        const url = cleanPhone 
            ? `https://wa.me/${cleanPhone}?text=${encodedText}`
            : `https://wa.me/?text=${encodedText}`;
            
        window.open(url, '_blank');
    };

    const handleShareEmail = (sale: any) => {
        if (!sale.client || !sale.client.email) {
            toast.error("Este cliente no tiene un correo electrónico registrado.");
            return;
        }
        
        const subject = encodeURIComponent(`Cotización / Venta en Pausa - Moda Zapotlanejo`);
        let body = `Hola ${sale.client.name},\n\nTe enviamos el detalle de los productos que tienes seleccionados en nuestra tienda:\n\n`;
        sale.items.forEach((item: any) => {
            body += `• ${item.variant.product.name} (x${item.quantity}): $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        body += `\nTotal: $${sale.total.toFixed(2)}\n\nSi deseas concretar tu compra, visítanos pronto.\n\nModa Zapotlanejo`;
        
        const mailto = `mailto:${sale.client.email}?subject=${subject}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
    };

    // Actualizar stock de variantes en tiempo real cuando cambia en otra sucursal
    const handleInventoryChange = useCallback((change: { variantId: string; locationId: string; stock: number }) => {
        setSearchResults(prev => prev.map(product => ({
            ...product,
            variants: product.variants?.map((v: any) =>
                v.id === change.variantId ? { ...v, stock: change.stock } : v
            )
        })));
        setCategoryProducts(prev => prev.map(product => ({
            ...product,
            variants: product.variants?.map((v: any) =>
                v.id === change.variantId ? { ...v, stock: change.stock } : v
            )
        })));
        // Si el modal de variantes está abierto, actualizar también ahí
        if (selectedProduct) {
            setSelectedProduct((prev: any) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    variants: prev.variants?.map((v: any) =>
                        v.id === change.variantId ? { ...v, stock: change.stock } : v
                    )
                };
            });
        }
    }, [selectedProduct]);

    return (
        <div className="flex h-[calc(100dvh-64px)] bg-background text-foreground transition-colors duration-300 overflow-hidden font-sans text-sm relative">
            {/* Botón móvil para mostrar/ocultar panel de cobro */}
            <button
                className="fixed bottom-4 right-4 z-50 lg:hidden bg-blue-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl"
                onClick={() => setShowMobileRight(prev => !prev)}
            >
                {showMobileRight ? '✕' : '💰'}
            </button>

            {/* Lado Izquierdo: Principal */}
            <div className={`flex-1 flex flex-col p-4 gap-4 overflow-hidden border-r border-border ${showMobileRight ? 'hidden lg:flex' : 'flex'}`}>

                {/* Cuadrícula de Categorías (Opcional) */}
                {showGrid && (
                    <div className="bg-card p-4 rounded-2xl border border-border shadow-sm animate-in fade-in duration-200">
                        {!selectedCategory ? (
                            <>

                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={async () => {
                                                setSelectedCategory(cat);
                                                try {
                                                    const res = await getProductsByCategory(cat.id); 
                                                    setCategoryProducts(res);
                                                } catch (e) {
                                                    setCategoryProducts([]);
                                                }
                                            }}
                                            className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-border hover:border-blue-500 hover:shadow-lg transition-all h-28 flex flex-col items-center justify-center gap-2 group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🏷️</div>
                                            <span className="text-xs font-bold text-center line-clamp-1">{cat.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <button
                                        onClick={() => setSelectedCategory(null)}
                                        className="text-gray-500 hover:text-blue-500 text-xs font-bold flex items-center gap-1 uppercase tracking-wider"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                        Volver
                                    </button>
                                    <span className="bg-blue-600/10 text-blue-600 dark:text-blue-400 px-6 py-1.5 text-xs font-bold rounded-full uppercase tracking-wider">{selectedCategory.name}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {categoryProducts.length === 0 && (
                                        <div className="col-span-full text-center py-4 text-gray-400 font-bold text-xs uppercase tracking-widest">No hay productos en esta categoría</div>
                                    )}
                                    {categoryProducts.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => handleProductSelect(product)}
                                            className="bg-white dark:bg-gray-800/50 p-3 rounded-xl border border-border hover:border-blue-500 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-2 group"
                                        >
                                            <span className="text-xs font-bold text-center line-clamp-2 leading-tight">{product.name}</span>
                                            <span className="text-xs font-black text-blue-500">${product.price.toFixed(2)}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Indicadores de estado: Conexión + Ventas offline */}
                <div className="flex items-center justify-end gap-3 px-1">
                    {/* Ventas offline pendientes */}
                    {pendingCount > 0 && (
                        <button
                            onClick={syncPendingSales}
                            disabled={!isOnline || isSyncing}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black transition-all ${
                                isSyncing
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 animate-pulse'
                                    : isOnline
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 hover:bg-orange-200 cursor-pointer'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isSyncing ? (
                                <>
                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                    Sincronizando...
                                </>
                            ) : (
                                <>📤 {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</>
                            )}
                        </button>
                    )}
                    {/* Sin conexión — badge rojo cuando está offline */}
                    {!isOnline && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-red-50 dark:bg-red-900/20 text-red-500">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
                            Sin Conexión
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/10 rounded-full text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest hidden sm:flex border border-green-200/50 dark:border-green-800/30">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Catálogo: {offlineSyncTime || '00:00 p.m.'}
                    </div>

                    <InventoryRealtimeSync 
                        onInventoryChange={handleInventoryChange}
                        fetchInventory={async () => {
                            const results = await searchProducts('');
                            return results;
                        }}
                    />
                </div>

                {/* Barra de Búsqueda y Herramientas */}
                <div className="flex bg-card rounded-2xl shadow-sm border border-border relative z-20">
                    {/* Botón crear producto — visible para SELLER/ADMIN, y para cajeros con canCreateProducts */}
                    {(currentUser?.role !== 'CASHIER' || (currentUser as any)?.canCreateProducts) && (
                        <Link href="/products/new" title="Crear Nuevo Producto" className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-5 py-4 flex items-center justify-center transition-colors rounded-l-2xl">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </Link>
                    )}
                    <div className="flex-1 relative">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Buscar o escanear..."
                            className="w-full h-full px-3 sm:px-5 outline-none bg-transparent font-medium text-xs sm:text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {/* Search Dropdown Overlay */}
                        {searchResults.length > 0 && searchQuery && (
                            <div className="absolute top-full left-0 w-full bg-card border border-border rounded-b-2xl shadow-xl z-50 max-h-60 overflow-y-auto mt-1">
                                {searchResults.map(res => (
                                    <div
                                        key={res.id}
                                        className="p-4 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer border-b border-border flex justify-between items-center transition-colors"
                                        onClick={() => {
                                            handleProductSelect(res);
                                            setSearchQuery('');
                                            setSearchResults([]);
                                        }}
                                    >
                                        <div>
                                            <p className="font-bold text-foreground">{res.name}</p>
                                            {res.sku && <p className="text-[10px] font-mono text-blue-500 font-bold">{res.sku}</p>}
                                        </div>
                                        <span className="text-blue-500 font-bold shrink-0">${res.price}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative border-l border-border h-full flex shrink-0">
                        <button
                            onClick={() => setShowModeDropdown(!showModeDropdown)}
                            className={`px-3 sm:px-6 py-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs transition flex items-center justify-between gap-2 sm:gap-3 h-full min-w-0 sm:min-w-[160px] 
                                ${!isReturnMode && !isTransferMode ? 'text-green-500 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40' : 
                                  isReturnMode ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40' : 
                                  'text-purple-500 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40'}`}
                        >
                            <div className="flex items-center gap-2">
                                {!isReturnMode && !isTransferMode && (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                        <span>Venta</span>
                                    </>
                                )}
                                {isReturnMode && (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                        <span>Devolución</span>
                                    </>
                                )}
                                {isTransferMode && (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                        <span>Traspaso</span>
                                    </>
                                )}
                            </div>
                            <svg className={`w-4 h-4 transition-transform ${showModeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        
                        {showModeDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowModeDropdown(false)}></div>
                                <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-border animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button
                                        onClick={() => { setIsReturnMode(false); setIsTransferMode(false); setShowModeDropdown(false); }}
                                        className="w-full text-left px-4 py-4 text-xs font-bold uppercase tracking-wider text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                        Venta Activa
                                    </button>
                                    <button
                                        onClick={() => { setIsReturnMode(true); setIsTransferMode(false); setShowModeDropdown(false); }}
                                        className="w-full text-left px-4 py-4 text-xs font-bold uppercase tracking-wider text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-2 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                        Modo Devolución
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsTransferMode(true);
                                            setIsReturnMode(false);
                                            setShowModeDropdown(false);
                                            // Pre-seleccionar origen con la sucursal activa:
                                            // Si hay sesión abierta → usar su locationId
                                            // Si es cajero (sin sesión aún) → usar selectedLocationId
                                            // Si es admin seller sin sesión → dejar vacío
                                            const activeLocId = currentSession?.locationId
                                                || ((currentUser as any)?.role === 'CASHIER' ? selectedLocationId : '');
                                            if (activeLocId) setTransferSourceId(activeLocId);
                                        }}
                                        className="w-full text-left px-4 py-4 text-xs font-bold uppercase tracking-wider text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                        Modo Traspaso
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100 px-3 sm:px-6 py-4 font-bold uppercase tracking-wider text-[10px] sm:text-xs transition flex items-center gap-2 border-l border-border"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                        <span className="hidden sm:inline">{showGrid ? 'Ocultar Catálogo' : 'Catálogo'}</span>
                        <span className="sm:hidden">{showGrid ? 'H' : 'G'}</span>
                    </button>
                </div>

                {/* Tabla del Carrito */}
                <div className="flex-1 bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col mt-2">
                    {/* Cabecera del Carrito */}
                    <div className="bg-card border-b border-border p-4 lg:p-6 flex justify-between items-center shadow-sm shrink-0">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                {isReturnMode ? <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm">Modo Devolución</span> : 'Ticket Actual'}
                            </h2>
                            <span className="text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-border">
                                {(() => {
                                    const totalQty = cart.reduce((sum, item) => sum + Math.abs(item.quantity || 1), 0);
                                    return `${totalQty} ${totalQty === 1 ? 'artículo' : 'artículos'}`;
                                })()}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2 relative">
                            <div className="relative">
                                <button
                                    onClick={() => setShowTicketOptions(!showTicketOptions)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-border rounded-full text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center text-foreground"
                                >
                                    ••• Opciones
                                </button>
                                {showTicketOptions && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowTicketOptions(false)}></div>
                                        <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-border animate-in fade-in slide-in-from-top-2 duration-200">
                                            <Link href="/pos/peripherals" className="w-full text-left px-4 py-4 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors">
                                                🔌 Periféricos
                                            </Link>
                                            {(currentUser?.role === 'SELLER' || (currentUser as any)?.canOpenDrawer) && (
                                                <button onClick={() => { openCashDrawer('Manual'); toast.success('💰 Comando enviado a cajón'); setShowTicketOptions(false); }} className="w-full text-left px-4 py-4 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-3 transition-colors">
                                                    💰 Abrir cajón
                                                </button>
                                            )}
                                            <button onClick={() => { setShowTicketOptions(false); if (!currentSession) { setShowOpenSessionModal(true); } else { toast.info("La caja ya está abierta."); } }} className="w-full text-left px-4 py-4 text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-3 transition-colors">
                                                {currentSession ? '🔓 Caja Abierta' : '🪙 Abrir Caja'}
                                            </button>
                                            <button onClick={() => { setShowTicketOptions(false); if(currentSession) setShowMovementModal(true); else toast.warning("Abre la caja primero"); }} className="w-full text-left px-4 py-4 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3 transition-colors">
                                                ➕ Entrada / Salida
                                            </button>
                                            <button onClick={async () => { 
                                                setShowTicketOptions(false); 
                                                if (!currentSession) { toast.warning("Abre la caja primero"); return; }
                                                setLoadingTickets(true);
                                                setShowTodayTicketsModal(true);
                                                const sales = await getSalesBySession(currentSession.id);
                                                setTodayTickets(sales);
                                                setLoadingTickets(false);
                                            }} className="w-full text-left px-4 py-4 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-3 transition-colors">
                                                🖨️ Tickets del Día
                                            </button>
                                            <button onClick={() => { setShowTicketOptions(false); if(currentSession) { setDenCounts({}); setCashAmount(''); setShowZReportModal(true); } else toast.warning("Abre la caja primero"); }} className="w-full text-left px-4 py-4 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors">
                                                🧾 Corte Z
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            {suspendedSales.length > 0 && (
                                <button
                                    onClick={loadSuspendedSales}
                                    className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/30 px-4 py-2 rounded-xl border border-orange-200 dark:border-orange-900/30 transition-colors flex items-center gap-2"
                                >
                                    <span>⏱️</span>
                                    Ver Suspendidas
                                </button>
                            )}
                            {cart.length > 0 && (
                                <button
                                    onClick={() => {
                                        if(window.confirm("¿Seguro que deseas vaciar todo el carrito?")) { clearCartStorage(); setCart([]); }
                                    }}
                                    className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/30 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    Vaciar Carrito
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-gray-50/50 dark:bg-card/80 backdrop-blur-md">
                                <tr className="border-b border-border text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="p-4 w-12 text-center hidden sm:table-cell">Acción</th>
                                    <th className="p-4">Artículo</th>
                                    <th className="p-4 text-center hidden sm:table-cell">Precio Base</th>
                                    <th className="p-4 text-center">Cant</th>
                                    <th className="p-4 text-center hidden sm:table-cell">Descuento</th>
                                    <th className="p-4 text-right pr-6">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                            {cart.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-lg font-bold text-gray-400 uppercase tracking-widest opacity-50">
                                        <div className="text-4xl mb-4">🛒</div>
                                        El carrito está vacío
                                    </td>
                                </tr>
                            )}
                            {cart.map((item, idx) => {
                                let itemDiscountStr = "0%";
                                let itemDiscountedPrice = item.price;
                                
                                if (selectedTier) {
                                    if (selectedTier.discountPercentage > 0) {
                                        itemDiscountStr = `-${selectedTier.discountPercentage}%`;
                                        itemDiscountedPrice = item.price * (1 - (selectedTier.discountPercentage / 100));
                                    } else if (selectedTier.defaultPriceMinusFixed > 0) {
                                        itemDiscountStr = `-$${selectedTier.defaultPriceMinusFixed}`;
                                        itemDiscountedPrice = item.price - selectedTier.defaultPriceMinusFixed;
                                    }
                                }

                                const rowTotal = itemDiscountedPrice * (item.quantity || 0);

                                return (
                                    <tr key={idx} className="border-b border-border/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="p-4 text-center hidden sm:table-cell">
                                            <button onClick={() => removeFromCart(idx)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            </button>
                                        </td>
                                        <td className="p-4 font-bold text-foreground">
                                            <div className="flex flex-col gap-1">
                                                <span className="truncate max-w-[120px] sm:max-w-none">{item.name}</span>
                                                {isReturnMode && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase text-[8px] w-fit">Dev</span>}
                                                <button onClick={() => removeFromCart(idx)} className="text-red-500 text-[9px] font-bold uppercase sm:hidden w-fit">Eliminar</button>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center text-blue-500 font-medium hidden sm:table-cell">
                                            <div className="flex items-center justify-center gap-1">
                                                <span>$</span>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    step="0.01"
                                                    value={item.price === 0 ? '' : item.price}
                                                    onChange={(e) => updateItemPrice(idx, parseFloat(e.target.value) || 0)}
                                                    className="w-20 px-1 py-1 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 border-b border-dashed border-blue-300 dark:border-blue-700/50 focus:border-blue-500 outline-none text-center font-bold transition-colors rounded-t-sm"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 text-center text-foreground font-medium">
                                            <input 
                                                type="number" 
                                                value={Number.isNaN(item.quantity) ? '' : item.quantity}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value, 10);
                                                    updateItemQuantity(idx, val);
                                                }}
                                                className="w-12 sm:w-16 px-1 py-1 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none text-center font-bold transition-colors rounded-t-sm"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="p-4 text-center hidden sm:table-cell">
                                            <span className={`font-black text-[10px] px-2 py-1 rounded-full ${itemDiscountStr !== '0%' ? 'bg-green-100 text-green-700' : 'text-gray-400'}`}>
                                                {itemDiscountStr}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            <span className="text-foreground font-black text-xs sm:text-sm">${rowTotal.toFixed(2)}</span>
                                            {itemDiscountStr !== '0%' && (
                                                <span className="block text-[10px] text-gray-400 line-through">${(item.price * item.quantity).toFixed(2)}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>

            {/* Lado Derecho: Controles y Totales */}
            <div className={`${
                showMobileRight ? 'fixed inset-0 z-40 flex' : 'hidden lg:flex'
            } lg:relative lg:inset-auto lg:z-auto w-full lg:w-[420px] bg-gray-50 dark:bg-gray-900/30 flex-col overflow-y-auto`}>
                <div className="p-6 space-y-6">

                    {/* Controles top */}
                    <div className="flex gap-3">
                        <label className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm text-foreground text-xs font-bold flex-1 cursor-pointer hover:border-blue-500 transition-colors">
                            <input
                                type="checkbox"
                                checked={useVariationSelector}
                                onChange={(e) => setUseVariationSelector(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            Mostrar Selector de Tallas
                        </label>
                        {cart.length > 0 && (
                            <button 
                                onClick={() => handleSuspendSale()}
                                disabled={isProcessing}
                                className="flex-1 bg-orange-100/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-900/30 dark:bg-orange-900/10 rounded-xl shadow-sm hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-all text-xs font-bold flex items-center justify-center gap-2"
                            >
                                <span className="text-sm">⏸</span> Suspender Venta
                            </button>
                        )}
                    </div>

                    {/* Suspended Sales Modal */}
            {/* Modal — Nota para suspender sin cliente */}
            {showSuspendNoteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl border border-border overflow-hidden">
                        <div className="p-6 border-b border-border">
                            <h3 className="text-lg font-black text-foreground">Suspender Venta</h3>
                            <p className="text-sm text-gray-500 mt-1">Sin cliente asignado. Agrega una nota breve para identificar esta venta.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea
                                autoFocus
                                value={suspendNote}
                                onChange={e => setSuspendNote(e.target.value)}
                                placeholder="Ej: Señora de azul, cliente esperando cambio, Mesa 3..."
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-gray-400 focus:ring-2 focus:ring-orange-400/50 outline-none resize-none"
                                rows={3}
                                maxLength={120}
                            />
                            <p className="text-[10px] text-gray-400 text-right">{suspendNote.length}/120</p>
                        </div>
                        <div className="p-6 pt-0 flex gap-3">
                            <button
                                onClick={() => setShowSuspendNoteModal(false)}
                                className="flex-1 py-3 border border-border rounded-xl font-black uppercase tracking-wider text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (!suspendNote.trim()) {
                                        toast.warning('Escribe una nota breve para identificar la venta');
                                        return;
                                    }
                                    setShowSuspendNoteModal(false);
                                    handleSuspendSale(suspendNote.trim());
                                }}
                                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase tracking-wider text-xs transition"
                            >
                                Suspender
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSuspendedModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
                    <div className="bg-card w-full max-w-4xl rounded-3xl shadow-xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl">
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Ventas Suspendidas</h3>
                                <p className="text-sm text-gray-500">Recupera carritos que quedaron en pausa</p>
                            </div>
                            <button onClick={() => setShowSuspendedModal(false)} className="text-gray-400 hover:text-red-500 transition-colors text-2xl font-bold">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {suspendedSales.length === 0 ? (
                                <div className="text-center text-gray-400 py-12">
                                    <span className="text-6xl mb-4 block">☕</span>
                                    <p className="font-bold">No hay ventas en pausa en tu sucursal.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full content-start">
                                    {suspendedSales.map((sale) => (
                                        <div key={sale.id} className="border border-border rounded-xl p-4 bg-gray-50 dark:bg-gray-900 flex flex-col">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1 min-w-0">
                                                    {/* Identificador principal: cliente o nota */}
                                                    {sale.client ? (
                                                        <p className="text-sm font-black text-blue-600 flex items-center gap-1">
                                                            👤 {sale.client.name}
                                                        </p>
                                                    ) : sale.notes ? (
                                                        <p className="text-sm font-black text-orange-600 flex items-center gap-1 truncate" title={sale.notes}>
                                                            📝 {sale.notes}
                                                        </p>
                                                    ) : (
                                                        <p className="text-sm font-bold text-gray-400">Sin identificar</p>
                                                    )}
                                                    <p className="text-xs text-gray-500 mt-0.5">{new Date(sale.createdAt).toLocaleString()}</p>
                                                </div>
                                                <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-[10px] font-bold">
                                                    {sale.items.reduce((s: number, i: any) => s + i.quantity, 0)} articulos
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400 border-l-2 border-orange-400 pl-3 mb-4 flex-1 max-h-40 overflow-y-auto pr-2">
                                                <ul className="space-y-1">
                                                    {sale.items.map((item: any, idx: number) => (
                                                        <li key={idx} className="truncate">• {item.variant.product.name} <span className="text-[10px] font-bold opacity-60">[{item.variant.color} - {item.variant.size}]</span> (x{item.quantity})</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="flex items-center justify-between mt-auto border-t border-border pt-3">
                                                <span className="font-black text-lg text-green-600">${sale.total.toFixed(2)}</span>
                                                <div className="flex gap-2">
                                                    {sale.client && (
                                                        <div className="flex gap-1">
                                                            <button 
                                                                onClick={() => handleShareWhatsApp(sale)}
                                                                className="p-1.5 text-green-600 hover:bg-green-100 rounded-md font-bold transition-colors"
                                                                title="WhatsApp"
                                                            >
                                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                                            </button>
                                                            {sale.client.email && (
                                                                <button 
                                                                    onClick={() => handleShareEmail(sale)}
                                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md font-bold transition-colors"
                                                                    title="Email"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <button 
                                                        onClick={() => handlePreviewSuspended(sale)}
                                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-md font-bold transition-colors"
                                                        title="Ver / Imprimir Ticket"
                                                    >
                                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0v-2.94a2.25 2.25 0 0 1 2.25-2.25h6a2.25 2.25 0 0 1 2.25 2.25v2.94ZM15 15h.008v.008H15V15Z" />
                                                        </svg>
                                                    </button>
                                                    {/* Solo SELLER y ADMIN pueden descartar */}
                                                    {(currentUser?.role === 'SELLER' || currentUser?.role === 'ADMIN') && (
                                                        <button 
                                                            onClick={async () => {
                                                                if(window.confirm("¿Seguro que deseas eliminar permanentemente esta venta?")) {
                                                                    await deleteSuspendedSale(sale.id);
                                                                    setSuspendedSales(suspendedSales.filter((s: any) => s.id !== sale.id));
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md font-bold transition-colors"
                                                        >
                                                            Descartar
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => resumeSuspendedSale(sale)}
                                                        className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow flex flex-center gap-1 shrink-0"
                                                    >
                                                        <span>▶</span> Reanudar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
                    {/* Cliente o Sucursal Origen/Destino */}
                    {!isTransferMode ? (
                        <>
                            {/* Cliente */}
                            <div className="flex bg-card border border-border rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500/50 transition-all relative z-20">
                        {selectedClient ? (
                            <div className="w-full flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
                                        {selectedClient.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100">{selectedClient.name}</p>
                                        <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                            Crédito: ${selectedClient.storeCredit?.toFixed(2) || '0.00'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={async () => {
                                            setShowClientHistory(true);
                                            setLoadingHistory(true);
                                            const res = await getClientById(selectedClient.id);
                                            setClientHistoryData(res.success ? res.client : null);
                                            setLoadingHistory(false);
                                        }}
                                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2 py-1 rounded-lg transition-colors text-[10px] font-black uppercase tracking-wide"
                                        title="Ver historial de compras"
                                    >
                                        Historial
                                    </button>
                                    <button
                                        onClick={() => setSelectedClient(null)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/40 p-1.5 rounded-full transition-colors"
                                        title="Remover Cliente"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => setShowClientModal(true)}
                                    className="bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-blue-500 p-3 flex items-center justify-center transition-colors border-r border-border rounded-l-xl"
                                    title="Añadir Nuevo Cliente"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                                </button>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar Cliente Registrado..."
                                        value={clientSearchQuery}
                                        onChange={(e) => setClientSearchQuery(e.target.value)}
                                        className="w-full h-full px-4 outline-none text-sm bg-transparent font-medium"
                                    />
                                    {clientSearchResults.length > 0 && clientSearchQuery && (
                                        <div className="absolute top-full left-0 w-full bg-card border border-border rounded-b-xl shadow-lg z-50 max-h-40 overflow-y-auto mt-1">
                                            {clientSearchResults.map(client => (
                                                <div
                                                    key={client.id}
                                                    className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/60 cursor-pointer border-b border-border flex flex-col transition-colors group"
                                                    onClick={() => {
                                                        setSelectedClient(client);
                                                        setClientSearchQuery('');
                                                        setClientSearchResults([]);
                                                    }}
                                                >
                                                    <span className="font-bold text-sm text-gray-700 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-white transition-colors">{client.name}</span>
                                                    <span className="text-xs text-gray-500 font-medium">Crédito: ${(client.storeCredit || 0).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Vendedor de piso */}
                    {salespersons.length > 1 && (
                        <div className={`bg-card border rounded-xl shadow-sm overflow-hidden ${requireSalesperson && !selectedSalesperson ? 'border-orange-400 dark:border-orange-500' : 'border-border'}`}>
                            {requireSalesperson && !selectedSalesperson && (
                                <p className="px-4 pt-2 text-[10px] font-black uppercase tracking-widest text-orange-500">⚠ Requerido — elige un vendedor</p>
                            )}
                            {selectedSalesperson ? (
                                <div className="flex items-center justify-between px-4 py-2 bg-purple-50 dark:bg-purple-900/20">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold text-sm">
                                            {selectedSalesperson.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-purple-500">Vendedor</p>
                                            <p className="text-sm font-bold text-purple-900 dark:text-purple-100">{selectedSalesperson.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSalesperson(null)}
                                        className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
                                        title="Quitar vendedor"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            ) : (
                                <select
                                    value=""
                                    onChange={(e) => {
                                        const sp = salespersons.find(s => s.id === e.target.value);
                                        setSelectedSalesperson(sp || null);
                                    }}
                                    className="w-full px-4 py-3 bg-transparent outline-none text-sm font-medium text-gray-500 cursor-pointer"
                                >
                                    <option value="">{requireSalesperson ? '— Seleccionar Vendedor (obligatorio) —' : '— Asignar Vendedor (opcional) —'}</option>
                                    {salespersons.map(sp => (
                                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Niveles */}
                    <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
                        <div className="flex flex-col gap-2 pb-4 border-b border-border">
                            <span className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Nivel de Precio Aplicado</span>
                            <select
                                value={selectedTier?.id || ''}
                                onChange={(e) => setSelectedTier(priceTiers.find(t => t.id === e.target.value) || null)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-lg outline-none font-bold text-sm cursor-pointer hover:border-blue-500 transition-colors"
                            >
                                <option value="">Precio Público General</option>
                                {priceTiers.map(tier => (
                                    <option key={tier.id} value={tier.id}>
                                        {tier.name} ({tier.discountPercentage ? `-${tier.discountPercentage}%` : `-$${tier.defaultPriceMinusFixed} fijo`})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => { setDiscountType('percent'); setShowDiscountModal(true); }}
                            className="w-full py-2 text-[10px] uppercase font-bold tracking-wider text-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                            Descuento Manual (% o $)
                        </button>
                    </div>
                    </>
                ) : (
                    <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
                            <h3 className="text-xl font-black text-foreground mb-4">Traspaso de Inventario</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Sucursal de Origen (Sale)</label>
                                    <select
                                        value={transferSourceId}
                                        onChange={(e) => setTransferSourceId(e.target.value)}
                                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-lg outline-none font-bold text-sm"
                                    >
                                        <option value="">-- Seleccionar Origen --</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="flex justify-center -my-2 relative z-10">
                                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center border-4 border-card">⬇️</div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Sucursal de Destino (Entra)</label>
                                    <select
                                        value={transferDestId}
                                        onChange={(e) => setTransferDestId(e.target.value)}
                                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-border rounded-lg outline-none font-bold text-sm"
                                    >
                                        <option value="">-- Seleccionar Destino --</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Totales */}
                    {!isTransferMode ? (
                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/5">
                            <div className="flex justify-between items-center p-4 text-sm bg-gray-50 dark:bg-gray-800/50 border-b border-border">
                                <span className="text-gray-500 font-bold uppercase tracking-wider text-xs">Subtotal</span>
                                <span className="text-foreground font-bold">${calculateSubtotal().toFixed(2)}</span>
                            </div>
                            {selectedTier && (selectedTier.discountPercentage > 0 || selectedTier.defaultPriceMinusFixed > 0) && (
                                <div className="flex justify-between items-center px-4 py-2 text-sm bg-gray-50 dark:bg-gray-800/20 border-b border-border text-green-500">
                                    <span className="font-bold uppercase tracking-wider text-xs">Ahorro ({selectedTier.name})</span>
                                    <span className="font-bold">
                                        -${selectedTier.discountPercentage 
                                            ? (calculateSubtotal() * (selectedTier.discountPercentage / 100)).toFixed(2) 
                                            : (cart.reduce((sum, item) => sum + (item.quantity || 0), 0) * selectedTier.defaultPriceMinusFixed).toFixed(2)
                                        }
                                    </span>
                                </div>
                            )}
                            {globalDiscount && (
                                <div className="flex justify-between items-center px-4 py-2 text-sm bg-gray-50 dark:bg-gray-800/20 border-b border-border text-orange-500">
                                    <span className="font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                                        Dcto Manual {globalDiscount.type === 'percent' ? `(${globalDiscount.value}%)` : '($)'}
                                        <button onClick={() => setGlobalDiscount(null)} className="hover:text-red-500 bg-orange-100 dark:bg-orange-900/50 w-5 h-5 rounded-full flex items-center justify-center text-lg ml-1 opacity-70 hover:opacity-100 transition-opacity pb-1">×</button>
                                    </span>
                                    <span className="font-bold">
                                        -${globalDiscount.type === 'percent'
                                            ? (calculateSubtotal() * (globalDiscount.value / 100)).toFixed(2)
                                            : globalDiscount.value.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            <div className="p-6 text-center space-y-2">
                                <p className="text-gray-400 font-black text-xs uppercase tracking-widest text-left">Total a Cobrar</p>
                                <p className="text-5xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">${calculateTotal().toFixed(2)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-6 text-center space-y-2">
                                <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Total de Artículos a Transferir</p>
                                <p className="text-5xl font-black text-purple-600 dark:text-purple-400 tracking-tighter">
                                    {cart.reduce((acc, item) => acc + (item.quantity || 0), 0)}
                                </p>
                            </div>
                        </div>
                    )}

                    {!isTransferMode && (
                        <>
                            {/* Operaciones de Caja movidas a Opciones superiores */}

                    <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Método de Pago</p>

                        {/* Input de Efectivo / Abono — ARRIBA del grid para verlo de inmediato */}
                        {!isReturnMode && calculateBalance() > 0 && (
                            <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-sm">$</span>
                                    <input
                                        ref={paymentInputRef}
                                        type="number"
                                        placeholder={`Abonar (Faltan ${formatCurrency(calculateBalance())})`}
                                        className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-card border-2 border-blue-400 dark:border-blue-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-black"
                                        value={receivedAmount}
                                        onChange={(e) => setReceivedAmount(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddPartialPayment()}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleAddPartialPayment}
                                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 shrink-0"
                                >
                                    + Agregar
                                </button>
                            </div>
                        )}

                        {/* Cambio */}
                        {!isReturnMode && calculateBalance() === 0 && selectedPaymentMethod?.toLowerCase().includes('efectivo') && parseFloat(receivedAmount) > 0 && (
                            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Cambio</span>
                                <span className="text-lg font-black text-emerald-600">{formatCurrency(parseFloat(receivedAmount) - calculateTotal())}</span>
                            </div>
                        )}

                        {/* Grid de métodos de pago — botones más compactos */}
                        <div className="grid grid-cols-3 gap-1.5">
                            {paymentMethods.map((method) => {
                                const lowerName = method.name.toLowerCase();
                                // Logo-based brands
                                let logoSrc: string | null = null;
                                if (lowerName.includes('clip')) logoSrc = '/logos/clip.svg';
                                else if (lowerName.includes('zettle') || lowerName.includes('paypal') || lowerName.includes('izettle')) logoSrc = '/logos/paypal.svg';
                                else if (lowerName.includes('ualabis') || lowerName.includes('ualá') || lowerName.includes('uala bis')) logoSrc = '/logos/ualabis.svg';
                                // Emoji fallbacks for non-branded methods
                                let icon = '💳';
                                if (lowerName.includes('efectivo') || lowerName.includes('cash')) icon = '💵';
                                else if (lowerName.includes('transferencia') || lowerName.includes('deposito') || lowerName.includes('depósito') || lowerName.includes('spei')) icon = '🏦';

                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => {
                                            setSelectedPaymentMethod(method.name);
                                            const isEfectivo = method.name.toLowerCase().includes('efectivo') || method.type === 'CASH';
                                            if (!isEfectivo && calculateBalance() > 0) {
                                                setReceivedAmount(calculateBalance().toFixed(2));
                                            } else if (isEfectivo) {
                                                setReceivedAmount('');
                                            }
                                        }}
                                        className={`px-2 py-2.5 text-xs font-bold rounded-xl border transition-all flex flex-col items-center justify-center gap-1 min-h-[62px] ${selectedPaymentMethod === method.name ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-500 shadow-sm' : 'bg-card text-gray-500 border-border hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                    >
                                        {logoSrc ? (
                                            <img
                                                src={logoSrc}
                                                alt={method.name}
                                                className="h-7 w-7 object-contain rounded-md shrink-0"
                                                draggable={false}
                                            />
                                        ) : (
                                            <span className="text-lg shrink-0">{icon}</span>
                                        )}
                                        <span className="text-[8px] uppercase tracking-tight text-center leading-[1.1] break-words line-clamp-2 w-full">{method.name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Modo devolución: mostrar monto a devolver */}
                        {isReturnMode && calculateTotal() > 0 && (
                            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl space-y-2 animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black uppercase tracking-widest text-orange-700 dark:text-orange-400">💰 Monto a devolver</span>
                                    <span className="text-xl font-black text-orange-600">{formatCurrency(calculateTotal())}</span>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400 font-bold">$</span>
                                    <input type="number" placeholder={calculateTotal().toFixed(2)}
                                        className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-card border border-orange-200 dark:border-orange-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-400 outline-none"
                                        value={receivedAmount}
                                        onChange={e => setReceivedAmount(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>
                    </>
                )}

                    <div className="p-6 border-t border-border bg-gray-50/50 dark:bg-black/20 space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">Subtotal</span>
                            <span className="font-bold text-foreground">{formatCurrency(calculateSubtotal())}</span>
                        </div>
                        {calculateSubtotal() !== calculateTotal() && (
                            <div className="flex justify-between items-center text-sm text-red-500">
                                <span className="font-medium">Descuento</span>
                                <span className="font-bold">-{formatCurrency(calculateSubtotal() - calculateTotal())}</span>
                            </div>
                        )}

                        {/* Lista de Abonos */}
                        {partialPayments.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-dashed border-border">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Abonos Realizados</p>
                                {partialPayments.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs bg-white dark:bg-card p-2 rounded-lg border border-border shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-blue-600">{p.method}</span>
                                            <span className="font-black">{formatCurrency(p.amount)}</span>
                                        </div>
                                        <button onClick={() => handleRemovePartialPayment(i)} className="text-gray-400 hover:text-red-500 font-bold px-1">×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2">
                            <span className="text-lg font-black text-foreground uppercase tracking-tight">Total a Pagar</span>
                            <span className="text-2xl font-black text-blue-600 tracking-tighter">{formatCurrency(calculateTotal())}</span>
                        </div>

                        {partialPayments.length > 0 && (
                            <div className="flex justify-between items-center pt-1 text-emerald-600">
                                <span className="text-sm font-bold uppercase">Restante</span>
                                <span className="text-lg font-black">{formatCurrency(calculateBalance())}</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            if (isTransferMode) {
                                handleTransfer();
                                return;
                            }
                            if (!currentSession) {
                                toast.warning("Debe abrir la caja primero antes de realizar ventas.");
                                setShowOpenSessionModal(true);
                                return;
                            }
                            handleProcessSale();
                        }}
                        disabled={
                            cart.length === 0 || 
                            isProcessing || 
                            (!isTransferMode && !currentSession) ||
                            (isTransferMode && (!transferSourceId || !transferDestId)) || 
                            (!isReturnMode && !isTransferMode && calculateBalance() > 0 && (parseFloat(receivedAmount) || 0) < calculateBalance())
                        }
                        className={`w-full py-5 font-black rounded-2xl shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none uppercase tracking-widest relative overflow-hidden ${isTransferMode ? 'bg-purple-600 text-white' : 'bg-foreground text-background dark:bg-white dark:text-black'}`}
                    >
                        {isProcessing ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Procesando...
                            </span>
                        ) : isTransferMode ? (
                            'Completar Traspaso'
                        ) : editSaleId ? (
                            'Guardar Cambios'
                        ) : (
                            `Procesar ${isReturnMode ? 'Devolución' : 'Venta'}`
                        )}
                    </button>

                    <div className="pt-2 pb-6 px-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 text-center">Teclas de acceso rápido</p>
                        <div className="grid grid-cols-2 gap-1">
                            {[
                                { key: 'F1', label: 'Refrescar página' },
                                { key: 'F2', label: 'Buscar producto' },
                                { key: 'F3', label: 'Agregar cliente' },
                                { key: 'F7', label: 'Campo de pago' },
                            ].map(({ key, label }) => (
                                <div key={key} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1">
                                    <span className="shrink-0 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[9px] font-black rounded px-1.5 py-0.5 shadow-sm">{key}</span>
                                    <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium truncate">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Variación (Estilo Tabular pero con UI Premium) */}
            {showVariationModal && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 flex-1">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-foreground">Asignación de Tallas</h3>
                                <p className="text-sm font-medium text-gray-500">{selectedProduct.name}</p>
                            </div>
                            <button
                                onClick={() => setShowVariationModal(false)}
                                className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold text-gray-500"
                            >×</button>
                        </div>

                        {/* Body */}
                        <div className="p-8 overflow-y-auto flex-1 min-h-0">
                            {!singleVariantMode ? (
                                // MODO TABULAR (MAYOREO / MÚLTIPLE)
                                <>
                                    <div className="flex items-center gap-4 mb-8 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                        <div className="text-2xl">🏷️</div>
                                        <div className="flex-1 flex flex-col">
                                            <label className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">Fijar precio para todas las tallas simultáneamente</label>
                                            <input
                                                type="number"
                                                placeholder="Ej. 199.99"
                                                value={bulkPrice}
                                                onChange={(e) => handleBulkPriceChange(e.target.value)}
                                                className="w-full md:w-1/2 border-2 border-transparent focus:border-blue-500 rounded-xl px-4 py-2 outline-none font-bold text-foreground bg-white dark:bg-gray-800 shadow-sm transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Métodos de mayoreo removidos del selector de tallas
                                         En el selector de tallas se captura precio y cantidades manual
                                         Los botones de corrida/paquete están disponibles SIN el selector de tallas */}

                                    <div className="border border-border rounded-2xl overflow-x-auto shadow-sm">
                                        <table className="w-full text-left text-sm min-w-[500px]">
                                            <thead>
                                                <tr className="border-b border-border bg-gray-50 dark:bg-gray-800/50 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                                                    <th className="py-4 px-6">Variante</th>
                                                    <th className="py-4 px-6 w-40 text-center">Cantidad a Llevar</th>
                                                    <th className="py-4 px-6 w-32 text-right">Precio Unit.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {sortVariants(selectedProduct.variants).map((v: any) => (
                                                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                                        <td className="py-3 px-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-black shrink-0">{formatVariantName(v)}</div>
                                                                <div>
                                                                    <p className="text-[10px] uppercase tracking-wider text-gray-600 dark:text-gray-300 font-bold">{v.stock} disponibles</p>
                                                                    {v.inventoryLevels && v.inventoryLevels.length > 1 && (
                                                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                                                            {v.inventoryLevels.map((il: any) => (
                                                                                <span key={il.location.id} className="text-[10px] font-bold text-gray-500 leading-tight">
                                                                                    {il.stock} pz · {il.location.name}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-6 text-center">
                                                            <div className="inline-flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                                                <button
                                                                    onClick={() => setVariationInputs({ ...variationInputs, [v.id]: { ...variationInputs[v.id], quantity: Math.max(0, (variationInputs[v.id]?.quantity || 0) - 1) } })}
                                                                    className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 shadow-sm font-bold border border-border flex items-center justify-center hover:bg-gray-50 transition-colors"
                                                                >-</button>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={variationInputs[v.id]?.quantity || ''}
                                                                    onChange={(e) => setVariationInputs({ ...variationInputs, [v.id]: { ...variationInputs[v.id], quantity: parseInt(e.target.value) || 0 } })}
                                                                    className="w-12 text-center bg-transparent outline-none font-bold text-foreground"
                                                                />
                                                                <button
                                                                    onClick={() => setVariationInputs({ ...variationInputs, [v.id]: { ...variationInputs[v.id], quantity: (variationInputs[v.id]?.quantity || 0) + 1 } })}
                                                                    className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 shadow-sm font-bold border border-border flex items-center justify-center hover:bg-gray-50 transition-colors"
                                                                >+</button>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-6">
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                                <input
                                                                    type="number"
                                                                    value={variationInputs[v.id]?.price || ''}
                                                                    onChange={(e) => setVariationInputs({ ...variationInputs, [v.id]: { ...variationInputs[v.id], price: parseFloat(e.target.value) || 0 } })}
                                                                    className="w-full pl-7 pr-3 py-2 border border-border focus:border-blue-500 rounded-xl outline-none bg-white dark:bg-gray-800 font-bold transition-all text-right"
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                // MODO SIMPLE (BOTONES DE SELECCIÓN RÁPIDA)
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {sortVariants(selectedProduct.variants).map((v: any) => (
                                        <button
                                            key={v.id}
                                            onClick={() => handleSingleVariantSelect(v)}
                                            className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${v.stock > 0 ? 'bg-white dark:bg-gray-800 border-border hover:border-blue-500 hover:shadow-md' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-300 dark:border-orange-700 hover:border-orange-500 hover:shadow-md'}`}
                                        >
                                            <span className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2 font-black text-xs mb-2">{formatVariantName(v)}</span>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${v.stock > 0 ? 'text-gray-400' : 'text-orange-500'}`}>{v.stock} pz</span>
                                            {v.inventoryLevels && v.inventoryLevels.length > 1 && (
                                                <div className="mt-1.5 flex flex-col gap-0.5 w-full">
                                                    {v.inventoryLevels.map((il: any) => (
                                                        <span key={il.location.id} className="text-[10px] font-bold text-gray-500 leading-tight truncate">
                                                            {il.stock} · {il.location.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer - Solo visible en modo Múltiple */}
                        {!singleVariantMode && (
                            <div className="p-6 border-t border-border bg-gray-50/50 dark:bg-gray-900/50 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                                <p className="text-sm font-bold text-gray-500">
                                    Total artículos seleccionados: <span className="text-foreground">{Object.values(variationInputs).reduce((acc: any, val: any) => acc + (val.quantity || 0), 0) as number}</span>
                                </p>
                                <div className="flex gap-3 w-full md:w-auto">
                                    <button
                                        onClick={() => setShowVariationModal(false)}
                                        className="flex-1 md:flex-none px-6 py-3 bg-white dark:bg-gray-800 border border-border text-foreground font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={saveVariationsToCart}
                                        className="flex-1 md:flex-none px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 rounded-xl transition font-black uppercase tracking-wider flex items-center justify-center gap-2"
                                    >
                                        Agregar al Carrito
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Nuevo Cliente */}
            {showClientModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h3 className="text-xl font-black text-foreground">Nuevo Cliente</h3>
                                <p className="text-sm font-medium text-gray-500">Registro rápido</p>
                            </div>
                            <button
                                onClick={() => setShowClientModal(false)}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold text-gray-500"
                            >×</button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Nombre Completo *</label>
                                <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Ej: Juan Pérez" className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground placeholder:text-gray-400" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Teléfono (WhatsApp)</label>
                                <input type="tel" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} placeholder="10 dígitos" className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground placeholder:text-gray-400" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Correo Electrónico</label>
                                <input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="cliente@correo.com" className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground placeholder:text-gray-400" />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-border bg-gray-50/50 dark:bg-gray-900/50 flex flex-col md:flex-row gap-3">
                            <button
                                onClick={() => setShowClientModal(false)}
                                className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-border text-foreground font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (!newClientName) {
                                        toast.error("El nombre es requerido");
                                        return;
                                    }
                                    setIsProcessing(true);
                                    const res = await createClient({ name: newClientName, phone: newClientPhone, email: newClientEmail });
                                    setIsProcessing(false);
                                    if (res.success) {
                                        setSelectedClient(res.client);
                                        setShowClientModal(false);
                                        setNewClientName('');
                                        setNewClientPhone('');
                                        setNewClientEmail('');
                                    } else {
                                        toast.error(res.error || "Ocurrió un error al crear el cliente.");
                                    }
                                }}
                                disabled={isProcessing}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 rounded-xl transition font-black uppercase tracking-wider disabled:opacity-50"
                            >
                                {isProcessing ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Descuento Manual */}
            {showDiscountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h3 className="text-xl font-black text-foreground">Aplicar Descuento</h3>
                                <p className="text-sm font-medium text-gray-500">Total o porcentaje manual</p>
                            </div>
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold text-gray-500"
                            >×</button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
                                <button
                                    onClick={() => setDiscountType('percent')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${discountType === 'percent' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-foreground'}`}
                                >Porcentaje %</button>
                                <button
                                    onClick={() => setDiscountType('fixed')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${discountType === 'fixed' ? 'bg-white dark:bg-gray-700 text-green-600 shadow-sm' : 'text-gray-500 hover:text-foreground'}`}
                                >Monto Fijo $</button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                                    {discountType === 'percent' ? 'Porcentaje de descuento' : 'Monto a descontar'}
                                </label>
                                <div className="relative">
                                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black ${discountType === 'percent' ? 'text-blue-500' : 'text-green-500'}`}>
                                        {discountType === 'percent' ? '%' : '$'}
                                    </span>
                                    <input
                                        type="number"
                                        placeholder="Ej: 10"
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        className="w-full pl-10 pr-4 py-4 text-xl font-black bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground placeholder:text-gray-400"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-border bg-gray-50/50 dark:bg-gray-900/50 flex flex-col md:flex-row gap-3">
                            <button
                                onClick={() => setShowDiscountModal(false)}
                                className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-border text-foreground font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const val = parseFloat(discountValue);
                                    if (!isNaN(val) && val > 0) {
                                        setGlobalDiscount({ type: discountType, value: val });
                                    } else {
                                        setGlobalDiscount(null);
                                    }
                                    setShowDiscountModal(false);
                                    setDiscountValue('');
                                }}
                                className={`flex-1 px-4 py-3 ${discountType === 'percent' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' : 'bg-green-600 hover:bg-green-700 shadow-green-500/30'} text-white shadow-lg rounded-xl transition font-black uppercase tracking-wider`}
                            >
                                Aplicar Dcto.
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Abrir Caja */}
            {/* Modal — Sesión abierta por otro cajero */}
            {showOtherCashierModal && otherCashierSession && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border bg-orange-50 dark:bg-orange-900/20">
                            <h3 className="text-xl font-black text-foreground">⚠️ Caja en uso</h3>
                            <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mt-1">
                                {otherCashierSession.openedBy?.name || 'Otro cajero'} tiene esta caja abierta.
                            </p>
                        </div>
                        <div className="p-6 space-y-3 text-sm text-gray-600 dark:text-gray-400 font-medium">
                            <p>
                                <span className="font-black text-foreground">{otherCashierSession.openedBy?.name || 'Otro cajero'}</span> tiene una caja abierta en esta sucursal.
                                Puedes abrir tu propia sesión independiente.
                            </p>
                            {(currentUser?.role === 'SELLER' || currentUser?.role === 'ADMIN') && (
                                <p className="text-xs text-gray-400">Como administrador también puedes tomar la sesión existente si el cajero olvidó cerrar.</p>
                            )}
                        </div>
                        <div className="p-6 border-t border-border flex flex-col gap-3">
                            {/* Cualquier usuario puede abrir su propia sesión paralela */}
                            <button
                                onClick={() => {
                                    setShowOtherCashierModal(false);
                                    setOtherCashierSession(null);
                                    setShowOpenSessionModal(true);
                                }}
                                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                            >
                                🔑 Abrir mi propia sesión
                            </button>
                            {/* Solo SELLER / ADMIN puede tomar la sesión de otro cajero */}
                            {(currentUser?.role === 'SELLER' || currentUser?.role === 'ADMIN') && (
                                <button
                                    onClick={() => {
                                        setCurrentSession(otherCashierSession);
                                        setShowOtherCashierModal(false);
                                        setOtherCashierSession(null);
                                        toast.info('Continuando con la sesión existente.');
                                    }}
                                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-foreground rounded-xl font-black uppercase tracking-wider text-xs"
                                >
                                    Tomar sesión del cajero
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setShowOtherCashierModal(false);
                                    setOtherCashierSession(null);
                                }}
                                className="w-full px-4 py-3 border border-border rounded-xl font-black uppercase tracking-wider text-xs text-gray-500 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showOpenSessionModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-foreground">Abrir Caja</h3>
                                <p className="text-sm font-medium text-gray-500">Saldo inicial del turno</p>
                            </div>
                            <button
                                onClick={() => setShowOpenSessionModal(false)}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold text-gray-500"
                            >×</button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* Selector de locación — solo si tiene más de una permitida */}
                            {allowedLocations.length > 1 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Locación de Caja</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {allowedLocations.map(loc => (
                                            <button key={loc.id} type="button"
                                                onClick={async () => {
                                                    setSelectedLocationId(loc.id);
                                                    const existing = await getCurrentCashSession(loc.id);
                                                    if (existing) {
                                                        if (existing.openedById === currentUser?.id) {
                                                            setCurrentSession(existing);
                                                            setShowOpenSessionModal(false);
                                                            toast.info('Caja ya abierta — continuando.');
                                                        } else {
                                                            setOtherCashierSession(existing);
                                                            setShowOpenSessionModal(false);
                                                            setShowOtherCashierModal(true);
                                                        }
                                                    }
                                                }}
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedLocationId === loc.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-border hover:border-gray-300'}`}>
                                                <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${selectedLocationId === loc.id ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`} />
                                                <div>
                                                    <p className="font-black text-sm text-foreground">{loc.name}</p>
                                                    {loc.address && <p className="text-[10px] text-gray-400">{loc.address}</p>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {allowedLocations.length === 1 && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                                    <span className="text-emerald-600">📍</span>
                                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">{allowedLocations[0]?.name}</span>
                                </div>
                            )}
                            <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Conteo de Fondo Inicial</label>
                                {denominations.length > 0 ? (
                                    <div className="border border-border rounded-xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                                                <tr>
                                                    <th className="text-left px-3 py-2 text-xs font-black text-gray-400">Denominación</th>
                                                    <th className="text-center px-3 py-2 text-xs font-black text-gray-400">Cantidad</th>
                                                    <th className="text-right px-3 py-2 text-xs font-black text-gray-400">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {denominations.map(d => {
                                                    const qty = parseFloat(denCounts[d.id] || '0') || 0;
                                                    return (
                                                        <tr key={d.id}>
                                                            <td className="px-3 py-2 font-black text-foreground">{d.label}</td>
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={denCounts[d.id] || ''}
                                                                    onChange={e => {
                                                                        const nc = { ...denCounts, [d.id]: e.target.value };
                                                                        setDenCounts(nc);
                                                                        setCashAmount(calcDenTotal(nc, denominations).toFixed(2));
                                                                    }}
                                                                    placeholder="0"
                                                                    className="w-20 px-2 py-1 text-center border border-border rounded-lg text-sm font-bold bg-input text-foreground outline-none focus:ring-2 focus:ring-blue-500/50 mx-auto block"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-xs font-bold text-gray-500">
                                                                {qty > 0 ? `$${(qty * d.value).toFixed(2)}` : '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 dark:border-blue-800">
                                                <tr>
                                                    <td colSpan={2} className="px-3 py-3 font-black text-sm text-blue-700 dark:text-blue-300">Total Fondo</td>
                                                    <td className="px-3 py-3 text-right font-black text-lg text-blue-700 dark:text-blue-300">
                                                        ${calcDenTotal(denCounts, denominations).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ) : null}
                                {/* Input manual — siempre visible, actualiza el total */}
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">O ingresa directo:</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                        <input
                                            type="number" min="0"
                                            value={cashAmount}
                                            onChange={e => setCashAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-7 pr-3 py-2 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground placeholder:text-gray-400 font-black text-lg"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-3">
                            <button
                                onClick={handleOpenSession}
                                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 rounded-xl transition font-black uppercase tracking-wider"
                            >
                                Iniciar Turno
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Entrada/Salida de Efectivo */}
            {showMovementModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h3 className="text-xl font-black text-foreground">Movimiento de Caja</h3>
                                <p className="text-sm font-medium text-gray-500">Registrar In/Out</p>
                            </div>
                            <button
                                onClick={() => setShowMovementModal(false)}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold text-gray-500"
                            >×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                                <button
                                    onClick={() => setMovementType('IN')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${movementType === 'IN' ? 'bg-white dark:bg-gray-700 text-green-600 shadow-sm' : 'text-gray-500 hover:text-foreground'}`}
                                >Entrada</button>
                                <button
                                    onClick={() => setMovementType('OUT')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${movementType === 'OUT' ? 'bg-white dark:bg-gray-700 text-red-600 shadow-sm' : 'text-gray-500 hover:text-foreground'}`}
                                >Salida</button>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Motivo</label>
                                <input
                                    type="text"
                                    value={cashReason}
                                    onChange={(e) => setCashReason(e.target.value)}
                                    placeholder={movementType === 'IN' ? "Ej: Saldo a favor, Abono" : "Ej: Pago proveedor, Comida"}
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground placeholder:text-gray-400 font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Monto $</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={cashAmount}
                                    onChange={(e) => setCashAmount(e.target.value)}
                                    placeholder="Ej: 200.00"
                                    className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition text-foreground placeholder:text-gray-400 text-2xl font-black"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-3">
                            <button
                                onClick={handleAddMovement}
                                className={`w-full px-4 py-3 text-white shadow-lg rounded-xl transition font-black uppercase tracking-wider ${movementType === 'IN' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : 'bg-red-600 hover:bg-red-700 shadow-red-500/30'}`}
                            >
                                Registrar {movementType === 'IN' ? 'Ingreso' : 'Egreso'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Corte Z */}
            {showZReportModal && currentSession && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-foreground">Corte Z (Cerrar Caja)</h3>
                                <p className="text-sm font-medium text-gray-500">Resumen y arqueo del día</p>
                            </div>
                            <button
                                onClick={() => setShowZReportModal(false)}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold text-gray-500"
                            >×</button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* ── RESUMEN DE VENTAS ── */}
                            {(() => {
                                const allSales = currentSession.sales || [];
                                const completed = allSales.filter((s: any) => s.status === 'COMPLETED');
                                const returns   = allSales.filter((s: any) => s.status === 'RETURN' || s.status === 'REFUNDED');
                                const totalSales   = completed.reduce((a: number, s: any) => a + s.total, 0);
                                const totalReturns = returns.reduce((a: number, s: any) => a + s.total, 0);
                                const totalDiscount = completed.reduce((a: number, s: any) => a + (s.discount || 0), 0);

                                // Agrupar por método de pago (respetando pagos divididos)
                                const byMethod: Record<string, number> = {};
                                completed.forEach((s: any) => {
                                    const split = s.paymentSplit ? (() => { try { return JSON.parse(s.paymentSplit); } catch { return null; } })() : null;
                                    if (split?.length > 0) {
                                        split.forEach((p: any) => {
                                            byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
                                        });
                                    } else {
                                        const name = s.paymentMethod?.name || 'Efectivo';
                                        byMethod[name] = (byMethod[name] || 0) + s.total;
                                    }
                                });
                                const cashSales = byMethod['Efectivo'] || 0;

                                const movIn  = (currentSession.movements || []).filter((m: any) => m.type === 'IN').reduce((a: number, b: any) => a + b.amount, 0);
                                const movOut = (currentSession.movements || []).filter((m: any) => m.type === 'OUT').reduce((a: number, b: any) => a + b.amount, 0);
                                const expectedCash = currentSession.openingBalance + cashSales + movIn - movOut;
                                const counted = parseFloat(cashAmount) || 0;
                                const diff = counted - expectedCash;

                                return (
                                    <>
                                    {/* Resumen ventas */}
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-border overflow-hidden">
                                        <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Resumen de Ventas</p>
                                        <div className="divide-y divide-border">
                                            <div className="flex justify-between px-4 py-2 text-sm">
                                                <span className="text-gray-500">Tickets cobrados</span>
                                                <span className="font-black text-foreground">{completed.length}</span>
                                            </div>
                                            <div className="flex justify-between px-4 py-2 text-sm">
                                                <span className="text-gray-500">Total ventas</span>
                                                <span className="font-black text-green-600">+${totalSales.toFixed(2)}</span>
                                            </div>
                                            {totalDiscount > 0 && (
                                                <div className="flex justify-between px-4 py-2 text-sm">
                                                    <span className="text-gray-500">Descuentos aplicados</span>
                                                    <span className="font-bold text-orange-500">-${totalDiscount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {returns.length > 0 && (
                                                <div className="flex justify-between px-4 py-2 text-sm">
                                                    <span className="text-gray-500">Devoluciones ({returns.length})</span>
                                                    <span className="font-bold text-red-500">-${totalReturns.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Desglose por método de pago */}
                                    {Object.keys(byMethod).length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-border overflow-hidden">
                                            <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Por Método de Pago</p>
                                            <div className="divide-y divide-border">
                                                {Object.entries(byMethod).map(([method, amount]) => (
                                                    <div key={method} className="flex justify-between px-4 py-2 text-sm">
                                                        <span className="text-gray-600 dark:text-gray-400 font-medium">{method}</span>
                                                        <span className="font-black text-foreground">${(amount as number).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Movimientos manuales */}
                                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-border space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Fondo Inicial</span>
                                            <span className="font-bold text-foreground">${currentSession.openingBalance.toFixed(2)}</span>
                                        </div>
                                        {(currentSession.movements || []).length > 0 && (
                                            <div className="border-t border-border pt-2 space-y-1">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Movimientos Manuales</p>
                                                {(currentSession.movements || []).map((m: any) => (
                                                    <div key={m.id} className="flex justify-between text-xs gap-2">
                                                        <span className="text-gray-500 line-clamp-1 flex-1">{m.reason}</span>
                                                        <span className="text-gray-400 shrink-0">
                                                            {new Date(m.createdAt).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span className={`font-bold shrink-0 ${m.type === 'IN' ? 'text-green-500' : 'text-red-500'}`}>
                                                            {m.type === 'IN' ? '+' : '-'}${m.amount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="border-t border-border pt-2 flex justify-between text-sm">
                                            <span className="text-gray-500">Ventas en Efectivo</span>
                                            <span className="font-bold text-green-500">+${cashSales.toFixed(2)}</span>
                                        </div>
                                        <div className="border-t border-border pt-2 flex justify-between font-black text-base">
                                            <span className="text-gray-600">Sistema Espera en Caja</span>
                                            <span className="text-blue-600">${expectedCash.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Diferencia — se calcula mientras se cuenta */}
                                    {cashAmount && (
                                        <div className={`flex justify-between items-center px-4 py-3 rounded-xl font-black text-sm border-2 ${diff === 0 ? 'bg-green-50 border-green-300 text-green-700' : diff > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-red-50 border-red-300 text-red-700'}`}>
                                            <span>{diff === 0 ? '✓ Caja cuadrada' : diff > 0 ? '↑ Sobrante' : '↓ Faltante'}</span>
                                            <span>${Math.abs(diff).toFixed(2)}</span>
                                        </div>
                                    )}
                                    </>
                                );
                            })()}
                            
                            <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Arqueo — Conteo Físico de Caja</label>
                                {denominations.length > 0 ? (
                                    <div className="border border-border rounded-xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                                                <tr>
                                                    <th className="text-left px-3 py-2 text-xs font-black text-gray-400">Denominación</th>
                                                    <th className="text-center px-3 py-2 text-xs font-black text-gray-400">Piezas</th>
                                                    <th className="text-right px-3 py-2 text-xs font-black text-gray-400">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {denominations.map(d => {
                                                    const qty = parseFloat(denCounts[d.id] || '0') || 0;
                                                    return (
                                                        <tr key={d.id}>
                                                            <td className="px-3 py-2 font-black text-foreground">{d.label}</td>
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="number" min="0"
                                                                    value={denCounts[d.id] || ''}
                                                                    onChange={e => {
                                                                        const nc = { ...denCounts, [d.id]: e.target.value };
                                                                        setDenCounts(nc);
                                                                        setCashAmount(calcDenTotal(nc, denominations).toFixed(2));
                                                                    }}
                                                                    placeholder="0"
                                                                    className="w-20 px-2 py-1 text-center border border-border rounded-lg text-sm font-bold bg-input text-foreground outline-none focus:ring-2 focus:ring-blue-500/50 mx-auto block"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-xs font-bold text-gray-500">
                                                                {qty > 0 ? `$${(qty * d.value).toFixed(2)}` : '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-red-50 dark:bg-red-900/20 border-t-2 border-red-200 dark:border-red-800">
                                                <tr>
                                                    <td colSpan={2} className="px-3 py-3 font-black text-sm text-red-700 dark:text-red-300">Total Contado</td>
                                                    <td className="px-3 py-3 text-right font-black text-lg text-red-700 dark:text-red-300">
                                                        ${calcDenTotal(denCounts, denominations).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ) : null}
                                {/* Input manual — siempre visible */}
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">O ingresa directo:</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                        <input
                                            type="number" min="0"
                                            value={cashAmount}
                                            onChange={e => setCashAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-7 pr-3 py-2 bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-900 focus:border-red-500 focus:ring-0 outline-none transition text-red-600 dark:text-red-400 placeholder:text-red-300 font-black text-lg rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-gray-50/50 dark:bg-gray-900/50 flex gap-3">
                            <button
                                onClick={handleCloseSession}
                                className="w-full px-4 py-4 bg-foreground text-background dark:bg-white dark:text-black hover:-translate-y-1 shadow-xl rounded-xl transition-all font-black uppercase tracking-wider relative"
                            >
                                Confirmar Arqueo y Cerrar Caja
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal - Historial de Cliente */}
            {showClientHistory && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-border bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-foreground">Historial del Cliente</h3>
                                {clientHistoryData && (
                                    <p className="text-sm font-medium text-gray-500 mt-0.5">{clientHistoryData.name}</p>
                                )}
                            </div>
                            <button
                                onClick={() => { setShowClientHistory(false); setClientHistoryData(null); }}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 transition-colors flex items-center justify-center font-bold text-gray-500"
                            >×</button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                                    <p className="text-sm font-medium">Cargando historial...</p>
                                </div>
                            ) : !clientHistoryData ? (
                                <div className="text-center py-12 text-gray-400">
                                    <p className="text-sm font-medium">No se pudo cargar el historial.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Info del cliente */}
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800 flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-black text-sm shrink-0">
                                            {clientHistoryData.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-0.5">
                                            <p className="font-black text-foreground truncate">{clientHistoryData.name}</p>
                                            {clientHistoryData.phone && <p className="text-xs text-gray-500 font-medium">{clientHistoryData.phone}</p>}
                                            {clientHistoryData.email && <p className="text-xs text-gray-500 font-medium">{clientHistoryData.email}</p>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Crédito</p>
                                            <p className="text-sm font-black text-green-600">${(clientHistoryData.storeCredit || 0).toFixed(2)}</p>
                                        </div>
                                    </div>

                                    {/* KPIs */}
                                    {(() => {
                                        const completedSales = (clientHistoryData.sales || []).filter((s: any) => s.status === 'COMPLETED');
                                        const totalSpent = completedSales.reduce((a: number, s: any) => a + s.total, 0);
                                        const avgTicket = completedSales.length > 0 ? totalSpent / completedSales.length : 0;
                                        return (
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-border">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Visitas</p>
                                                    <p className="text-2xl font-black text-foreground">{completedSales.length}</p>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-border">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Gastado</p>
                                                    <p className="text-lg font-black text-green-600">${totalSpent.toFixed(0)}</p>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center border border-border">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Ticket Prom.</p>
                                                    <p className="text-lg font-black text-blue-600">${avgTicket.toFixed(0)}</p>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Lista de compras */}
                                    {(clientHistoryData.sales || []).length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">
                                            <p className="text-sm font-medium">Sin compras registradas.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Compras Recientes</p>
                                            {(clientHistoryData.sales || []).map((sale: any) => (
                                                <div key={sale.id} className={`rounded-xl border overflow-hidden ${sale.status === 'COMPLETED' ? 'border-border' : 'border-red-200 dark:border-red-800 opacity-70'}`}>
                                                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${sale.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                                                                {sale.status === 'COMPLETED' ? 'Pagado' : 'Devuelto'}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-medium">
                                                                {new Date(sale.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="font-black text-sm text-foreground">${sale.total.toFixed(2)}</span>
                                                            {sale.paymentMethod && (
                                                                <span className="ml-2 text-[10px] text-gray-400 font-medium">{sale.paymentMethod.name}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {sale.items && sale.items.length > 0 && (
                                                        <div className="divide-y divide-border/50">
                                                            {sale.items.map((item: any) => (
                                                                <div key={item.id} className="flex items-center justify-between px-4 py-1.5 text-xs">
                                                                    <span className="text-gray-600 dark:text-gray-400 truncate flex-1 mr-2 font-medium">
                                                                        {item.variant?.product?.name || 'Producto'}
                                                                        {item.variant?.attributes && typeof item.variant.attributes === 'object' && Object.keys(item.variant.attributes).length > 0
                                                                            ? ` — ${Object.values(item.variant.attributes as Record<string, string>).join('/')}`
                                                                            : ''}
                                                                    </span>
                                                                    <span className="text-gray-400 font-bold whitespace-nowrap">×{item.quantity} · ${item.price.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Modal (80mm Thermal Printer format) */}
            {showReceiptModal && lastSaleData && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl">
                            <h3 className="font-bold text-foreground">Imprimir Ticket</h3>
                            <button onClick={() => setShowReceiptModal(false)} className="text-gray-400 hover:text-red-500 w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors">✕</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900 flex justify-center">
                            {/* Visual representation of the 80mm thermal receipt */}
                            <div id="thermal-receipt" className="bg-white text-black w-[80mm] shadow-md p-3 flex flex-col font-mono text-[11px] leading-snug relative shrink-0">
                                <div className="text-center mb-2 flex flex-col items-center">
                                    {(() => {
                                        // Buscar la locación activa: de la sesión o de las permitidas
                                        const activeLoc = currentSession?.location ||
                                            allowedLocations.find((l: any) => l.id === (selectedLocationId || currentSession?.locationId)) ||
                                            locations.find((l: any) => l.id === (selectedLocationId || currentSession?.locationId)) ||
                                            (allowedLocations.length === 1 ? allowedLocations[0] : null);
                                        
                                        return (
                                            <>
                                                {globalConfig?.logoUrl ? (
                                                    <img src={globalConfig.logoUrl} alt="Store Logo" className="h-16 object-contain mb-2 grayscale" />
                                                ) : (
                                                    <h1 className="font-black text-xl mb-1 uppercase">
                                                        {activeLoc?.name ? activeLoc.name : (globalConfig?.storeName || 'MODA ZAPOTLANEJO')}
                                                    </h1>
                                                )}

                                                {/* Si hay logo, el nombre de la sucursal va debajo. Si no hay logo, el h1 ya es el nombre de la sucursal. */}
                                                {globalConfig?.logoUrl && activeLoc?.name && (
                                                    <h2 className="font-bold text-sm uppercase mb-1">{activeLoc.name}</h2>
                                                )}

                                                {activeLoc?.ticketHeader && (
                                                    <p className="text-xs font-bold mt-1">{activeLoc.ticketHeader}</p>
                                                )}
                                                
                                                <p className="text-xs">
                                                    {activeLoc?.address || globalConfig?.address || 'Zapotlanejo, Jalisco'}
                                                </p>
                                            </>
                                        );
                                    })()}
                                    {globalConfig?.phone && <p className="text-xs">Tel: {globalConfig.phone}</p>}
                                    {globalConfig?.taxId && <p className="text-xs">RFC: {globalConfig.taxId}</p>}
                                </div>
                                
                                <div className="border-t border-b border-dashed border-black py-2 mb-2 text-xs">
                                    <p>Ticket: #PDV{lastSaleData.receiptNumber || lastSaleData.id?.slice(-6).toUpperCase()}</p>
                                    <p>Fecha: {lastSaleData.date.toLocaleString()}</p>
                                    <p>Cajero: {currentUser?.name || 'Cajero'}</p>
                                    {lastSaleData.salespersonName && <p>Vendedor: {lastSaleData.salespersonName}</p>}
                                    <p>Cliente: {lastSaleData.clientName}</p>
                                    {lastSaleData.isLayaway && <p className="font-bold">* APARTADO *</p>}
                                    {lastSaleData.isReturn && <p className="font-bold">* DEVOLUCIÓN *</p>}
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
                                        {lastSaleData.cart.map((item: any, idx: number) => {
                                            const total = item.price * item.quantity;
                                            return (
                                                <tr key={idx} className="align-top">
                                                    <td className="py-0.5 pr-1 leading-tight w-6">{item.quantity}</td>
                                                    <td className="py-0.5 break-words pr-1 leading-tight">
                                                        {item.name}
                                                        {(item.variant?.color || item.variant?.size) && <span className="block text-[9px] opacity-60">{[item.variant?.color, item.variant?.size].filter(Boolean).join(' / ')}</span>}
                                                    </td>
                                                    <td className="py-0.5 text-right leading-tight whitespace-nowrap">${total.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {lastSaleData.discount > 0 && (
                                    <div className="flex justify-between items-center text-xs mb-1">
                                        <span>Subtotal:</span>
                                        <span>${lastSaleData.subtotal.toFixed(2)}</span>
                                    </div>
                                )}
                                {lastSaleData.discount > 0 && (
                                    <div className="flex justify-between items-center text-xs mb-2">
                                        <span>Descuento ({lastSaleData.tierName}):</span>
                                        <span>-${lastSaleData.discount.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center font-black text-lg border-t border-black pt-2 mb-2">
                                    <span>TOTAL:</span>
                                    <span>${lastSaleData.total.toFixed(2)}</span>
                                </div>

                                {lastSaleData.paymentMethodName?.toLowerCase().includes('efectivo') && lastSaleData.receivedAmount && lastSaleData.receivedAmount >= lastSaleData.total && (
                                    <div className="border-t border-black pt-2 space-y-1 mb-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span>Efectivo:</span>
                                            <span>${lastSaleData.receivedAmount.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span>Cambio:</span>
                                            <span>${(lastSaleData.receivedAmount - lastSaleData.total).toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}

                                {lastSaleData.isLayaway && (
                                    <>
                                        <div className="flex justify-between items-center text-xs mt-2 border-t border-black pt-1">
                                            <span>Enganche:</span>
                                            <span>${lastSaleData.amountPaid.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span>Resta por pagar:</span>
                                            <span className="font-bold">${lastSaleData.balance.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] mt-1 text-gray-700">
                                            <span>Vence:</span>
                                            <span>{lastSaleData.dueDate?.toLocaleDateString()}</span>
                                        </div>
                                    </>
                                )}

                                <div className="text-xs mb-1 mt-0.5">
                                    {lastSaleData.partialPayments?.length > 0 ? (
                                        <div>
                                            {lastSaleData.partialPayments.map((p: any, i: number) => (
                                                <div key={i}>Pago {i + 1}: {p.method} — ${p.amount.toFixed(2)}</div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span>Pago: {lastSaleData.paymentMethodName}</span>
                                    )}
                                    {' · '}
                                    <span>{lastSaleData.cart.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)} artículo(s)</span>
                                </div>

                                <div className="text-center text-[10px] border-t border-dashed border-black pt-2 mt-2">
                                    {(() => {
                                        const activeLoc = currentSession?.location ||
                                            allowedLocations.find((l: any) => l.id === selectedLocationId) ||
                                            locations.find((l: any) => l.id === selectedLocationId);
                                        const footer = activeLoc?.ticketFooter;
                                        return footer ? (
                                            <p className="font-bold whitespace-pre-line">{footer}</p>
                                        ) : (
                                            <>
                                                <p className="font-bold">¡GRACIAS POR SU COMPRA!</p>
                                                <p>No hay cambios ni devoluciones</p>
                                                <p>salvo por defecto de fábrica en 7 días.</p>
                                            </>
                                        );
                                    })()}
                                    <p className="mt-2 opacity-50 text-[8px]">{globalConfig?.storeName?.toLowerCase().replace(/\s/g, '') || 'modazapotlanejo'}.com</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-card border-t border-border flex gap-3 rounded-b-3xl">
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-foreground font-bold rounded-xl transition-colors"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={() => {
                                    const receiptEl = document.getElementById('thermal-receipt');
                                    if (!receiptEl) return;
                                    // Copy the actual compiled CSS from the page so it renders identically
                                    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.outerHTML).join('');
                                    const inlineStyles = Array.from(document.querySelectorAll('style')).map(s => s.outerHTML).join('');
                                    const printWindow = window.open('', '', 'width=400,height=800');
                                    if (printWindow) {
                                        printWindow.document.write(
                                            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket</title>' +
                                            styleLinks + inlineStyles +
                                            '<style>@page{margin:0;size:80mm auto}body{margin:0;padding:4px;background:white;display:flex;justify-content:center}.shadow-md,.shadow-2xl,.shadow-sm{box-shadow:none!important}</style>' +
                                            '</head><body>' + receiptEl.outerHTML +
                                            '<script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close()},500)},400)}<\/script>' +
                                            '</body></html>'
                                        );
                                        printWindow.document.close();
                                        setShowReceiptModal(false);
                                    }
                                }}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                Imprimir Ticket
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - Tickets del Día */}
            {showTodayTicketsModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
                        <div className="p-5 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-foreground">🖨️ Tickets del Día</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{todayTickets.length} venta{todayTickets.length !== 1 ? 's' : ''} en esta sesión</p>
                            </div>
                            <button onClick={() => { setShowTodayTicketsModal(false); setReprintSale(null); }} className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 flex items-center justify-center font-bold transition-colors">✕</button>
                        </div>
                        {reprintSale ? (
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900 flex justify-center">
                                    <div id="reprint-receipt" className="bg-white text-black w-[80mm] min-h-[100mm] shadow-md p-4 flex flex-col font-mono text-sm leading-tight shrink-0">
                                        <div className="text-center mb-4 flex flex-col items-center">
                                            {globalConfig?.logoUrl ? (
                                                <img src={globalConfig.logoUrl} alt="Logo" className="h-16 object-contain mb-2 grayscale" />
                                            ) : (
                                                <h1 className="font-black text-xl mb-1 uppercase">
                                                    {reprintSale.location?.name || globalConfig?.storeName || 'PUNTO DE VENTA'}
                                                </h1>
                                            )}
                                            {globalConfig?.logoUrl && reprintSale.location?.name && (
                                                <h2 className="font-bold text-sm uppercase mb-1">{reprintSale.location.name}</h2>
                                            )}
                                            {reprintSale.location?.ticketHeader && <p className="text-xs font-bold mt-1">{reprintSale.location.ticketHeader}</p>}
                                            <p className="text-xs">{reprintSale.location?.address || globalConfig?.address || 'Zapotlanejo, Jalisco'}</p>
                                        </div>
                                        <hr className="border-dashed border-gray-400 my-2" />
                                        <div className="flex justify-between text-xs">
                                            <span>REIMPRESIÓN</span>
                                            <span className="font-bold">Ticket: #PDV{reprintSale.receiptNumber || reprintSale.id?.slice(-6).toUpperCase()}</span>
                                        </div>
                                        <div className="text-xs mb-1">{new Date(reprintSale.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</div>
                                        {reprintSale.client?.name && <div className="text-xs mb-1">Cliente: {reprintSale.client.name}</div>}
                                        <hr className="border-dashed border-gray-400 my-2" />
                                        <table className="w-full text-xs mb-2">
                                            <thead><tr className="border-b border-gray-300"><th className="text-left pb-1">Artículo</th><th className="text-center pb-1">Cant</th><th className="text-right pb-1">Importe</th></tr></thead>
                                            <tbody>
                                                {reprintSale.items?.map((item: any, idx: number) => (
                                                    <tr key={idx} className="border-b border-dashed border-gray-200">
                                                        <td className="py-1 pr-1">
                                                            <span>{item.variant?.product?.name || 'Producto'}</span>
                                                            {(item.variant?.size || item.variant?.color) && (
                                                                <div className="text-[9px] text-gray-500">{[item.variant.color, item.variant.size].filter(Boolean).join(' / ')}</div>
                                                            )}
                                                        </td>
                                                        <td className="text-center py-1">{item.quantity}</td>
                                                        <td className="text-right py-1">${(item.price * item.quantity).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <hr className="border-dashed border-gray-400 my-1" />
                                        {reprintSale.discount > 0 && (
                                            <div className="flex justify-between text-xs"><span>Descuento</span><span>-${reprintSale.discount.toFixed(2)}</span></div>
                                        )}
                                        <div className="flex justify-between font-black text-base mt-1"><span>TOTAL</span><span>${reprintSale.total.toFixed(2)}</span></div>
                                        {(() => {
                                            const split = reprintSale.paymentSplit ? (() => { try { return JSON.parse(reprintSale.paymentSplit); } catch { return null; } })() : null;
                                            if (split?.length > 0) {
                                                return split.map((p: any, i: number) => (
                                                    <div key={i} className="text-xs mt-0.5">Pago {i + 1}: {p.method} — ${p.amount.toFixed(2)}</div>
                                                ));
                                            }
                                            return reprintSale.paymentMethod?.name
                                                ? <div className="text-xs mt-1">Pago: {reprintSale.paymentMethod.name}{reprintSale.amountPaid ? ` — $${reprintSale.amountPaid.toFixed(2)}` : ''}</div>
                                                : null;
                                        })()}
                                        {(reprintSale.amountPaid || 0) > reprintSale.total && (
                                            <div className="text-xs">Cambio: ${((reprintSale.amountPaid || 0) - reprintSale.total).toFixed(2)}</div>
                                        )}
                                        {reprintSale.location?.ticketFooter && (
                                            <><hr className="border-dashed border-gray-400 my-2" /><p className="text-xs text-center">{reprintSale.location.ticketFooter}</p></>
                                        )}
                                        <p className="text-[9px] text-center text-gray-400 mt-3">*** REIMPRESIÓN ***</p>
                                    </div>
                                </div>
                                <div className="p-4 border-t border-border bg-card flex gap-3 shrink-0">
                                    <button
                                        onClick={() => setReprintSale(null)}
                                        className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >← Volver</button>
                                    <button
                                        onClick={() => {
                                            const receiptEl = document.getElementById('reprint-receipt');
                                            if (!receiptEl) return;
                                            const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.outerHTML).join('');
                                            const inlineStyles = Array.from(document.querySelectorAll('style')).map(s => s.outerHTML).join('');
                                            const win = window.open('', '', 'width=400,height=800');
                                            if (win) {
                                                win.document.write(
                                                    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket</title>' +
                                                    styleLinks + inlineStyles +
                                                    '<style>@page{margin:0;size:80mm auto}body{margin:0;padding:4px;background:white;display:flex;justify-content:center}.shadow-md,.shadow-2xl,.shadow-sm{box-shadow:none!important}</style>' +
                                                    '</head><body>' + receiptEl.outerHTML +
                                                    '<script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close()},500)},400)}<\/script>' +
                                                    '</body></html>'
                                                );
                                                win.document.close();
                                            }
                                        }}
                                        className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors"
                                    >🖨️ Imprimir</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto">
                                {loadingTickets ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                                        <svg className="animate-spin h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                        <span className="text-sm font-bold">Cargando tickets...</span>
                                    </div>
                                ) : todayTickets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                                        <span className="text-4xl">🧾</span>
                                        <span className="text-sm font-bold">No hay ventas en esta sesión</span>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {todayTickets.map((sale: any) => (
                                            <div key={sale.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-sm shrink-0">
                                                    #{sale.receiptNumber || '—'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-sm text-foreground">${sale.total.toFixed(2)}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sale.status === 'COMPLETED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'}`}>
                                                            {sale.status === 'COMPLETED' ? 'Completada' : sale.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {sale.client?.name || 'Cliente General'} · {sale.items?.length || 0} artículo{sale.items?.length !== 1 ? 's' : ''} · {sale.paymentMethod?.name || 'Sin método'}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">
                                                        {new Date(sale.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setReprintSale(sale)}
                                                    className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors shrink-0"
                                                    title="Reimprimir ticket"
                                                >🖨️</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function POSPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Cargando TPV...</div>}>
            <POSContent />
        </Suspense>
    );
}
