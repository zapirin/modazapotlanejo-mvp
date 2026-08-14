# Abrir el ticket de una venta desde el historial de un cliente

**Fecha:** 2026-08-12
**Estado:** Diseño aprobado, pendiente de plan de implementación

## Problema

En `Clientes → Ver`, la tabla "Historial de Transacciones" muestra un resumen por
venta (folio, fecha, status, piezas, montos) pero no hay forma de ver **qué se
llevó** el cliente en esa compra. Para saberlo hay que salir a otra pantalla y
buscar la venta por otro camino.

La misma necesidad ya está resuelta en `Inventario → producto → 📊 Historial de
Ventas`, donde cada renglón abre el ticket completo. Aquí simplemente falta.

## Contexto del código actual

- `src/app/(seller-center)/clients/[id]/ClientHistoryClient.tsx` es un componente
  cliente que pinta la tabla. Sus filas (`<tr>`) no son interactivas.
- `src/app/(seller-center)/products/ProductSalesHistoryModal.tsx` **ya contiene el
  modal de ticket terminado**: cabecera con folio y fecha, el ticket renderizado
  con `SaleTicket`, y botones Cerrar / Imprimir. Junto a él vive el ayudante
  `printSaleTicket`, que oculta el resto del `body` para imprimir solo el ticket.
- `getSaleForReprint` (`src/app/(seller-center)/inventory/actions.ts:225`) trae la
  venta con sus items, variantes, producto, cliente, forma de pago, sucursal,
  cajero y vendedor de piso. **Rechaza a cualquiera que no sea `SELLER`**
  (línea 228) y valida `sale.sellerId !== user.id` (línea 249).
- `getStoreSettings` (`settings/actions.ts:42`) da `logoUrl` y `storeName` para el
  ticket. Su `getSellerFilter` **sí traduce cajero → `managedBySellerId`**, así que
  funciona igual para ambos roles sin cambios.
- `/clients` **sí es accesible para cajeros**: `clients/page.tsx:15-21` resuelve el
  vendedor desde `user.locationId` cuando no es SELLER. Un cajero ya ve la lista y
  el historial resumido de los clientes de su vendedor.
- `ClientHistoryClient` no tiene ninguna variante móvil (no hay clases
  `md:hidden` / `md:block`); la tabla se desplaza horizontalmente dentro de un
  `overflow-x-auto`.
- Existe `src/components/` para componentes compartidos entre secciones.

## Alcance

**Incluye:**

1. Extraer el modal de ticket a un componente compartido y consumirlo desde las
   dos pantallas.
2. Hacer las filas del historial del cliente abribles con clic o toque.
3. Ampliar `getSaleForReprint` para que también responda a cajeros del vendedor.

**No incluye (decidido explícitamente):**

- Cambiar las columnas, los datos o el diseño de la tabla del historial.
- Rediseñar el ticket o el componente `SaleTicket`.
- Una vista de tarjetas para móvil. La tabla sigue desplazándose en horizontal
  como hoy; solo se vuelve tocable.
- Tocar `getProductSalesHistory`, que sigue siendo exclusiva del vendedor.

## Componentes

### `src/components/SaleTicketModal.tsx` (nuevo)

Se mueve, sin rediseñar, el bloque `{reprintSale && (...)}` de
`ProductSalesHistoryModal.tsx` junto con el ayudante `printSaleTicket`.

```tsx
export default function SaleTicketModal({
    sale,        // la venta ya cargada, tal como la devuelve getSaleForReprint
    onClose,
}: { sale: any; onClose: () => void })
```

El componente resuelve por su cuenta `logoUrl` y `storeName` llamando a
`getStoreSettings` en un `useEffect`, en lugar de recibirlos por props: así cada
pantalla que lo use no tiene que acordarse de pasarlos. Usa un `elementId` fijo
propio para imprimir.

**Decisión:** el modal recibe la venta **ya cargada**, no un `saleId`. Cargar es
responsabilidad de quien lo abre, que es quien sabe manejar su propio estado de
"cargando". Mantiene el modal como una pieza de presentación.

### `ProductSalesHistoryModal.tsx` (modificar)

Borra su copia del modal y de `printSaleTicket`, importa `SaleTicketModal` y lo
monta con el `reprintSale` que ya tiene en estado. Su estado `globalConfig` deja
de usarse para el ticket y se elimina si no lo consume nada más.

### `ClientHistoryClient.tsx` (modificar)

- Estado nuevo: `openingSaleId` (para el indicador de carga por fila) y
  `ticketSale` (la venta a mostrar).
- Cada `<tr>` recibe `onClick`, `cursor-pointer`, `role="button"`, `tabIndex={0}`
  y manejo de Enter/Espacio, para que también funcione con teclado.
- Al activarla: `getSaleForReprint(sale.id)`; si responde, se guarda en
  `ticketSale`; si no, `toast.error('No se pudo abrir el ticket.')`.
- Se agrega una columna final estrecha con `›` como pista visual de que la fila
  se abre.
- Mientras carga esa fila, el `›` se sustituye por `⋯` y se ignoran más clics
  sobre la misma fila.

### `getSaleForReprint` (modificar)

Sustituir el filtro por rol y la validación de dueño por la resolución de
vendedor efectivo que el resto del proyecto ya usa:

- `SELLER` → su propio `id`.
- `CASHIER` → su `managedBySellerId`.
- Cualquier otro rol → `null` (rechazado, incluido ADMIN de marketplace).

La venta se devuelve solo si `sale.sellerId` coincide con ese vendedor efectivo.
El aislamiento entre vendedores no cambia: sigue siendo imposible ver la venta de
otro vendedor.

## Errores y casos límite

- **Venta de otro vendedor o inexistente:** `getSaleForReprint` devuelve `null` y
  la fila muestra el aviso de error; el modal no se abre.
- **Ventas sin artículos** (los `STORE_CREDIT`, que son abonos y no compras): la
  fila sigue siendo abrible y el ticket se muestra con lo que la venta tenga.
  `SaleTicket` ya recibe estas ventas hoy desde la otra pantalla.
- **Sin conexión o error del servidor:** aviso con `toast.error`; la fila vuelve a
  su estado normal y se puede reintentar.

## Criterios de verificación

1. Como vendedor, un clic en cualquier fila del historial de un cliente abre el
   ticket de **esa** venta, con su folio correcto.
2. En móvil, el toque sobre la fila hace lo mismo.
3. El botón Imprimir del modal imprime solo el ticket.
4. La misma ventana sigue funcionando igual en `Inventario → producto → Historial
   de Ventas` (no se rompió al extraerla).
5. Como cajero, las filas también abren su ticket, con el logo y el nombre de la
   tienda del vendedor.
6. Un vendedor no puede abrir una venta de otro vendedor aunque invoque la acción
   directamente.
7. La tabla, sus columnas y los totales de arriba se ven exactamente igual que
   antes del cambio.
