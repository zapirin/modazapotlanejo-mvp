'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface InventoryChange {
  variantId: string;
  locationId: string;
  stock: number;
}

interface Props {
  onInventoryChange: (change: InventoryChange) => void;
  // Función para obtener el inventario actual (se pasa desde el padre)
  fetchInventory: () => Promise<any[]>;
}

export default function InventoryRealtimeSync({ onInventoryChange, fetchInventory }: Props) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousInventoryRef = useRef<Map<string, number>>(new Map());
  const isFirstLoadRef = useRef(true);

  const checkForChanges = useCallback(async () => {
    try {
      const products = await fetchInventory();

      // Construir mapa actual de stock: variantId -> stock
      const currentMap = new Map<string, number>();
      products.forEach((product: any) => {
        product.variants?.forEach((variant: any) => {
          currentMap.set(variant.id, variant.stock ?? 0);
        });
      });

      // En la primera carga solo guardamos el estado base
      if (isFirstLoadRef.current) {
        previousInventoryRef.current = currentMap;
        isFirstLoadRef.current = false;
        setStatus('connected');
        return;
      }

      // Comparar con el estado anterior y notificar cambios
      currentMap.forEach((stock, variantId) => {
        const previousStock = previousInventoryRef.current.get(variantId);
        if (previousStock !== undefined && previousStock !== stock) {
          onInventoryChange({ variantId, locationId: 'global', stock });
        }
      });

      previousInventoryRef.current = currentMap;
      setStatus('connected');
    } catch (error) {
      console.error('[Sync] Error consultando inventario:', error);
      setStatus('error');
    }
  }, [fetchInventory, onInventoryChange]);

  useEffect(() => {
    // Consultar cambios cada 5 segundos
    checkForChanges();
    intervalRef.current = setInterval(checkForChanges, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkForChanges]);

  return (
    <div className="flex items-center gap-2">
      {status === 'connecting' && (
        <>
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">
            Conectando...
          </span>
        </>
      )}
      {status === 'connected' && (
        <>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
            En línea
          </span>
        </>
      )}
      {status === 'error' && (
        <>
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
            Sin sincronización
          </span>
        </>
      )}
    </div>
  );
}
