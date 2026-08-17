# Compras a Proveedor y Cuentas por Pagar

## Contexto

Cuando a un vendedor le llega mercancía de un proveedor, hoy no hay dónde registrar el dinero: existe **Entradas de mercancía** (`/inventory/entries`, de esta semana) que suma cantidades al inventario, pero no captura costo, ni factura, ni forma de pago, y solo acepta productos existentes — una entrada = un solo producto.

Se necesita registrar la **nota de compra** completa: proveedor, varios productos (nuevos o existentes), costo unitario, total, y el abono que se haya dado al recibir. Después, consultar **cuánto se le debe a cada proveedor** y registrar abonos hasta saldar.

### Decisiones tomadas con el dueño

- **La compra reemplaza a Entradas de mercancía.** Solo hay 4 registros históricos (3 activos, todos suyos, de esta semana): no hay historial que migrar.
- **Alta rápida de producto dentro de la nota** (nombre + tallas/colores + precio de venta). Nace **fuera de línea**; las fotos se ponen después. También se eligen productos ya existentes en la misma nota.
- **Se entrega por fases:** primero la nota de compra usable, después las cuentas por pagar.
- **El costo de la remesa actualiza `Product.cost`** (el que alimenta los reportes de utilidad).
- **Se corrige el chequeo de nombre duplicado** para que sea por vendedor y no global.

### Lo que se copia de PHP Point of Sale

El dueño usaba PHPPOS y pidió replicar su pantalla de *Receiving*. Revisada en su demo, se adoptan cuatro cosas y se descartan el resto:

- **Captura tipo carrito.** Un solo buscador arriba (y lector de código de barras) que va soltando renglones, igual que el POS que ya existe en este proyecto — no un formulario por producto.
- **Precio de venta editable en el renglón.** Recibir mercancía a un costo nuevo es el momento en que se decide el precio de venta. De paso, los productos nuevos nacen con precio real.
- **Antigüedad de saldos** en cuentas por pagar: Corriente / 30 / 60 / 90 / 120 días.
- **Abono al recibir**, en vez de una decisión binaria contado/crédito: se abona nada, una parte o todo, y lo que quede es lo que se debe.

**Descartado a propósito** (no se pidió): descuentos de proveedor por renglón y sobre la nota, órdenes de compra previas, recepción por lotes, y separar "factura" de "recepción" como dos documentos (PHPPOS las separa; unirlas es más simple y cubre el caso descrito — el costo es que una factura no podrá cubrir varias recepciones).

**Sin función de suspender/borrador** (el dueño la descartó). Eso condiciona cómo se crean los productos nuevos: ver más abajo.

### Por qué el auto-post a Facebook/Instagram no corre riesgo

`postProductToSocialMedia` solo se dispara al crear un producto (`products/new/actions.ts:190`) **si queda en línea y tiene imagen**, y al editarlo (`products/[id]/edit/actions.ts:212-216`) **solo cuando pasa de fuera de línea a en línea**. Los productos que nacen en una compra se crean con `isOnline: false` y sin imágenes, así que **no publican nada**. Cuando el dueño les pone fotos y los activa, se publica una vez con la información completa. No hay que tocar ese código ni agregar banderas.

## Modelo de datos

Tres modelos nuevos en `prisma/schema.prisma`. `StockEntry`/`StockEntryItem` **quedan intactos** como historial de solo lectura.

```prisma
/// Nota de compra. INMUTABLE en cantidades y dinero: corregir = cancelar y
/// recapturar. Solo se editan invoiceNumber y notes.
model PurchaseNote {
  id       String @id @default(cuid())
  sellerId String
  seller   User   @relation("SellerPurchaseNotes", fields: [sellerId], references: [id])

  folio Int              // serie propia, se muestra C-000001
  supplierId   String
  supplier     Supplier @relation(fields: [supplierId], references: [id])
  supplierName String    // snapshot

  invoiceNumber String?  // folio del papel del proveedor, texto libre, no único
  noteDate      DateTime // fecha del documento, distinta de createdAt

  locationId String
  location   StoreLocation @relation("PurchaseNoteLocation", fields: [locationId], references: [id])
  userId     String?
  user       User?  @relation("UserPurchaseNotes", fields: [userId], references: [id])

  /// Etiqueta derivada por el servidor: "CASH" si el abono inicial cubrió el
  /// total, "CREDIT" si quedó saldo. Sirve para filtrar y reportar; NO es la
  /// fuente de verdad del adeudo — esa es `balance`.
  paymentType String
  creditDays  Int?      // plazo aplicado al saldo que quedó
  dueDate     DateTime? // noteDate + creditDays, congelado al guardar

  // ── DINERO (Float, round2 SIEMPRE antes de escribir) ──
  total      Float     // Σ lineTotal, calculado en servidor, nunca se recalcula
  paidAmount Float @default(0)
  balance    Float @default(0)
  paidAt     DateTime?

  totalItems Int     @default(0)
  notes      String?

  status          String    @default("ACTIVE")  // "ACTIVE" | "CANCELLED"
  cancelledAt     DateTime?
  cancelledByName String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items    PurchaseNoteItem[]
  payments SupplierPayment[]

  @@unique([sellerId, folio])
  @@index([sellerId, noteDate])
  @@index([sellerId, supplierId, status])
  @@index([sellerId, status, dueDate])   // antigüedad de saldos
}

/// Un renglón = una variante. La agrupación por producto que ve el usuario se
/// reconstruye con productId + lineOrder.
model PurchaseNoteItem {
  id             String       @id @default(cuid())
  purchaseNoteId String
  purchaseNote   PurchaseNote @relation(fields: [purchaseNoteId], references: [id], onDelete: Cascade)

  productId String
  product   Product @relation(fields: [productId], references: [id])
  variantId String
  variant   Variant @relation(fields: [variantId], references: [id])

  productName String   // snapshots: la nota se reimprime aunque renombren
  variantInfo String?

  quantity  Int
  unitCost  Float      // costo de ESTA remesa
  lineTotal Float      // round2(quantity * unitCost)
  lineOrder Int @default(0)

  @@index([purchaseNoteId])
  @@index([productId])       // "¿a cómo me ha costado este producto?"
  @@index([variantId])
}

/// Abono a una nota. Libro mayor auditable de pagos a proveedores.
model SupplierPayment {
  id String @id @default(cuid())

  // sellerId y supplierId denormalizados a propósito: el aislamiento por
  // vendedor debe expresarse en el WHERE de esta tabla, sin depender de un
  // join. Un filtro de seguridad que vive en un join se olvida algún día.
  sellerId   String
  seller     User     @relation("SellerSupplierPayments", fields: [sellerId], references: [id])
  supplierId String
  supplier   Supplier @relation(fields: [supplierId], references: [id])

  purchaseNoteId String
  purchaseNote   PurchaseNote @relation(fields: [purchaseNoteId], references: [id], onDelete: Cascade)

  amount Float
  paidAt DateTime

  paymentMethodId String?
  paymentMethod   PaymentMethod? @relation(fields: [paymentMethodId], references: [id])

  /// "INITIAL" = abono capturado al guardar la nota.
  /// "MANUAL"  = abono posterior, desde Cuentas por Pagar.
  /// La distinción es lo que permite cancelar una nota recién capturada por
  /// dedazo sin permitir cancelar una que ya tiene pagos reales encima.
  source String @default("MANUAL")
  notes  String?
  userId String?
  user   User?   @relation("UserSupplierPayments", fields: [userId], references: [id])

  status          String    @default("ACTIVE")  // "ACTIVE" | "CANCELLED"
  cancelledAt     DateTime?
  cancelledByName String?
  createdAt       DateTime  @default(now())

  @@index([purchaseNoteId, status])
  @@index([sellerId, supplierId, paidAt])
}
```

Back-relations a agregar (no crean columnas): `User` → `purchaseNotes`, `purchaseNotesMade`, `supplierPayments`, `supplierPaymentsMade`; `Supplier` → `purchaseNotes`, `payments`; `Product` → `purchaseItems`; `Variant` → `purchaseItems`; `StoreLocation` → `purchaseNotes`; `PaymentMethod` → `supplierPayments`.

### Decisiones del modelo

- **`Float`, como todo el dinero del proyecto** (`Sale.total`, `LayawayPayment.amount`, `Product.cost`). `Decimal` solo aquí rompe la unidad y no serializa a componentes cliente. **Exige un helper compartido:** `round2()` antes de toda escritura y **ninguna comparación con cero exacta** — `balance <= CENTAVO` con `CENTAVO = 0.005`. Sin esto hay notas que nunca se marcan pagadas por un residuo de coma flotante (333.33 + 333.33 + 333.34 ≠ 1000 exacto).
- **`balance` y `paidAmount` almacenados**, no derivados: la pantalla principal es un agregado por proveedor y la antigüedad de saldos solo se indexa sobre columnas reales. Mismo precedente que `Sale.balance` + `LayawayPayment`.
- **Modelos nuevos, no evolucionar `StockEntry`:** su `productId` está en la cabecera, así que multi-producto obligaría a reescribir todo lo que lo lee y dejaría los 4 registros ambiguos. Además son documentos distintos: una entrada mueve inventario, una nota crea un pasivo con vencimiento. **El historial unificado de inventario no es `StockEntry`, es `InventoryMovement`** — y la compra escribe ahí igual que hoy, así que la pantalla de movimientos por variante no queda con huecos.
- **Sin `SupplierAccount` ni `paymentStatus`:** serían terceras copias de la verdad. El saldo por proveedor se deriva con un `aggregate`.

## Invariantes a proteger

Todos en la server action, **ninguno en la UI**. El cliente manda ids y cantidades; nunca `sellerId`, `total` ni `balance`.

| # | Invariante | Dónde |
|---|---|---|
| I1 | Cada vendedor solo ve y toca lo suyo | `sellerId` dentro del `WHERE` de toda consulta, incluidas las de actualización |
| I2 | **Toda variante pertenece a un producto del mismo vendedor** | `variant.findMany({ where: { id: { in: ids }, product: { sellerId } } })` y comparar longitudes. **Es el invariante de seguridad más importante**: sin él se inyecta stock en catálogo ajeno |
| I3 | No abonar más que el saldo | `balance: { gte: amount - CENTAVO }` dentro del `WHERE` del candado |
| I4 | `balance = total - paidAmount`, `0 ≤ paidAmount ≤ total` | Solo el `updateMany` condicional escribe esos campos |
| I5 | Folio único por vendedor | `@@unique` + reintento del error P2002 hasta 3 veces (`createStockEntry` hoy no reintenta: no heredar ese bug) |
| I6 | `total` = Σ `lineTotal` calculado en servidor | El total que manda el navegador se ignora |
| I7 | Abono inicial ≤ total | Validación en la action antes de la transacción |
| I8 | La nota es inmutable | No existe acción que edite renglones ni montos |
| I9 | Sucursal del vendedor y dentro de `allowedLocationIds` si es cajero | Patrón ya presente en `createStockEntry:215-222` |

### Concurrencia: el antipatrón a NO copiar

`addLayawayPayment` (`products/new/actions.ts:644-671`) lee el saldo, valida en JS y escribe el valor calculado. Con Postgres en Read Committed, dos abonos simultáneos de $600 contra $1000 leen ambos 1000, validan ambos, y escriben ambos 400 — se abonan $1200 a una nota de $1000. La transacción interactiva de Prisma **no** previene esto.

La forma correcta, el mismo candado que ya usa `cancelStockEntry:421` pero con la condición monetaria dentro del `WHERE`:

```ts
const claimed = await tx.purchaseNote.updateMany({
  where: { id: noteId, sellerId, status: 'ACTIVE',
           balance: { gte: amount - CENTAVO } },
  data:  { paidAmount: { increment: amount }, balance: { decrement: amount } },
});
if (claimed.count !== 1) throw new Error('El monto excede el saldo pendiente…');
```

Postgres re-evalúa el predicado contra la fila ya actualizada, así que la segunda transacción devuelve `count: 0` y se rechaza. Luego, en la misma transacción, se crea el `SupplierPayment` y se cierra el residuo con otro `updateMany` condicional (`balance: { lte: CENTAVO }` → `balance: 0, paidAt: now`).

## Qué pasa al cancelar una nota

Dos ejes, ambos evaluados **antes** de tocar nada:

- **Mercancía:** se replica `cancelStockEntry:437-450` — se verifican todos los `InventoryLevel` primero; si a uno solo no le alcanza, se aborta completo. Nunca se deja stock negativo.
- **Dinero:** si la nota tiene algún abono **`MANUAL`** activo, **no se puede cancelar**; el dinero ya salió y no hay documento de nota de crédito. Los abonos `INITIAL` sí permiten cancelar (es el dedazo recién capturado) y se marcan `CANCELLED` en la misma transacción. La condición va dentro del `WHERE` del candado para ser atómica frente a un abono simultáneo.
- El mensaje de error debe decir **qué hacer**: cancelar primero los abonos en Cuentas por Pagar.

**Caso sin salida:** mercancía ya vendida **y** abonos manuales. Lo correcto sería una **devolución a proveedor**, documento distinto que no se pidió.

## Fase 1 — La nota de compra

**Archivos:**
- `prisma/schema.prisma` — los tres modelos completos, incluida `SupplierPayment` (el abono inicial la usa desde el día uno)
- `src/lib/sellerAccess.ts` (crear) — extraer `resolveEntryAccess` de `inventory/entries/actions.ts:14-29`. **No se puede exportar desde el archivo actual:** es `"use server"`, y exportar una función async ahí la convierte en endpoint HTTP público que devuelve el `sellerId`
- `src/lib/money.ts` (crear) — `round2()` y `CENTAVO`
- `src/app/(seller-center)/inventory/purchases/actions.ts` (crear) — `getPurchaseFormData`, `searchProductsForPurchase`, `getProductVariantsForPurchase`, `createPurchaseNote`, `getPurchaseNotes`, `getPurchaseNote`, `cancelPurchaseNote`
- `src/app/(seller-center)/inventory/purchases/page.tsx` + `PurchasesClient.tsx` + `PurchaseCart.tsx` (crear)
- `src/app/(seller-center)/products/new/actions.ts` — corregir el chequeo de nombre duplicado (líneas 106-115): agregar `sellerId` al `where`
- `src/app/(seller-center)/SidebarLayout.tsx` — "📥 Entradas" pasa a "🧾 Compras"; Entradas se retira del menú
- `src/app/(seller-center)/inventory/entries/EntriesClient.tsx` — quitar "+ Nueva Entrada" (queda como histórico consultable; `cancelStockEntry` sigue vivo para los 3 registros activos)

**Reutilizar, no reescribir:** `formatVariantLabel` y `sortVariantsByOptions` de `entries/actions.ts`; el patrón de folio y de candado de `createStockEntry`/`cancelStockEntry`; `createProduct` de `products/new/actions.ts:45`; el patrón de buscador con retraso de `StockEntryForm.tsx`.

**La pantalla (tipo carrito):**
- Arriba: buscador único de producto por nombre o SKU (y lector de código de barras), que agrega renglones.
- Cada renglón es un **producto**, y se expande para capturar **cantidad por variante**. **Costo unitario y precio de venta se capturan una vez por renglón**, no por variante: en ropa todas las tallas de un modelo cuestan y se venden igual, y capturarlo por variante multiplicaría el trabajo sin ganancia.
- Botón "+ Producto nuevo" que abre un formulario mínimo dentro de la misma pantalla: nombre, tallas/colores, costo y precio de venta.
- Panel derecho: proveedor, fecha de la nota, número de factura, total en vivo, **abono al recibir** (monto + método de pago, opcional) y plazo en días para lo que quede.

**Cuándo se crean los productos nuevos:** al **guardar la nota**, no al agregar el renglón (no hay borrador que los sostenga). El guardado hace, en orden:
1. Crear los productos nuevos con `createProduct({ isOnline: false, images: [], basePrice: precio capturado, cost, supplierId, variantOptions, variantsData con stock 0 })`, secuencialmente y **fuera** de la transacción — `createProduct` no es consciente de transacciones, genera slugs y valida el límite de plan.
2. Abrir la transacción con todos los `productId` ya resueltos: nota + renglones + inventario + abono inicial.
3. Si la transacción falla, borrar los productos recién creados (compensación best-effort). Si esa limpieza también falla, quedan productos fuera de línea, con precio y stock 0 — usables o borrables desde la Papelera, no basura.

**Actualización de `Product.cost` y `Product.price`:** dentro de la transacción, por cada producto de la nota, `cost` con el promedio ponderado de la remesa (`Σ lineTotal / Σ quantity`) y `price` con el precio de venta capturado en el renglón, si se capturó.

**Suma al inventario:** idéntica a hoy — `inventoryLevel.upsert` con `increment`, `variant.update` con `increment`, y `inventoryMovement.create` con `type: 'RESTOCK'` y `reason: "Compra C-000012. Usuario: X"`. Los `InventoryMovement` en un solo `createMany` para reducir escrituras.

**Timeout de transacción:** Prisma usa 5 s por defecto. Una nota de 15 productos × 8 variantes son 120 renglones; hay que subir `timeout`/`maxWait` explícitamente en la `$transaction` y poner un techo duro de renglones por nota validado en la action. **Es el riesgo con más probabilidad de morder en producción.**

### Verificación de la fase 1

1. `prisma validate` pasa; `prisma db push` **en el servidor** reporta solo operaciones aditivas (leer la salida antes de confirmar, nunca `--accept-data-loss`).
2. Capturar una nota con un producto existente y abono que cubre el total → inventario sube en esa sucursal, saldo 0, y aparece un `SupplierPayment` con `source: 'INITIAL'`.
3. Capturar una nota con abono parcial → saldo = total − abono, con su fecha de vencimiento calculada.
4. Capturar una nota sin abono → saldo = total.
5. Capturar una nota con 2 productos nuevos dados de alta ahí mismo → existen fuera de línea, con precio y stock, y **no se publicó nada en Facebook/Instagram** (revisar el log de PM2).
6. El total de la nota coincide con la suma de cantidad × costo de cada renglón.
7. `Product.cost` quedó en el promedio ponderado y `Product.price` en el precio capturado.
8. Cancelar una nota con abono inicial → inventario baja, nota CANCELLED, abono inicial CANCELLED.
9. Cancelar una nota cuya mercancía ya se vendió → se rechaza completa, sin stock negativo.
10. Como cajero **sin** el permiso: `/inventory/purchases` responde "Acceso restringido" y la server action rechaza aunque se invoque directo.
11. Dos vendedores pueden crear un producto con el mismo nombre (corrección del duplicado).
12. `node_modules/.bin/tsc --noEmit` sigue en 20 errores preexistentes.

## Fase 2 — Cuentas por pagar

- `getSupplierBalances()` — `aggregate` por proveedor sobre notas activas con saldo
- `getAgingBuckets()` — Corriente / 30 / 60 / 90 / 120 días, agrupando por `dueDate` contra hoy
- `getSupplierNotes(supplierId)` — detalle: folio, fecha, vencimiento, total, abonado, saldo
- `addSupplierPayment(...)` — el candado condicional de arriba, con `source: 'MANUAL'`
- `cancelSupplierPayment(id)` — el espejo (necesario para que el consejo del mensaje de cancelación sea ejecutable)
- Pantalla `/inventory/payables` con las cajas de antigüedad arriba y el desglose por proveedor abajo + entrada en el menú
- **Script de verificación de invariantes** en `scripts/`: recorre las notas y reporta las que no cumplen `paidAmount = Σ abonos activos` y `balance = total - paidAmount`. **Es el sustituto de las pruebas automatizadas**, que el proyecto no tiene.

### Verificación de la fase 2

1. Abonar $300 a una nota de $1000 → saldo $700, sigue pendiente.
2. Abonar el resto → saldo exactamente $0 y la nota se marca pagada.
3. Intentar abonar más que el saldo → se rechaza con mensaje claro.
4. Abonar en tres partes con decimales que no cierran redondo (333.33 / 333.33 / 333.34) → la nota **sí** queda marcada como pagada.
5. Cancelar un abono → el saldo vuelve a subir y la nota deja de estar pagada.
6. El saldo por proveedor coincide con la suma de los saldos de sus notas.
7. Una nota vencida hace 45 días aparece en la caja de "30", no en "Corriente".
8. El script de verificación de invariantes corre limpio en producción.

## Fuera de alcance (mencionado, no implementado)

- **El abono en efectivo no baja la caja.** Sale dinero del cajón y el corte Z no se entera. Es lo primero que va a chirriar; se resuelve con un `cashSessionId` en `SupplierPayment` y un `CashMovement` de salida, pero no se pidió.
- **Devolución a proveedor**, el camino correcto cuando la mercancía ya se vendió y hay abonos.
- **De PHPPOS, descartado:** descuentos por renglón y sobre la nota, órdenes de compra, recepción por lotes, factura separada de la recepción, y suspender/reanudar la nota.
- **Bug preexistente aparte:** `updateSupplier` y `deleteSupplier` (`inventory/suppliers/actions.ts:103,121`) no filtran por `sellerId` — un vendedor podría editar o borrar el proveedor de otro conociendo su id. No es alcanzable desde la interfaz. Se reporta para arreglarlo en otro trabajo.
