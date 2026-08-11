# Entradas de mercancía — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un vendedor pueda registrar la mercancía que le llega de un modelo ya creado, que se sume al inventario de la sucursal correspondiente, y que quede un historial consultable por modelo y general.

**Architecture:** Dos tablas nuevas (`StockEntry` + `StockEntryItem`) calcadas del patrón que el proyecto ya usa para traspasos (`StockTransfer` + `StockTransferItem`): cabecera con folio consecutivo por vendedor, sucursal, proveedor y quién la registró; renglones con variante y cantidad. Un solo formulario de captura reutilizado desde dos puntos de entrada. Un permiso booleano nuevo en `User` habilita a cajeros de confianza.

**Tech Stack:** Next.js 16 App Router (Server Actions + Client Components), Prisma 6.19.2 + PostgreSQL, Tailwind 4, `sonner` para avisos.

**Spec:** `docs/superpowers/specs/2026-08-11-entradas-inventario-design.md`

## Global Constraints

- **Sin dependencias nuevas.** El proyecto no tiene framework de pruebas (`package.json` solo trae `dev`, `build`, `start`, `lint`, `postinstall`) y no se va a agregar uno. La verificación local es de **tipos**; la verificación con datos ocurre en el servidor tras desplegar.
- **No hay base de datos accesible desde local.** `DATABASE_URL` apunta a producción (`187.124.158.239`) pero el puerto 5432 está cerrado al internet. **Ningún paso de este plan ejecuta consultas desde la laptop.** `prisma db push` se corre **en el servidor** (Tarea 9).
- **Nunca usar `npx` para Prisma.** Descarga Prisma 7 en vez del 6.19.2 del proyecto. Usar siempre `node_modules/.bin/prisma`. Si `node_modules` no existe, correr `npm install` primero.
- **`npm run build` no valida tipos** (`ignoreBuildErrors: true` en `next.config.ts`). La verificación de tipos útil es `node_modules/.bin/tsc --noEmit` **filtrando por los archivos tocados**: el proyecto arrastra ~20 errores de tipos preexistentes que no son de este trabajo.
- **El shell es zsh.** No usar variables para agrupar opciones de `ssh` (zsh no las divide en palabras); escribir las opciones en línea en cada comando.
- **Nunca transferir `.env` ni `.env.local` al servidor.** Antes de cualquier despliegue, listar los archivos y esperar confirmación del usuario (regla de `CLAUDE.md`).
- **El servidor puede ir adelante del repo.** Antes de subir cualquier archivo existente, comparar con el del servidor (`diff`) para no pisar código que no esté en git.
- **Prisma sin migraciones.** No existe `prisma/migrations/`. Los cambios de esquema se aplican con `prisma db push`.
- **No tocar:** `src/app/(seller-center)/inventory/actions.ts` (*Ajustar Stock*), `src/app/(seller-center)/inventory/restock/*` (*Resurtido desde Bodega*), `src/app/(seller-center)/pos/actions.ts` (traspasos y ventas), `src/app/actions/orders.ts`.
- **Texto de interfaz en español**, siguiendo el tono existente (`font-black`, `uppercase tracking-widest` en etiquetas, emojis en los elementos de menú).
- **Formato de folio:** `E-` + folio a 6 dígitos con ceros a la izquierda. Ejemplo: folio `14` → `E-000014`.
- **Las cantidades son piezas**, la misma unidad que `Variant.stock`, también en productos con `sellByPackage`. Ninguna pantalla convierte paquetes a piezas.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma` (modificar) | Modelos `StockEntry` y `StockEntryItem`, campo `User.canRegisterStockEntry`, relaciones inversas |
| `src/app/(seller-center)/inventory/entries/actions.ts` (crear) | Todas las server actions de entradas: acceso, búsqueda, creación, consulta, cancelación |
| `src/app/(seller-center)/inventory/entries/StockEntryForm.tsx` (crear) | Modal de captura, compartido por los dos puntos de entrada |
| `src/app/(seller-center)/inventory/entries/ProductStockEntriesModal.tsx` (crear) | Modal "Entradas de este Modelo" |
| `src/app/(seller-center)/inventory/entries/EntriesClient.tsx` (crear) | Listado general con filtros |
| `src/app/(seller-center)/inventory/entries/page.tsx` (crear) | Pantalla `/inventory/entries`: verifica sesión y permiso |
| `src/app/(seller-center)/SidebarLayout.tsx` (modificar) | Elemento de menú "📥 Entradas" |
| `src/app/(seller-center)/inventory/page.tsx` (modificar) | Dos opciones nuevas en el menú de tres puntitos + montaje de los modales |
| `src/app/(seller-center)/settings/team/page.tsx` (modificar) | Casilla de permiso |
| `src/app/(seller-center)/settings/team/actions.ts` (modificar) | Persistir el permiso |
| `scripts/verificar-entradas.mjs` (crear) | Chequeo de consistencia de solo lectura, para correr en el servidor |

---

### Task 1: Esquema de base de datos

**Files:**
- Modify: `prisma/schema.prisma` (modelo `User` ~línea 137, `Product` ~línea 256, `Variant` ~línea 296, `Supplier` ~línea 319, `StoreLocation` ~línea 116, final del archivo)

**Interfaces:**
- Consumes: nada.
- Produces: modelos `StockEntry` y `StockEntryItem`, y el campo `User.canRegisterStockEntry: boolean` (default `false`). Los usan las Tareas 2, 3, 4 y 8.

- [ ] **Step 1: Agregar el permiso al modelo `User`**

En `prisma/schema.prisma`, dentro de `model User`, junto a los demás permisos de cajero (después de `canCreateProducts Boolean @default(false)`):

```prisma
  canRegisterStockEntry     Boolean                @default(false)
```

- [ ] **Step 2: Agregar las relaciones inversas al modelo `User`**

Dentro de `model User`, junto a las relaciones existentes de traspasos (`stockTransfers`, `stockTransfersMade`):

```prisma
  stockEntries              StockEntry[]           @relation("SellerStockEntries")
  stockEntriesMade          StockEntry[]           @relation("UserStockEntries")
```

- [ ] **Step 3: Agregar las relaciones inversas a los demás modelos**

En `model Product`, junto a `variants Product[]`:

```prisma
  stockEntries         StockEntry[]
```

En `model Variant`, junto a `transferItems StockTransferItem[]`:

```prisma
  stockEntryItems    StockEntryItem[]
```

En `model Supplier`, junto a `products Product[]`:

```prisma
  stockEntries StockEntry[]
```

En `model StoreLocation`, junto a `transfersIn StockTransfer[] @relation("TransferDest")`:

```prisma
  stockEntries         StockEntry[]          @relation("EntryLocation")
```

- [ ] **Step 4: Agregar los dos modelos nuevos al final del archivo**

Al final de `prisma/schema.prisma`, después de `model StockTransferItem`:

```prisma
model StockEntry {
  id              String         @id @default(cuid())
  sellerId        String
  seller          User           @relation("SellerStockEntries", fields: [sellerId], references: [id])
  productId       String
  product         Product        @relation(fields: [productId], references: [id])
  productName     String
  supplierId      String?
  supplier        Supplier?      @relation(fields: [supplierId], references: [id])
  supplierName    String?
  locationId      String
  location        StoreLocation  @relation("EntryLocation", fields: [locationId], references: [id])
  userId          String?
  user            User?          @relation("UserStockEntries", fields: [userId], references: [id])
  folio           Int
  totalItems      Int            @default(0)
  notes           String?
  status          String         @default("ACTIVE")
  cancelledAt     DateTime?
  cancelledByName String?
  createdAt       DateTime       @default(now())
  items           StockEntryItem[]

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

`productName`, `supplierName` y `variantInfo` son copias del nombre al momento de la entrada, igual que en `StockTransferItem`: el historial debe seguir siendo legible aunque después se renombre el producto o cambie de proveedor. `status` es `String` (no enum) por consistencia con `InventoryMovement.type` y `Sale.status`.

- [ ] **Step 5: Validar el esquema**

Run:
```bash
node_modules/.bin/prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`. Si falta alguna relación inversa, Prisma dice exactamente cuál — agrégala y repite.

- [ ] **Step 6: Regenerar el cliente para tener los tipos en local**

Run:
```bash
node_modules/.bin/prisma generate
```
Expected: `Generated Prisma Client ... to ./src/generated/client`. **Este comando no toca la base de datos.** El `db push` real se hace en el servidor en la Tarea 9.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(esquema): tablas de entradas de mercancia y permiso de cajero"
```

---

### Task 2: Server actions — acceso, búsqueda y creación

**Files:**
- Create: `src/app/(seller-center)/inventory/entries/actions.ts`

**Interfaces:**
- Consumes: `StockEntry`, `StockEntryItem`, `User.canRegisterStockEntry` de la Tarea 1.
- Produces:
  - `getEntryLocations(): Promise<{ id: string; name: string }[]>`
  - `searchProductsForEntry(query: string): Promise<{ id: string; name: string; sku: string | null; image: string | null; supplierName: string | null }[]>`
  - `getProductForEntry(productId: string, locationId: string): Promise<{ id, name, supplierName, variants: { id, label, currentStock }[] } | null>`
  - `createStockEntry(input: { productId: string; locationId: string; notes?: string; items: { variantId: string; quantity: number }[] }): Promise<{ success: boolean; folio?: number; error?: string }>`

  Los usan las Tareas 5, 6 y 7.

- [ ] **Step 1: Crear el archivo con los ayudantes de acceso**

Crear `src/app/(seller-center)/inventory/entries/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

// Quién puede tocar entradas y sobre qué sucursales.
// SELLER: todas las suyas (allowedLocationIds = null significa "sin restricción").
// CASHIER: solo si tiene el permiso, y solo sus sucursales asignadas.
async function resolveEntryAccess(): Promise<any> {
    const user: any = await getSessionUser();
    if (!user) return { error: 'No autorizado.' };
    if (user.role === 'SELLER') {
        return { user, sellerId: user.id, allowedLocationIds: null };
    }
    if (user.role === 'CASHIER' && user.canRegisterStockEntry) {
        if (!user.managedBySellerId) return { error: 'No autorizado.' };
        return {
            user,
            sellerId: user.managedBySellerId,
            allowedLocationIds: user.allowedLocationIds || [],
        };
    }
    return { error: 'No autorizado.' };
}

// Mismo criterio de nombre de variante que usa la pantalla de inventario.
function formatVariantLabel(variant: any): string {
    if (variant?.attributes && typeof variant.attributes === 'object') {
        const parts = Object.values(variant.attributes as Record<string, any>);
        if (parts.length > 0) return parts.join(' / ');
    }
    if (variant?.color && variant?.size) return `${variant.color} / ${variant.size}`;
    if (variant?.color) return variant.color;
    if (variant?.size) return variant.size;
    return 'Única';
}

function folioText(folio: number): string {
    return `E-${String(folio).padStart(6, '0')}`;
}
```

- [ ] **Step 2: Agregar la consulta de sucursales permitidas**

Al final del mismo archivo:

```ts
export async function getEntryLocations() {
    const access: any = await resolveEntryAccess();
    if (access.error) return [];
    const where: any = { sellerId: access.sellerId };
    if (access.allowedLocationIds) where.id = { in: access.allowedLocationIds };
    return await prisma.storeLocation.findMany({
        where,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
}
```

- [ ] **Step 3: Agregar el buscador de productos**

```ts
export async function searchProductsForEntry(query: string) {
    const access: any = await resolveEntryAccess();
    if (access.error) return [];
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const products = await prisma.product.findMany({
        where: {
            sellerId: access.sellerId,
            isActive: true,
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
            ],
        },
        select: {
            id: true,
            name: true,
            sku: true,
            images: true,
            supplier: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
        take: 20,
    });

    return products.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: p.images?.[0] || null,
        supplierName: p.supplier?.name || null,
    }));
}
```

- [ ] **Step 4: Agregar la carga de variantes con stock de la sucursal**

```ts
export async function getProductForEntry(productId: string, locationId: string) {
    const access: any = await resolveEntryAccess();
    if (access.error) return null;

    const product: any = await prisma.product.findFirst({
        where: { id: productId, sellerId: access.sellerId },
        select: {
            id: true,
            name: true,
            supplier: { select: { name: true } },
            variants: {
                select: {
                    id: true,
                    color: true,
                    size: true,
                    attributes: true,
                    inventoryLevels: {
                        where: { locationId },
                        select: { stock: true },
                    },
                },
                orderBy: [{ color: 'asc' }, { size: 'asc' }],
            },
        },
    });
    if (!product) return null;

    return {
        id: product.id,
        name: product.name,
        supplierName: product.supplier?.name || null,
        variants: product.variants.map((v: any) => ({
            id: v.id,
            label: formatVariantLabel(v),
            currentStock: v.inventoryLevels?.[0]?.stock ?? 0,
        })),
    };
}
```

- [ ] **Step 5: Agregar la creación de la entrada**

```ts
export async function createStockEntry(input: {
    productId: string;
    locationId: string;
    notes?: string;
    items: { variantId: string; quantity: number }[];
}) {
    try {
        const access: any = await resolveEntryAccess();
        if (access.error) return { success: false, error: access.error };

        const items = (input.items || [])
            .map(i => ({ variantId: i.variantId, quantity: Number(i.quantity) }))
            .filter(i => i.quantity > 0);

        if (items.length === 0) {
            return { success: false, error: 'Captura al menos una cantidad mayor que cero.' };
        }
        if (items.some(i => !Number.isInteger(i.quantity))) {
            return { success: false, error: 'Las cantidades deben ser números enteros.' };
        }

        const location = await prisma.storeLocation.findFirst({
            where: { id: input.locationId, sellerId: access.sellerId },
            select: { id: true },
        });
        if (!location) return { success: false, error: 'Sucursal no válida.' };
        if (access.allowedLocationIds && !access.allowedLocationIds.includes(input.locationId)) {
            return { success: false, error: 'No tienes acceso a esa sucursal.' };
        }

        const product: any = await prisma.product.findFirst({
            where: { id: input.productId, sellerId: access.sellerId },
            select: {
                id: true,
                name: true,
                supplierId: true,
                supplier: { select: { name: true } },
                variants: { select: { id: true, color: true, size: true, attributes: true } },
            },
        });
        if (!product) return { success: false, error: 'Producto no válido.' };

        const variantMap = new Map<string, any>(product.variants.map((v: any) => [v.id, v]));
        if (items.some(i => !variantMap.has(i.variantId))) {
            return { success: false, error: 'Alguna variante no pertenece a este producto.' };
        }

        const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

        const nextFolio = await prisma.$transaction(async (tx) => {
            const last = await (tx as any).stockEntry.findFirst({
                where: { sellerId: access.sellerId },
                orderBy: { folio: 'desc' },
                select: { folio: true },
            });
            const folio = (last?.folio ?? 0) + 1;

            await (tx as any).stockEntry.create({
                data: {
                    sellerId: access.sellerId,
                    productId: product.id,
                    productName: product.name,
                    supplierId: product.supplierId,
                    supplierName: product.supplier?.name || null,
                    locationId: input.locationId,
                    userId: access.user.id,
                    folio,
                    totalItems,
                    notes: input.notes?.trim() || null,
                    items: {
                        create: items.map(i => ({
                            variantId: i.variantId,
                            quantity: i.quantity,
                            variantInfo: formatVariantLabel(variantMap.get(i.variantId)),
                        })),
                    },
                },
            });

            for (const item of items) {
                await tx.inventoryLevel.upsert({
                    where: {
                        variantId_locationId: {
                            variantId: item.variantId,
                            locationId: input.locationId,
                        },
                    },
                    create: {
                        variantId: item.variantId,
                        locationId: input.locationId,
                        stock: item.quantity,
                    },
                    update: { stock: { increment: item.quantity } },
                });

                await tx.variant.update({
                    where: { id: item.variantId },
                    data: { stock: { increment: item.quantity } },
                });

                await tx.inventoryMovement.create({
                    data: {
                        variantId: item.variantId,
                        locationId: input.locationId,
                        type: 'RESTOCK',
                        quantity: item.quantity,
                        reason: `Entrada ${folioText(folio)}. Usuario: ${access.user.name || 'Sistema'}`,
                    },
                });
            }

            return folio;
        });

        revalidatePath('/inventory');
        revalidatePath('/inventory/entries');
        revalidatePath('/pos');
        return { success: true, folio: nextFolio };
    } catch (error: any) {
        console.error('Error al registrar la entrada:', error);
        return { success: false, error: 'No se pudo registrar la entrada.' };
    }
}
```

Lo importante de esta acción: incrementa **los dos** lugares donde vive el stock (`InventoryLevel` de la sucursal **y** `Variant.stock` global), a diferencia de los traspasos, que solo mueven `InventoryLevel` porque el total no cambia.

- [ ] **Step 6: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "inventory/entries" || echo "SIN ERRORES en inventory/entries"
```
Expected: `SIN ERRORES en inventory/entries`. Si aparece `Property 'stockEntry' does not exist`, falta correr `node_modules/.bin/prisma generate` (Tarea 1, paso 6).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(seller-center)/inventory/entries/actions.ts"
git commit -m "feat(entradas): accion para registrar entradas de mercancia"
```

---

### Task 3: Server actions — consulta del historial

**Files:**
- Modify: `src/app/(seller-center)/inventory/entries/actions.ts`

**Interfaces:**
- Consumes: `resolveEntryAccess`, `folioText` de la Tarea 2.
- Produces:
  - `getProductStockEntries(productId: string): Promise<{ success: boolean; entries: EntryRow[]; error?: string }>`
  - `getStockEntries(params: { from?: string; to?: string; locationId?: string; supplierId?: string; page?: number }): Promise<{ success: boolean; rows: EntryRow[]; total: number; page: number; totalPages: number; error?: string }>`

  donde `EntryRow = { id: string; folio: string; createdAt: Date; productId: string; productName: string; supplierName: string | null; locationName: string; userName: string | null; totalItems: number; notes: string | null; status: string; cancelledAt: Date | null; cancelledByName: string | null; items: { id: string; variantInfo: string | null; quantity: number }[] }`.

  Los usan las Tareas 6 y 7.

- [ ] **Step 1: Agregar el ayudante que da forma a un renglón**

En `src/app/(seller-center)/inventory/entries/actions.ts`, junto a los demás ayudantes no exportados (arriba, después de `folioText`):

```ts
function serializeEntry(entry: any) {
    return {
        id: entry.id,
        folio: folioText(entry.folio),
        createdAt: entry.createdAt,
        productId: entry.productId,
        productName: entry.productName,
        supplierName: entry.supplierName,
        locationName: entry.location?.name || '—',
        userName: entry.user?.name || null,
        totalItems: entry.totalItems,
        notes: entry.notes,
        status: entry.status,
        cancelledAt: entry.cancelledAt,
        cancelledByName: entry.cancelledByName,
        items: (entry.items || []).map((it: any) => ({
            id: it.id,
            variantInfo: it.variantInfo,
            quantity: it.quantity,
        })),
    };
}
```

- [ ] **Step 2: Agregar el historial por modelo**

Al final del archivo:

```ts
export async function getProductStockEntries(productId: string) {
    try {
        const access: any = await resolveEntryAccess();
        if (access.error) return { success: false, error: access.error, entries: [] };

        const where: any = { sellerId: access.sellerId, productId };
        if (access.allowedLocationIds) where.locationId = { in: access.allowedLocationIds };

        const entries = await (prisma as any).stockEntry.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                items: { select: { id: true, variantInfo: true, quantity: true } },
                location: { select: { name: true } },
                user: { select: { name: true } },
            },
        });

        return { success: true, entries: entries.map(serializeEntry) };
    } catch (error: any) {
        console.error('Error al cargar el historial de entradas:', error);
        return { success: false, error: 'No se pudo cargar el historial.', entries: [] };
    }
}
```

El tope de 100 es deliberado: un modelo no acumula más entradas que eso en la práctica, y evita paginar un modal.

- [ ] **Step 3: Agregar el listado general con filtros**

```ts
export async function getStockEntries(params: {
    from?: string;
    to?: string;
    locationId?: string;
    supplierId?: string;
    page?: number;
}) {
    try {
        const access: any = await resolveEntryAccess();
        if (access.error) {
            return { success: false, error: access.error, rows: [], total: 0, page: 1, totalPages: 1 };
        }

        const pageSize = 25;
        const page = Math.max(1, params.page || 1);

        const where: any = { sellerId: access.sellerId };
        if (access.allowedLocationIds) where.locationId = { in: access.allowedLocationIds };
        if (params.locationId) where.locationId = params.locationId;
        if (params.supplierId) where.supplierId = params.supplierId;
        if (params.from || params.to) {
            where.createdAt = {};
            if (params.from) where.createdAt.gte = new Date(params.from);
            if (params.to) {
                const to = new Date(params.to);
                to.setHours(23, 59, 59, 999);
                where.createdAt.lte = to;
            }
        }

        const [total, entries] = await Promise.all([
            (prisma as any).stockEntry.count({ where }),
            (prisma as any).stockEntry.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    items: { select: { id: true, variantInfo: true, quantity: true } },
                    location: { select: { name: true } },
                    user: { select: { name: true } },
                },
            }),
        ]);

        return {
            success: true,
            rows: entries.map(serializeEntry),
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
    } catch (error: any) {
        console.error('Error al cargar las entradas:', error);
        return { success: false, error: 'No se pudieron cargar las entradas.', rows: [], total: 0, page: 1, totalPages: 1 };
    }
}
```

Nota sobre el filtro de sucursal: si el usuario es cajero, `where.locationId` primero se limita a sus sucursales y luego, si eligió una en el filtro, se sobrescribe con esa. Para que no pueda colarse una sucursal ajena, agregar la validación justo después de aplicar el filtro:

```ts
        if (params.locationId && access.allowedLocationIds && !access.allowedLocationIds.includes(params.locationId)) {
            return { success: true, rows: [], total: 0, page: 1, totalPages: 1 };
        }
```

Colocar ese bloque **antes** de las consultas `count`/`findMany`.

- [ ] **Step 4: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "inventory/entries" || echo "SIN ERRORES en inventory/entries"
```
Expected: `SIN ERRORES en inventory/entries`

- [ ] **Step 5: Commit**

```bash
git add "src/app/(seller-center)/inventory/entries/actions.ts"
git commit -m "feat(entradas): consultas de historial por modelo y listado general"
```

---

### Task 4: Server action — cancelar una entrada

**Files:**
- Modify: `src/app/(seller-center)/inventory/entries/actions.ts`

**Interfaces:**
- Consumes: `folioText` de la Tarea 2.
- Produces: `cancelStockEntry(entryId: string): Promise<{ success: boolean; error?: string }>`. La usan las Tareas 6 y 7.

- [ ] **Step 1: Agregar la acción de cancelación**

Al final de `src/app/(seller-center)/inventory/entries/actions.ts`:

```ts
export async function cancelStockEntry(entryId: string) {
    try {
        const user: any = await getSessionUser();
        if (!user || user.role !== 'SELLER') {
            return { success: false, error: 'Solo el dueño de la tienda puede cancelar una entrada.' };
        }

        await prisma.$transaction(async (tx) => {
            const entry: any = await (tx as any).stockEntry.findFirst({
                where: { id: entryId, sellerId: user.id },
                include: { items: true },
            });
            if (!entry) throw new Error('Entrada no encontrada.');
            if (entry.status !== 'ACTIVE') throw new Error('Esta entrada ya está cancelada.');

            // Primero se revisa TODO: si una sola variante no alcanza, no se toca nada.
            for (const item of entry.items) {
                const level = await tx.inventoryLevel.findUnique({
                    where: {
                        variantId_locationId: {
                            variantId: item.variantId,
                            locationId: entry.locationId,
                        },
                    },
                });
                if (!level || level.stock < item.quantity) {
                    throw new Error('No se puede cancelar: ya se vendieron piezas de esta entrada. Corrige con Ajustar Stock.');
                }
            }

            for (const item of entry.items) {
                await tx.inventoryLevel.update({
                    where: {
                        variantId_locationId: {
                            variantId: item.variantId,
                            locationId: entry.locationId,
                        },
                    },
                    data: { stock: { decrement: item.quantity } },
                });

                await tx.variant.update({
                    where: { id: item.variantId },
                    data: { stock: { decrement: item.quantity } },
                });

                await tx.inventoryMovement.create({
                    data: {
                        variantId: item.variantId,
                        locationId: entry.locationId,
                        type: 'ADJUSTMENT',
                        quantity: -item.quantity,
                        reason: `Cancelación de entrada ${folioText(entry.folio)}. Usuario: ${user.name || 'Sistema'}`,
                    },
                });
            }

            await (tx as any).stockEntry.update({
                where: { id: entry.id },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancelledByName: user.name || null,
                },
            });
        });

        revalidatePath('/inventory');
        revalidatePath('/inventory/entries');
        revalidatePath('/pos');
        return { success: true };
    } catch (error: any) {
        console.error('Error al cancelar la entrada:', error);
        return { success: false, error: error.message || 'No se pudo cancelar la entrada.' };
    }
}
```

Dos decisiones que no hay que cambiar: la validación va en un ciclo aparte **antes** de tocar nada (si falla, la transacción no deja mitad hecho), y la entrada se marca `CANCELLED` en vez de borrarse.

- [ ] **Step 2: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "inventory/entries" || echo "SIN ERRORES en inventory/entries"
```
Expected: `SIN ERRORES en inventory/entries`

- [ ] **Step 3: Commit**

```bash
git add "src/app/(seller-center)/inventory/entries/actions.ts"
git commit -m "feat(entradas): cancelar una entrada revirtiendo el inventario"
```

---

### Task 5: Formulario de captura compartido

**Files:**
- Create: `src/app/(seller-center)/inventory/entries/StockEntryForm.tsx`

**Interfaces:**
- Consumes: `getEntryLocations`, `searchProductsForEntry`, `getProductForEntry`, `createStockEntry` de la Tarea 2.
- Produces: componente por defecto `StockEntryForm({ initialProductId, onClose, onSaved })`, con `initialProductId?: string`, `onClose: () => void`, `onSaved: () => void`. Lo usan las Tareas 6 y 7.

- [ ] **Step 1: Crear el componente**

Crear `src/app/(seller-center)/inventory/entries/StockEntryForm.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    getEntryLocations,
    searchProductsForEntry,
    getProductForEntry,
    createStockEntry,
} from './actions';

export default function StockEntryForm({
    initialProductId,
    onClose,
    onSaved,
}: {
    initialProductId?: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [locations, setLocations] = useState<any[]>([]);
    const [locationId, setLocationId] = useState<string>('');
    const [loadingLocations, setLoadingLocations] = useState(true);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const [product, setProduct] = useState<any>(null);
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [quantities, setQuantities] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Sucursales permitidas
    useEffect(() => {
        getEntryLocations().then(locs => {
            setLocations(locs);
            if (locs.length > 0) setLocationId(locs[0].id);
            setLoadingLocations(false);
        });
    }, []);

    // Búsqueda con retraso para no consultar en cada tecla
    useEffect(() => {
        if (product) return;
        if (query.trim().length < 2) { setResults([]); return; }
        setSearching(true);
        const t = setTimeout(async () => {
            const res = await searchProductsForEntry(query);
            setResults(res);
            setSearching(false);
        }, 350);
        return () => clearTimeout(t);
    }, [query, product]);

    // Carga de variantes: al elegir producto y cada vez que cambia la sucursal
    const loadProduct = async (productId: string, locId: string) => {
        if (!locId) return;
        setLoadingProduct(true);
        const data = await getProductForEntry(productId, locId);
        setProduct(data);
        setQuantities({});
        setLoadingProduct(false);
        if (!data) toast.error('No se pudo cargar el producto.');
    };

    useEffect(() => {
        if (initialProductId && locationId) loadProduct(initialProductId, locationId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialProductId, locationId]);

    useEffect(() => {
        if (!initialProductId && product?.id && locationId) loadProduct(product.id, locationId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationId]);

    const total = Object.values(quantities).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);

    const handleSave = async () => {
        const items = Object.entries(quantities)
            .map(([variantId, value]) => ({ variantId, quantity: parseInt(value, 10) || 0 }))
            .filter(i => i.quantity > 0);

        if (!product) { toast.error('Elige un producto.'); return; }
        if (!locationId) { toast.error('Elige una sucursal.'); return; }
        if (items.length === 0) { toast.error('Captura al menos una cantidad.'); return; }

        setSaving(true);
        const res = await createStockEntry({ productId: product.id, locationId, notes, items });
        setSaving(false);

        if (res.success) {
            toast.success(`Entrada E-${String(res.folio).padStart(6, '0')} registrada · ${total} piezas`);
            onSaved();
            onClose();
        } else {
            toast.error(res.error || 'No se pudo registrar la entrada.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black">📥 Registrar Entrada</h3>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                            Las cantidades se suman al inventario
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-foreground text-2xl leading-none">×</button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto">
                    {!loadingLocations && locations.length === 0 && (
                        <div className="p-5 rounded-xl border border-dashed border-border text-center">
                            <p className="font-black text-sm mb-1">No tienes sucursales dadas de alta</p>
                            <p className="text-xs text-gray-500">
                                Crea una en <a href="/settings/locations" className="text-blue-600 underline">Configuración → Sucursales</a> para poder registrar entradas.
                            </p>
                        </div>
                    )}

                    {locations.length > 0 && (
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sucursal donde llegó</label>
                            <select
                                value={locationId}
                                onChange={e => setLocationId(e.target.value)}
                                className="mt-2 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                            >
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    )}

                    {!initialProductId && !product && locations.length > 0 && (
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Buscar modelo</label>
                            <input
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Nombre o SKU del modelo…"
                                className="mt-2 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                            />
                            {searching && <p className="mt-2 text-xs text-gray-400">Buscando…</p>}
                            {!searching && query.trim().length >= 2 && results.length === 0 && (
                                <p className="mt-2 text-xs text-gray-400">Sin resultados.</p>
                            )}
                            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                                {results.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => { setResults([]); setQuery(''); loadProduct(r.id, locationId); }}
                                        className="w-full text-left p-3 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <p className="font-black text-sm">{r.name}</p>
                                        <p className="text-[10px] text-gray-400 font-medium">
                                            {r.sku ? `SKU ${r.sku} · ` : ''}{r.supplierName || 'Sin proveedor'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {loadingProduct && <p className="text-sm text-gray-400">Cargando variantes…</p>}

                    {product && (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-black text-base">{product.name}</p>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                        Proveedor: {product.supplierName || 'Sin proveedor asignado'}
                                    </p>
                                </div>
                                {!initialProductId && (
                                    <button
                                        onClick={() => { setProduct(null); setQuantities({}); }}
                                        className="text-xs font-black text-blue-600 hover:underline shrink-0"
                                    >
                                        Cambiar modelo
                                    </button>
                                )}
                            </div>

                            <div className="border border-border rounded-xl divide-y divide-border">
                                {product.variants.map((v: any) => (
                                    <div key={v.id} className="flex items-center gap-3 p-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm truncate">{v.label}</p>
                                            <p className="text-[10px] text-gray-400 font-medium">Tienes {v.currentStock} en esta sucursal</p>
                                        </div>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            inputMode="numeric"
                                            value={quantities[v.id] ?? ''}
                                            onChange={e => setQuantities(q => ({ ...q, [v.id]: e.target.value }))}
                                            placeholder="0"
                                            className="w-24 p-2 rounded-lg border border-border bg-transparent text-center font-black"
                                        />
                                    </div>
                                ))}
                                {product.variants.length === 0 && (
                                    <p className="p-4 text-xs text-gray-400">Este modelo no tiene variantes. Agrégalas en Editar Producto.</p>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nota (opcional)</label>
                                <input
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Ej. nota 4471, llegó incompleto…"
                                    className="mt-2 w-full p-3 rounded-xl border border-border bg-transparent font-bold text-sm"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-border flex items-center gap-3">
                    <p className="flex-1 text-sm font-black">
                        {total > 0 ? `Vas a ingresar ${total} pieza${total === 1 ? '' : 's'}` : 'Sin cantidades capturadas'}
                    </p>
                    <button onClick={onClose} className="px-5 py-3 border border-border rounded-xl font-black uppercase tracking-widest text-xs text-gray-500">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || total === 0}
                        className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-40"
                    >
                        {saving ? 'Guardando…' : 'Guardar entrada'}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "inventory/entries" || echo "SIN ERRORES en inventory/entries"
```
Expected: `SIN ERRORES en inventory/entries`

- [ ] **Step 3: Commit**

```bash
git add "src/app/(seller-center)/inventory/entries/StockEntryForm.tsx"
git commit -m "feat(entradas): formulario de captura compartido"
```

---

### Task 6: Pantalla general `/inventory/entries` y menú lateral

**Files:**
- Create: `src/app/(seller-center)/inventory/entries/EntriesClient.tsx`
- Create: `src/app/(seller-center)/inventory/entries/page.tsx`
- Modify: `src/app/(seller-center)/SidebarLayout.tsx` (submenú de Inventario ~línea 407)

**Interfaces:**
- Consumes: `getStockEntries`, `cancelStockEntry`, `getEntryLocations` (Tareas 2-4), `StockEntryForm` (Tarea 5), `getSuppliers` de `../../products/new/actions`.
- Produces: la ruta `/inventory/entries`. La Tarea 9 la verifica en el navegador.

- [ ] **Step 1: Crear el cliente del listado**

Crear `src/app/(seller-center)/inventory/entries/EntriesClient.tsx`:

```tsx
"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getStockEntries, cancelStockEntry, getEntryLocations } from './actions';
import { getSuppliers } from '../../products/new/actions';
import StockEntryForm from './StockEntryForm';

export default function EntriesClient({ canCancel }: { canCancel: boolean }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [locations, setLocations] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [locationId, setLocationId] = useState('');
    const [supplierId, setSupplierId] = useState('');

    const [expanded, setExpanded] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getStockEntries({ from, to, locationId, supplierId, page });
        setRows(res.rows || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setLoading(false);
    }, [from, to, locationId, supplierId, page]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        getEntryLocations().then(setLocations);
        getSuppliers().then((s: any) => setSuppliers(Array.isArray(s) ? s : []));
    }, []);

    const handleCancel = async (entry: any) => {
        if (!confirm(`¿Cancelar la entrada ${entry.folio}? Se van a restar ${entry.totalItems} piezas del inventario.`)) return;
        const res = await cancelStockEntry(entry.id);
        if (res.success) { toast.success('Entrada cancelada'); load(); }
        else toast.error(res.error || 'No se pudo cancelar.');
    };

    return (
        <div className="p-8">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black">📥 Entradas de Mercancía</h1>
                    <p className="text-xs text-gray-400 font-medium">{total} entrada{total === 1 ? '' : 's'} registrada{total === 1 ? '' : 's'}</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition"
                >
                    + Nueva Entrada
                </button>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Desde</label>
                    <input type="date" value={from} onChange={e => { setPage(1); setFrom(e.target.value); }}
                        className="mt-1 w-full p-2 rounded-lg border border-border bg-transparent text-sm font-bold" />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Hasta</label>
                    <input type="date" value={to} onChange={e => { setPage(1); setTo(e.target.value); }}
                        className="mt-1 w-full p-2 rounded-lg border border-border bg-transparent text-sm font-bold" />
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sucursal</label>
                    <select value={locationId} onChange={e => { setPage(1); setLocationId(e.target.value); }}
                        className="mt-1 w-full p-2 rounded-lg border border-border bg-transparent text-sm font-bold">
                        <option value="">Todas</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedor</label>
                    <select value={supplierId} onChange={e => { setPage(1); setSupplierId(e.target.value); }}
                        className="mt-1 w-full p-2 rounded-lg border border-border bg-transparent text-sm font-bold">
                        <option value="">Todos</option>
                        {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {loading && <p className="text-sm text-gray-400">Cargando…</p>}

            {!loading && rows.length === 0 && (
                <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
                    <div className="text-4xl mb-3">📥</div>
                    <h2 className="text-lg font-bold mb-1">Todavía no hay entradas registradas</h2>
                    <p className="text-gray-500 text-sm">Cuando te llegue mercancía, regístrala con “+ Nueva Entrada”.</p>
                </div>
            )}

            <div className="space-y-2">
                {rows.map(entry => (
                    <div key={entry.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                            className="w-full text-left p-4 flex items-center gap-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <p className={`font-black text-sm truncate ${entry.status === 'CANCELLED' ? 'line-through text-gray-400' : ''}`}>
                                    {entry.productName}
                                </p>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest truncate">
                                    {entry.folio} · {new Date(entry.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · {entry.locationName}
                                    {entry.userName ? ` · ${entry.userName}` : ''}
                                </p>
                            </div>
                            {entry.status === 'CANCELLED' ? (
                                <span className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-wide shrink-0">Cancelada</span>
                            ) : (
                                <span className="font-black text-emerald-600 shrink-0">+{entry.totalItems}</span>
                            )}
                            <span className="text-gray-400 shrink-0">{expanded === entry.id ? '▾' : '▸'}</span>
                        </button>

                        {expanded === entry.id && (
                            <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                                <div className="flex flex-wrap gap-2">
                                    {entry.items.map((it: any) => (
                                        <span key={it.id} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">
                                            {it.variantInfo || 'Única'}: {it.quantity}
                                        </span>
                                    ))}
                                </div>
                                {entry.supplierName && <p className="text-[11px] text-gray-500 font-medium">Proveedor: {entry.supplierName}</p>}
                                {entry.notes && <p className="text-[11px] text-gray-500 font-medium">Nota: {entry.notes}</p>}
                                {entry.status === 'CANCELLED' && (
                                    <p className="text-[11px] text-red-500 font-bold">
                                        Cancelada el {new Date(entry.cancelledAt).toLocaleDateString('es-MX')}
                                        {entry.cancelledByName ? ` por ${entry.cancelledByName}` : ''}
                                    </p>
                                )}
                                {canCancel && entry.status === 'ACTIVE' && (
                                    <button onClick={() => handleCancel(entry)} className="text-[11px] font-black text-red-500 hover:underline">
                                        Cancelar esta entrada
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 border border-border rounded-xl text-xs font-black uppercase disabled:opacity-30">Anterior</button>
                    <span className="text-xs font-bold text-gray-500">{page} de {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 border border-border rounded-xl text-xs font-black uppercase disabled:opacity-30">Siguiente</button>
                </div>
            )}

            {showForm && (
                <StockEntryForm onClose={() => setShowForm(false)} onSaved={() => { setPage(1); load(); }} />
            )}
        </div>
    );
}
```

- [ ] **Step 2: Nota sobre `getSuppliers`**

`getSuppliers()` (en `products/new/actions.ts`) devuelve el arreglo de proveedores directamente, con `id` y `name` — por eso EntriesClient lo consume tal cual. Ojo: filtra por `sellerId: user?.id`, así que **a un cajero le devuelve lista vacía** y su filtro de proveedor se queda en "Todos". Es aceptable y no hay que arreglarlo aquí: el cajero sigue viendo todas sus entradas, solo no puede filtrarlas por proveedor.

- [ ] **Step 3: Crear la página**

Crear `src/app/(seller-center)/inventory/entries/page.tsx`:

```tsx
import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/actions/auth';
import EntriesClient from './EntriesClient';

export const dynamic = 'force-dynamic';

export default async function StockEntriesPage() {
    const user: any = await getSessionUser();
    if (!user) redirect('/login');

    const isSeller = user.role === 'SELLER';
    const isAllowedCashier = user.role === 'CASHIER' && user.canRegisterStockEntry;

    if (!isSeller && !isAllowedCashier) {
        return (
            <div className="p-8">
                <div className="bg-card border border-border rounded-2xl p-10 text-center">
                    <h1 className="text-xl font-black mb-2">Acceso restringido</h1>
                    <p className="text-gray-500">No tienes permiso para ver las entradas de mercancía.</p>
                </div>
            </div>
        );
    }

    return <EntriesClient canCancel={isSeller} />;
}
```

- [ ] **Step 4: Agregar el elemento al submenú de Inventario**

En `src/app/(seller-center)/SidebarLayout.tsx`, dentro del arreglo del acordeón de Inventario (~línea 407), agregar después de `{ href: '/products/new', label: 'Nuevo Producto' }`:

```tsx
                              { href: '/inventory/entries', label: '📥 Entradas' },
```

- [ ] **Step 5: Dar acceso al cajero con permiso**

El acordeón de Inventario solo se renderiza para `user?.role === 'SELLER'` (~línea 386), así que un cajero no vería nada. Agregar un elemento suelto **después del bloque completo del acordeón de Inventario** (después del `)}` que lo cierra), para no exponerle Marcas, Categorías ni el resto:

```tsx
            {user?.role === 'CASHIER' && user?.canRegisterStockEntry && (
              <Link
                href="/inventory/entries"
                onClick={() => setSidebarOpen(false)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 group ${pathname.startsWith('/inventory/entries') ? 'font-bold bg-gray-100 dark:bg-gray-800 text-foreground' : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}`}
              >
                <span className="text-lg group-hover:scale-110 transition-transform shrink-0">📥</span>
                <span className={`whitespace-nowrap ${isDesktopCollapsed ? 'hidden' : 'block'}`}>Entradas</span>
              </Link>
            )}
```

`user` viene de `getSessionUser()`, que devuelve el registro completo del usuario, así que `canRegisterStockEntry` está disponible sin cambios en `layout.tsx`.

- [ ] **Step 6: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -E "inventory/entries|SidebarLayout" || echo "SIN ERRORES en los archivos tocados"
```
Expected: `SIN ERRORES en los archivos tocados`

- [ ] **Step 7: Commit**

```bash
git add "src/app/(seller-center)/inventory/entries/EntriesClient.tsx" "src/app/(seller-center)/inventory/entries/page.tsx" "src/app/(seller-center)/SidebarLayout.tsx"
git commit -m "feat(entradas): pantalla general de entradas y acceso desde el menu"
```

---

### Task 7: Integración en la pantalla de Inventario

**Files:**
- Create: `src/app/(seller-center)/inventory/entries/ProductStockEntriesModal.tsx`
- Modify: `src/app/(seller-center)/inventory/page.tsx` (menú de tres puntitos ~líneas 817-852, montaje de modales ~línea 1009)

**Interfaces:**
- Consumes: `getProductStockEntries`, `cancelStockEntry` (Tareas 3-4), `StockEntryForm` (Tarea 5).
- Produces: componente por defecto `ProductStockEntriesModal({ productId, productName, canCancel, onClose })`.

- [ ] **Step 1: Crear el modal de historial por modelo**

Crear `src/app/(seller-center)/inventory/entries/ProductStockEntriesModal.tsx`:

```tsx
"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getProductStockEntries, cancelStockEntry } from './actions';

export default function ProductStockEntriesModal({
    productId,
    productName,
    canCancel,
    onClose,
}: {
    productId: string;
    productName: string;
    canCancel: boolean;
    onClose: () => void;
}) {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getProductStockEntries(productId);
        setEntries(res.entries || []);
        setLoading(false);
        if (!res.success && res.error) toast.error(res.error);
    }, [productId]);

    useEffect(() => { load(); }, [load]);

    const activeTotal = entries
        .filter(e => e.status === 'ACTIVE')
        .reduce((s, e) => s + e.totalItems, 0);

    const handleCancel = async (entry: any) => {
        if (!confirm(`¿Cancelar la entrada ${entry.folio}? Se van a restar ${entry.totalItems} piezas del inventario.`)) return;
        const res = await cancelStockEntry(entry.id);
        if (res.success) { toast.success('Entrada cancelada'); load(); }
        else toast.error(res.error || 'No se pudo cancelar.');
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div className="min-w-0">
                        <h3 className="text-xl font-black truncate">📦 Entradas de este Modelo</h3>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest truncate">{productName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-foreground text-2xl leading-none shrink-0">×</button>
                </div>

                <div className="p-6 overflow-y-auto space-y-2">
                    {loading && <p className="text-sm text-gray-400">Cargando…</p>}

                    {!loading && entries.length === 0 && (
                        <div className="border border-dashed border-border rounded-xl p-8 text-center">
                            <p className="font-bold mb-1">Sin entradas registradas</p>
                            <p className="text-xs text-gray-500">
                                Las entradas anteriores hechas con “Ajustar Stock” no aparecen aquí: el historial arranca desde ahora.
                            </p>
                        </div>
                    )}

                    {entries.map(entry => (
                        <div key={entry.id} className="border border-border rounded-xl overflow-hidden">
                            <button
                                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                                className="w-full text-left p-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className={`font-black text-sm ${entry.status === 'CANCELLED' ? 'line-through text-gray-400' : ''}`}>
                                        {entry.folio} · {new Date(entry.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest truncate">
                                        {entry.locationName}{entry.userName ? ` · ${entry.userName}` : ''}
                                    </p>
                                </div>
                                {entry.status === 'CANCELLED' ? (
                                    <span className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-wide shrink-0">Cancelada</span>
                                ) : (
                                    <span className="font-black text-emerald-600 shrink-0">+{entry.totalItems}</span>
                                )}
                                <span className="text-gray-400 shrink-0">{expanded === entry.id ? '▾' : '▸'}</span>
                            </button>

                            {expanded === entry.id && (
                                <div className="px-3 pb-3 pt-2 border-t border-border space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                        {entry.items.map((it: any) => (
                                            <span key={it.id} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-[11px] font-bold">
                                                {it.variantInfo || 'Única'}: {it.quantity}
                                            </span>
                                        ))}
                                    </div>
                                    {entry.notes && <p className="text-[11px] text-gray-500 font-medium">Nota: {entry.notes}</p>}
                                    {entry.status === 'CANCELLED' && (
                                        <p className="text-[11px] text-red-500 font-bold">
                                            Cancelada el {new Date(entry.cancelledAt).toLocaleDateString('es-MX')}
                                            {entry.cancelledByName ? ` por ${entry.cancelledByName}` : ''}
                                        </p>
                                    )}
                                    {canCancel && entry.status === 'ACTIVE' && (
                                        <button onClick={() => handleCancel(entry)} className="text-[11px] font-black text-red-500 hover:underline">
                                            Cancelar esta entrada
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-border flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Total ingresado</p>
                    <p className="font-black text-emerald-600">{activeTotal} piezas</p>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Importar los componentes en la pantalla de inventario**

En `src/app/(seller-center)/inventory/page.tsx`, junto a los imports existentes (después de `import ProductSalesHistoryModal from '../products/ProductSalesHistoryModal';`):

```tsx
import StockEntryForm from './entries/StockEntryForm';
import ProductStockEntriesModal from './entries/ProductStockEntriesModal';
```

- [ ] **Step 3: Agregar el estado de los dos modales**

Dentro de `export default function InventoryPage()`, junto a la línea existente `const [historyProduct, setHistoryProduct] = useState<{ id: string; name: string } | null>(null);`:

```tsx
    const [entryProduct, setEntryProduct] = useState<{ id: string; name: string } | null>(null);
    const [entriesProduct, setEntriesProduct] = useState<{ id: string; name: string } | null>(null);
```

- [ ] **Step 4: Agregar las dos opciones al menú de tres puntitos**

En el menú desplegable del producto, después del botón `⚖️ Ajustar Stock` y antes de `📊 Historial de Ventas`:

```tsx
                                                        <button
                                                            className="w-full text-left px-5 py-3 flex text-sm font-bold text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setEntryProduct({ id: product.id, name: product.name }); }}
                                                        >
                                                            📥 Registrar Entrada
                                                        </button>
                                                        <button
                                                            className="w-full text-left px-5 py-3 flex text-sm font-bold text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setEntriesProduct({ id: product.id, name: product.name }); }}
                                                        >
                                                            📦 Entradas de este Modelo
                                                        </button>
```

Esta pantalla ya es exclusiva del vendedor (el acordeón de Inventario solo se muestra a `SELLER`), así que las opciones no necesitan condicionarse por permiso.

- [ ] **Step 5: Montar los modales**

Junto al bloque existente `{historyProduct && (<ProductSalesHistoryModal ... />)}` (~línea 1009):

```tsx
            {entryProduct && (
                <StockEntryForm
                    initialProductId={entryProduct.id}
                    onClose={() => setEntryProduct(null)}
                    onSaved={() => { setEntryProduct(null); loadInventory(); }}
                />
            )}

            {entriesProduct && (
                <ProductStockEntriesModal
                    productId={entriesProduct.id}
                    productName={entriesProduct.name}
                    canCancel={true}
                    onClose={() => setEntriesProduct(null)}
                />
            )}
```

La función que recarga la lista ya existe en ese archivo: `const loadInventory = async (page = 1) => {...}` (~línea 129). Llamarla sin argumentos recarga la primera página.

- [ ] **Step 6: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -E "inventory/page|inventory/entries" || echo "SIN ERRORES en los archivos tocados"
```
Expected: `SIN ERRORES en los archivos tocados`

- [ ] **Step 7: Commit**

```bash
git add "src/app/(seller-center)/inventory/entries/ProductStockEntriesModal.tsx" "src/app/(seller-center)/inventory/page.tsx"
git commit -m "feat(entradas): registrar entrada e historial desde la pantalla de inventario"
```

---

### Task 8: Permiso en Configuración → Mi Equipo

**Files:**
- Modify: `src/app/(seller-center)/settings/team/actions.ts` (`getSellerCashiers` ~línea 23, `createCashier` ~línea 35, `updateCashier` ~línea 95)
- Modify: `src/app/(seller-center)/settings/team/page.tsx` (estado del formulario ~líneas 25, 61, 71, 99; lista de permisos ~línea 511; etiquetas ~línea 330)

**Interfaces:**
- Consumes: `User.canRegisterStockEntry` de la Tarea 1.
- Produces: la casilla que habilita a un cajero. Es lo que hace efectivo el control de acceso de las Tareas 2, 3 y 6.

- [ ] **Step 1: Incluir el campo en la consulta de cajeros**

En `src/app/(seller-center)/settings/team/actions.ts`, dentro del `select` de `getSellerCashiers` (línea ~23, junto a `canCreateProducts: true`):

```ts
                canRegisterStockEntry: true,
```

- [ ] **Step 2: Aceptar y guardar el campo al crear**

En la firma de `createCashier`, junto a `canCreateProducts: boolean;`:

```ts
    canRegisterStockEntry: boolean;
```

Y en el objeto `data` de la creación, junto a `canCreateProducts: data.canCreateProducts,`:

```ts
                canRegisterStockEntry: data.canRegisterStockEntry,
```

- [ ] **Step 3: Aceptar y guardar el campo al editar**

En la firma de `updateCashier` (~línea 102), junto a `canCreateProducts?: boolean;`:

```ts
    canRegisterStockEntry?: boolean;
```

**No hace falta nada más:** `updateCashier` construye su actualización con `const updateData: any = { ...data };`, así que el campo se persiste solo con estar en la firma.

- [ ] **Step 4: Agregar el campo al estado del formulario**

En `src/app/(seller-center)/settings/team/page.tsx` hay **tres** lugares donde se arma el objeto del formulario. En los tres, agregar `canRegisterStockEntry` junto a `canCreateProducts`:

- El estado inicial (~línea 25-26): `canRegisterStockEntry: false,`
- El reinicio del formulario (~línea 61): `canRegisterStockEntry: false`
- La carga al editar (~línea 74): `canRegisterStockEntry: cashier.canRegisterStockEntry ?? false,`
- El envío al guardar (~línea 102): `canRegisterStockEntry: cashierForm.canRegisterStockEntry,`

- [ ] **Step 5: Agregar la casilla a la lista de permisos**

En el arreglo de permisos del modal (~línea 511), después de la entrada de `canViewZCuts`:

```tsx
                                        { key: "canRegisterStockEntry", label: "Puede registrar entradas de mercancía", desc: "Captura lo que llega y lo suma al inventario de su sucursal" },
```

- [ ] **Step 6: Agregar la etiqueta en la tarjeta del cajero**

Junto a las etiquetas existentes (~línea 330-332), después de la de Cortes Z:

```tsx
                                                    {cashier.canRegisterStockEntry && <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[9px] font-black uppercase tracking-wide text-gray-500">✓ Entradas</span>}
```

- [ ] **Step 7: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "settings/team" || echo "SIN ERRORES en settings/team"
```
Expected: `SIN ERRORES en settings/team`

- [ ] **Step 8: Commit**

```bash
git add "src/app/(seller-center)/settings/team/actions.ts" "src/app/(seller-center)/settings/team/page.tsx"
git commit -m "feat(equipo): permiso de cajero para registrar entradas de mercancia"
```

---

### Task 9: Script de verificación, despliegue y prueba con datos reales

**Files:**
- Create: `scripts/verificar-entradas.mjs`
- Deploy: los 10 archivos de código de las Tareas 1-8

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la funcionalidad viva en producción, verificada.

- [ ] **Step 1: Crear el script de consistencia (solo lectura)**

Crear `scripts/verificar-entradas.mjs`:

```js
// Chequeo de consistencia de las entradas de mercancía.
// SOLO LECTURA: no escribe nada. Pensado para correrse EN EL SERVIDOR,
// donde sí hay acceso a la base de datos.
//   node scripts/verificar-entradas.mjs
import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();

let fallas = 0;

const entradas = await prisma.stockEntry.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
});

console.log(`Revisando ${entradas.length} entradas…\n`);

for (const e of entradas) {
    const suma = e.items.reduce((s, it) => s + it.quantity, 0);
    if (suma !== e.totalItems) {
        fallas++;
        console.log(`FALLA  E-${String(e.folio).padStart(6, '0')}: totalItems=${e.totalItems} pero los renglones suman ${suma}`);
    }
    if (e.items.some(it => it.quantity <= 0)) {
        fallas++;
        console.log(`FALLA  E-${String(e.folio).padStart(6, '0')}: tiene renglones con cantidad menor o igual a cero`);
    }
}

// Invariante global: el stock total de cada variante debe ser la suma de sus sucursales.
const variantIds = [...new Set(entradas.flatMap(e => e.items.map(it => it.variantId)))];
const variantes = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, stock: true, inventoryLevels: { select: { stock: true } } },
});

for (const v of variantes) {
    const suma = v.inventoryLevels.reduce((s, l) => s + l.stock, 0);
    if (v.stock !== suma) {
        fallas++;
        console.log(`FALLA  Variante ${v.id}: Variant.stock=${v.stock} pero las sucursales suman ${suma}`);
    }
}

console.log(fallas === 0 ? '\nOK: sin inconsistencias.' : `\n${fallas} inconsistencia(s).`);
await prisma.$disconnect();
process.exit(fallas === 0 ? 0 : 1);
```

Nota sobre el último chequeo: puede reportar diferencias **preexistentes**, ajenas a las entradas, si el proyecto ya arrastraba descuadres entre `Variant.stock` y `InventoryLevel`. Correrlo **antes** de desplegar (paso 4) para tener la línea base.

- [ ] **Step 2: Commit del script**

```bash
git add scripts/verificar-entradas.mjs
git commit -m "chore(scripts): verificador de consistencia de entradas"
```

- [ ] **Step 3: Comparar cada archivo modificado contra el servidor**

El servidor puede tener código que no está en git. Para **cada uno** de los 5 archivos que se modifican (no los que se crean), comparar antes de subir:

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cat '/var/www/modazapo/src/app/(seller-center)/inventory/page.tsx'" > /tmp/srv-inventory-page.tsx && diff /tmp/srv-inventory-page.tsx "src/app/(seller-center)/inventory/page.tsx"
```

Repetir cambiando la ruta para: `prisma/schema.prisma`, `src/app/(seller-center)/SidebarLayout.tsx`, `src/app/(seller-center)/settings/team/page.tsx`, `src/app/(seller-center)/settings/team/actions.ts`.

Expected: las únicas diferencias son las de este trabajo. **Si aparece cualquier otra, detente y avisa al usuario** — significa que el servidor tiene código más reciente que el repo y subir el archivo lo borraría. Las credenciales SSH están en `SECRETOS.md`.

- [ ] **Step 4: Tomar la línea base del verificador en el servidor**

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cd /var/www/modazapo && node scripts/verificar-entradas.mjs"
```
Expected: falla con "table StockEntry does not exist" (todavía no existe) — eso está bien, es antes de aplicar el esquema. Si el script todavía no está en el servidor, este paso se corre después del paso 6.

- [ ] **Step 5: Listar los archivos y pedir confirmación al usuario**

**Regla de `CLAUDE.md`: no transferir nada sin confirmación.** Presentar esta lista y esperar el "sí":

```
Crear en el servidor:
  prisma/schema.prisma                                                  (modificar)
  src/app/(seller-center)/inventory/entries/actions.ts                  (nuevo)
  src/app/(seller-center)/inventory/entries/StockEntryForm.tsx          (nuevo)
  src/app/(seller-center)/inventory/entries/ProductStockEntriesModal.tsx(nuevo)
  src/app/(seller-center)/inventory/entries/EntriesClient.tsx           (nuevo)
  src/app/(seller-center)/inventory/entries/page.tsx                    (nuevo)
  src/app/(seller-center)/SidebarLayout.tsx                             (modificar)
  src/app/(seller-center)/inventory/page.tsx                            (modificar)
  src/app/(seller-center)/settings/team/page.tsx                        (modificar)
  src/app/(seller-center)/settings/team/actions.ts                      (modificar)
  scripts/verificar-entradas.mjs                                        (nuevo)

NO se transfiere: .env, .env.local, ni ningún archivo de configuración.
```

- [ ] **Step 6: Transferir los archivos**

`scp` falla con rutas que llevan paréntesis como `(seller-center)`, así que se transfiere codificando en base64. Para cada archivo:

```bash
base64 -i "src/app/(seller-center)/inventory/entries/actions.ts" | ssh -o StrictHostKeyChecking=no root@187.124.158.239 "mkdir -p '/var/www/modazapo/src/app/(seller-center)/inventory/entries' && base64 -d > '/var/www/modazapo/src/app/(seller-center)/inventory/entries/actions.ts'"
```

Verificar que llegaron con el tamaño correcto:

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "ls -la '/var/www/modazapo/src/app/(seller-center)/inventory/entries/' && ls -la /var/www/modazapo/prisma/schema.prisma"
```
Expected: los tamaños coinciden con los de local (`ls -la` en la laptop).

- [ ] **Step 7: Aplicar el esquema en el servidor**

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cd /var/www/modazapo && node_modules/.bin/prisma db push"
```
Expected: `Your database is now in sync with your Prisma schema.` Las dos tablas son nuevas y el campo de `User` tiene default, así que no debe pedir confirmación de pérdida de datos. **Si Prisma advierte de pérdida de datos, aborta y avisa al usuario** — significa que el esquema del repo difiere del de la base en algo ajeno a este trabajo.

- [ ] **Step 8: Compilar y reiniciar**

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cd /var/www/modazapo && npm run build && pm2 restart modazapo"
```
Expected: el build termina sin errores de compilación y PM2 reporta el proceso `online`.

- [ ] **Step 9: Verificación funcional en el navegador**

Entrando como Kalexa Fashion (vendedor), comprobar uno por uno:

1. En el menú lateral aparece **Inventario → 📥 Entradas**, y la pantalla abre vacía con el mensaje de "Todavía no hay entradas registradas".
2. Desde **+ Nueva Entrada**: buscar un modelo por nombre, elegirlo, ver sus tallas con el stock actual de la sucursal seleccionada.
3. Anotar el stock actual de una variante. Registrar una entrada de **5 piezas** en esa variante, en la sucursal A.
4. Volver a Inventario: el stock de esa variante subió exactamente 5. Abrir *Ajustar Stock* y confirmar que en la sucursal A subió 5 y en las demás no cambió nada.
5. La entrada aparece en `/inventory/entries` **y** en *📦 Entradas de este Modelo* del producto, con el mismo folio y el mismo desglose.
6. Registrar una segunda entrada: el folio es el siguiente consecutivo.
7. Cambiar la sucursal en el formulario: los "tienes N" cambian a los de esa sucursal.
8. Cancelar la primera entrada: el stock regresa a como estaba en los dos lados, y la entrada queda marcada *Cancelada*, no desaparece.
9. Vender una pieza de un modelo con entrada activa (POS), luego intentar cancelar esa entrada: se rechaza con el mensaje de que ya se vendieron piezas, **y ninguna variante queda modificada**.
10. Crear un cajero **sin** la casilla: no ve *📥 Entradas* en el menú, y al abrir `/inventory/entries` directo ve "Acceso restringido".
11. Marcarle la casilla: ya ve el menú y puede registrar, pero en el selector de sucursal solo aparecen las que tiene asignadas, y no le aparece la opción de cancelar.
12. Confirmar que *Ajustar Stock*, *Resurtido desde Bodega* y una venta en POS siguen funcionando igual.

- [ ] **Step 10: Correr el verificador de consistencia**

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cd /var/www/modazapo && node scripts/verificar-entradas.mjs"
```
Expected: `OK: sin inconsistencias.` Si reporta descuadres entre `Variant.stock` y las sucursales que ya existían antes del despliegue (línea base del paso 4), señalarlos como preexistentes y no atribuirlos a este trabajo.

- [ ] **Step 11: Commit final y registro del despliegue**

```bash
git add -A docs/superpowers
git commit -m "docs: plan de entradas de mercancia ejecutado y verificado"
```
