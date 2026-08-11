# Entradas de mercancía (registro de ingresos a inventario)

**Fecha:** 2026-08-11
**Estado:** Diseño aprobado, pendiente de plan de implementación

## Problema

Cuando a un vendedor le llega más mercancía de un modelo que ya tiene creado, la
única forma de actualizar el inventario es *Inventario → ⚖️ Ajustar Stock*, que
funciona como "déjalo en 20", no como "me llegaron 12 más". Consecuencias:

- No queda ningún registro consultable de **cuándo y cuánto** ingresó de cada modelo.
- El ajuste obliga a recalcular el total mentalmente, lo que induce errores de conteo.
- No se distingue una llegada de mercancía de una corrección por merma o robo.

El vendedor (Kalexa Fashion, que además es el dueño del marketplace) necesita
poder abrir un modelo y ver su historial de ingresos, y capturar las llegadas
sumando en lugar de reemplazando.

## Contexto del código actual

Hallazgos de la exploración previa que sustentan el diseño:

- `adjustProductStockGrid` (`src/app/(seller-center)/inventory/actions.ts:59`) ya
  escribe un `InventoryMovement` de tipo `RESTOCK` cuando la diferencia es
  positiva, pero **ese registro no se muestra en ninguna pantalla**: no tiene
  folio, ni proveedor, ni agrupación por evento, y convive con `SALE`,
  `ADJUSTMENT`, `TRANSFER_IN`/`TRANSFER_OUT`. No es utilizable como historial.
- Ya existe el patrón exacto que necesitamos: `StockTransfer` + `StockTransferItem`
  (`prisma/schema.prisma:801`), con `folio` consecutivo por vendedor
  (`@@unique([sellerId, folio])`), `totalItems`, `notes`, `userId` y snapshots
  (`productName`, `variantInfo`) en los renglones. `createTransfer`
  (`src/app/(seller-center)/pos/actions.ts`) calcula el folio dentro de la
  transacción con `findFirst` + `orderBy: { folio: 'desc' }`.
- `Product.supplierId` existe: **el proveedor vive a nivel producto**, no a nivel
  de cada ingreso. No hace falta pedirlo al capturar.
- El stock vive en dos lugares que deben moverse juntos: `Variant.stock` (total
  global) e `InventoryLevel.stock` (por sucursal). `createTransfer` solo mueve
  `InventoryLevel` porque el total no cambia; una entrada **sí** debe incrementar
  ambos.
- Los permisos granulares de cajero ya existen como campos booleanos en `User`
  (`canRefund`, `canDiscount`, `canViewReports`, `canViewCommissions`,
  `canViewZCuts`, `canCreateProducts`) y se editan en
  `src/app/(seller-center)/settings/team/page.tsx`. El aislamiento por sucursal
  se hace con `User.allowedLocationIds` y `resolveSellerId(user)`
  (cajero → `managedBySellerId`).
- El proyecto **no tiene carpeta `prisma/migrations/`**: los cambios de esquema se
  aplican con `prisma db push`.

## Alcance

**Incluye:**

1. Registrar una entrada de mercancía de **un modelo**, por sucursal, sumando al
   stock existente.
2. Historial de entradas **por modelo**, con resumen desplegable a detalle.
3. Pantalla general **📥 Entradas** con listado, filtros y captura con buscador de
   productos.
4. Permiso nuevo de cajero: *puede registrar entradas de mercancía*.
5. Cancelación de una entrada por parte del dueño, con reverso de stock.

**No incluye (decidido explícitamente):**

- Costo de la remesa, número de nota/factura, ni control de compras a proveedor.
  El campo `notes` cubre por ahora la necesidad de apuntar una referencia.
- Un rol `SUPERVISOR` con su propio esquema de privilegios (p. ej. "solo ve las
  ventas del día"). Es un proyecto aparte; aquí se resuelve con la casilla de
  cajero.
- Migrar los `InventoryMovement` históricos de tipo `RESTOCK` al nuevo historial.
  Carecen de folio, proveedor y agrupación fiable. **El historial arranca vacío.**
- Entradas con varios modelos en un mismo documento. Una entrada = un modelo.
- Alta de variantes nuevas desde la pantalla de entrada. Si llega una talla que no
  existía, se agrega antes en *Editar producto*.

## Modelo de datos

Dos tablas nuevas, calcadas del patrón `StockTransfer`:

```prisma
model StockEntry {
  id             String    @id @default(cuid())
  sellerId       String
  seller         User      @relation("SellerStockEntries", fields: [sellerId], references: [id])
  productId      String
  product        Product   @relation(fields: [productId], references: [id])
  productName    String
  supplierId     String?
  supplier       Supplier? @relation(fields: [supplierId], references: [id])
  supplierName   String?
  locationId     String
  location       StoreLocation @relation("EntryLocation", fields: [locationId], references: [id])
  userId         String?
  user           User?     @relation("UserStockEntries", fields: [userId], references: [id])
  folio          Int
  totalItems     Int       @default(0)
  notes          String?
  status         String    @default("ACTIVE")   // ACTIVE | CANCELLED
  cancelledAt    DateTime?
  cancelledByName String?
  createdAt      DateTime  @default(now())
  items          StockEntryItem[]

  @@unique([sellerId, folio])
  @@index([sellerId, createdAt])
  @@index([productId, createdAt])
}

model StockEntryItem {
  id          String     @id @default(cuid())
  entryId     String
  entry       StockEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  variantId   String
  variant     Variant    @relation(fields: [variantId], references: [id])
  quantity    Int
  variantInfo String?
}
```

`productName`, `supplierName` y `variantInfo` son snapshots al momento de la
entrada, igual que en `StockTransferItem`: el historial debe seguir siendo legible
aunque después se renombre el producto o se cambie de proveedor.

`status` como `String` (no enum) por consistencia con `InventoryMovement.type` y
`Sale.status`, que ya usan strings en este esquema.

Un campo nuevo en `User`:

```prisma
canRegisterStockEntry Boolean @default(false)
```

Relaciones inversas a agregar: `User.stockEntries` (`"SellerStockEntries"`),
`User.stockEntriesMade` (`"UserStockEntries"`), `Product.stockEntries`,
`Supplier.stockEntries`, `StoreLocation.stockEntries` (`"EntryLocation"`),
`Variant.stockEntryItems`.

Aplicación del esquema: `npx prisma db push` (no hay migraciones versionadas).
El campo nuevo en `User` tiene default, y las tablas son nuevas: `db push` no
destruye datos existentes.

## Componentes y flujo

### Captura

Un solo formulario (`StockEntryForm`) con dos puntos de entrada:

- **Inventario → menú de tres puntitos del producto → 📥 Registrar Entrada**: el
  modelo llega preseleccionado.
- **Inventario → 📥 Entradas → + Nueva Entrada**: buscador de productos por nombre
  o SKU; al elegir uno se cargan sus variantes.

El formulario muestra:

- Proveedor del modelo (solo lectura). Si el producto no tiene `supplierId`, se
  indica "Sin proveedor asignado" y se permite continuar.
- Selector de sucursal, limitado a las sucursales permitidas del usuario. Si solo
  hay una, viene preseleccionada.
- Cuadrícula de variantes: color/talla, stock actual **en la sucursal elegida**, y
  un campo de cantidad recibida. Vacío o `0` = no se toca esa variante.
- Campo de notas opcional.
- Total en vivo de piezas a ingresar.

Validaciones: al menos una cantidad mayor que 0; no se aceptan negativos; el
producto debe pertenecer al vendedor; la sucursal debe pertenecer al vendedor y
estar permitida para el usuario.

La cantidad se captura en la **misma unidad que `Variant.stock`** (piezas), también
para productos con `sellByPackage`. El formulario no convierte paquetes a piezas.

Si el vendedor no tiene ninguna `StoreLocation` creada, el formulario no se abre y
se muestra un aviso con enlace a *Configuración → Sucursales*: sin sucursal no hay
`InventoryLevel` que incrementar.

### Escritura (server action `createStockEntry`)

Todo dentro de una `prisma.$transaction`:

1. Resolver `sellerId` con `resolveSellerId(user)` y verificar permiso.
2. Verificar que el producto y la sucursal pertenecen a ese `sellerId`, y que las
   variantes recibidas pertenecen al producto.
3. Calcular `folio` = último folio del vendedor + 1 (patrón de `createTransfer`).
4. Crear `StockEntry` + `StockEntryItem[]` con los snapshots.
5. Por cada renglón:
   - `inventoryLevel.upsert` incrementando el stock de esa sucursal.
   - `variant.update` incrementando `stock` (total global).
   - `inventoryMovement.create` con `type: 'RESTOCK'`, `quantity` positiva,
     `locationId`, y `reason: "Entrada E-000014. Usuario: <nombre>"` — mismo
     formato que usan los traspasos, para que el rastro interno siga cuadrando.
6. `revalidatePath` de `/inventory`, `/inventory/entries` y `/pos`.

### Consulta

- `getProductStockEntries(productId)` — historial de un modelo, más reciente
  primero, con sus renglones.
- `getStockEntries({ from, to, locationId, supplierId, page })` — listado general
  paginado con filtros.

Ambas aplican el mismo aislamiento: `sellerId` resuelto del usuario y, para
cajeros, filtro adicional por `allowedLocationIds`.

### Cancelación (server action `cancelStockEntry`)

Solo `role === 'SELLER'` dueño de la entrada. Dentro de una transacción:

1. Rechazar si `status !== 'ACTIVE'`.
2. Para cada renglón, verificar que el `InventoryLevel` de esa sucursal tiene al
   menos esa cantidad. Si alguno no alcanza, abortar toda la operación con el
   mensaje: *"No se puede cancelar: ya se vendieron piezas de esta entrada.
   Corrige con Ajustar Stock."*
3. Decrementar `InventoryLevel` y `Variant.stock`, y escribir un
   `InventoryMovement` de tipo `ADJUSTMENT` con cantidad negativa y
   `reason: "Cancelación de entrada E-000014. Usuario: <nombre>"`.
4. Marcar `status = 'CANCELLED'`, `cancelledAt`, `cancelledByName`.

La entrada permanece visible en ambos listados, marcada como cancelada, y sus
piezas no cuentan en los totales.

## Permisos

| Acción | SELLER (dueño) | CASHIER con `canRegisterStockEntry` | CASHIER sin el permiso | ADMIN marketplace |
|---|---|---|---|---|
| Registrar entrada | Cualquier sucursal propia | Solo sus `allowedLocationIds` | No | No |
| Ver historial | Todas las suyas | Solo sus sucursales | No | No |
| Cancelar entrada | Sí | No | No | No |

Toda validación se hace en el servidor dentro de la server action, no solo
ocultando la interfaz. La casilla nueva se agrega a la lista de permisos de
`settings/team/page.tsx` y a su server action correspondiente.

## Interfaz

**Menú lateral (`SidebarLayout.tsx`)** — nuevo elemento en el submenú de
Inventario, después de *Nuevo Producto*:

```
{ href: '/inventory/entries', label: '📥 Entradas' }
```

Visible para `SELLER` y para `CASHIER` con el permiso.

**Menú de tres puntitos del producto** (`inventory/page.tsx:817`) — dos opciones
nuevas: *📥 Registrar Entrada* y *📦 Entradas de este Modelo*, ambas condicionadas
al permiso.

**Historial por modelo** — modal, mismo patrón que el modal existente de
*Historial de Ventas*. Renglón colapsado: folio, fecha, sucursal, quién registró,
total de piezas. Al expandir: desglose por variante y notas.

**Pantalla `/inventory/entries`** — listado paginado con filtros de fecha,
sucursal y proveedor; botón *+ Nueva Entrada*; mismos renglones expandibles, más
el nombre del modelo.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | `StockEntry`, `StockEntryItem`, `User.canRegisterStockEntry`, relaciones inversas |
| `src/app/(seller-center)/inventory/entries/actions.ts` | nuevo — `createStockEntry`, `cancelStockEntry`, `getStockEntries`, `getProductStockEntries`, `searchProductsForEntry`, `getEntryFormData` |
| `src/app/(seller-center)/inventory/entries/page.tsx` | nuevo — pantalla general |
| `src/app/(seller-center)/inventory/entries/EntriesClient.tsx` | nuevo — listado + filtros |
| `src/app/(seller-center)/inventory/entries/StockEntryForm.tsx` | nuevo — formulario compartido |
| `src/app/(seller-center)/inventory/page.tsx` | opciones nuevas en el menú del producto + modal de historial |
| `src/app/(seller-center)/SidebarLayout.tsx` | elemento de menú |
| `src/app/(seller-center)/settings/team/page.tsx` | casilla de permiso |
| `src/app/(seller-center)/settings/team/actions.ts` | persistir el permiso |

`inventory/actions.ts` **no se modifica**: *Ajustar Stock* queda intacto.

## Criterios de verificación

1. Registrar una entrada de 5 piezas en la sucursal A → `InventoryLevel` de A sube
   5 y `Variant.stock` sube 5. Las demás sucursales no cambian.
2. La entrada aparece con el mismo folio y el mismo desglose en el historial del
   modelo y en el listado general.
3. Los folios son consecutivos por vendedor y no se repiten.
4. Cajero sin el permiso: no ve las opciones **y** la server action le responde
   "no autorizado" si se invoca directamente.
5. Cajero con el permiso: no puede registrar en una sucursal fuera de sus
   `allowedLocationIds`.
6. Un vendedor no puede ver ni tocar entradas de otro vendedor.
7. Cancelar una entrada devuelve `InventoryLevel` y `Variant.stock` a su valor
   previo, y la entrada queda marcada como cancelada, no borrada.
8. Cancelar una entrada de la que ya se vendieron piezas → se rechaza completa
   (ninguna variante se modifica) con el mensaje correspondiente.
9. Un cajero no puede cancelar entradas.
10. Cantidades negativas o todas en cero → se rechaza la captura.
11. *Ajustar Stock*, *Resurtido desde Bodega*, POS y traspasos siguen funcionando
    igual.
