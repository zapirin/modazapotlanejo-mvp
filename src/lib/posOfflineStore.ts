// Store de IndexedDB para ventas pendientes del POS (modo offline)
// Usa la API nativa de IndexedDB sin dependencias externas

const DB_NAME = 'modazapo_pos';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

export interface PendingSale {
    localId: string;          // ID temporal local (UUID)
    timestamp: number;        // Timestamp de creación
    sellerId?: string;        // Para identificar qué vendedor
    sessionId?: string;       // cashSessionId
    data: {
        cart: { variantId: string; quantity: number; price: number }[];
        total: number;
        subtotal: number;
        discount: number;
        paymentMethodName: string;
        clientId?: string | null;
        priceTierId?: string | null;
        isReturn?: boolean;
        cashSessionId?: string | null;
        amountPaid?: number;
        partialPayments?: { method: string; amount: number }[] | null;
    };
    synced: boolean;
    syncError?: string;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
                store.createIndex('synced', 'synced', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function savePendingSale(sale: Omit<PendingSale, 'localId' | 'timestamp' | 'synced'>): Promise<string> {
    const db = await openDB();
    const localId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: PendingSale = {
        ...sale,
        localId,
        timestamp: Date.now(),
        synced: false,
    };
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(record);
        req.onsuccess = () => resolve(localId);
        req.onerror = () => reject(req.error);
    });
}

export async function getPendingSales(): Promise<PendingSale[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        // Leer todos y filtrar en JS (evita problemas con IDBKeyRange y booleanos)
        const req = store.getAll();
        req.onsuccess = () => {
            const all: PendingSale[] = req.result || [];
            resolve(all.filter(s => !s.synced));
        };
        req.onerror = () => reject(req.error);
    });
}

export async function markSaleSynced(localId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(localId);
        getReq.onsuccess = () => {
            const record = getReq.result;
            if (record) {
                record.synced = true;
                store.put(record);
            }
            resolve();
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

export async function markSaleSyncError(localId: string, error: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(localId);
        getReq.onsuccess = () => {
            const record = getReq.result;
            if (record) {
                record.syncError = error;
                store.put(record);
            }
            resolve();
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

export async function countPendingSales(): Promise<number> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
            const all: PendingSale[] = req.result || [];
            resolve(all.filter(s => !s.synced).length);
        };
        req.onerror = () => reject(req.error);
    });
}

// ─── Caché de productos para modo offline (IndexedDB) ───────────────────────
const PRODUCTS_STORE_NAME = 'cached_products';
const PRODUCTS_RECORD_KEY = 'all_products';

export interface CachedProduct {
    id: string;
    name: string;
    price: number;
    images: string[];
    sku: string | null;
    variants: { id: string; attributes: Record<string, string>; stock: number; sku: string | null }[];
    category?: { name: string } | null;
    brand?: { name: string } | null;
}

async function openProductsDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('modazapo_products', 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(PRODUCTS_STORE_NAME)) {
                db.createObjectStore(PRODUCTS_STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Cache acepta cualquier shape para conservar la forma exacta que devuelve
// el server action (variants con color/size/attributes/inventoryLevels, etc.)
// y que los consumidores online/offline reciban el mismo objeto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveProductsCache(products: any[]): Promise<void> {
    try {
        const db = await openProductsDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PRODUCTS_STORE_NAME, 'readwrite');
            const store = tx.objectStore(PRODUCTS_STORE_NAME);
            const req = store.put({ key: PRODUCTS_RECORD_KEY, products, updatedAt: Date.now() });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error('Error saving products cache:', e);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getProductsCache(): Promise<{ products: any[]; updatedAt: number } | null> {
    try {
        const db = await openProductsDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PRODUCTS_STORE_NAME, 'readonly');
            const store = tx.objectStore(PRODUCTS_STORE_NAME);
            const req = store.get(PRODUCTS_RECORD_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

// Búsqueda sin acentos en local (igual que el servidor con translate())
const normalize = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function searchProductsOffline(query: string, cache: any[]): any[] {
    if (!query) return cache.slice(0, 30);
    const q = normalize(query);
    return cache.filter((p: any) => {
        if (normalize(p.name).includes(q)) return true;
        if (p.sku && normalize(p.sku).includes(q)) return true;
        if (Array.isArray(p.variants) && p.variants.some((v: any) => v.sku && normalize(v.sku).includes(q))) return true;
        return false;
    }).slice(0, 20);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterProductsByCategoryOffline(categoryId: string, cache: any[]): any[] {
    if (!categoryId) return cache.slice(0, 50);
    return cache.filter((p: any) => p.categoryId === categoryId || p.category?.id === categoryId).slice(0, 50);
}
