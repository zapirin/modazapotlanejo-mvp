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
