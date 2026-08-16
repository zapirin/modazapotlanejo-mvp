# Puntos de lealtad al entregar — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que en las compras en línea los puntos de lealtad se ganen al marcar el pedido como Entregado —no al crearlo—, que se reviertan si el pedido se cancela o se devuelve, y que el comprador vea sus puntos "por confirmar" desde que paga.

**Architecture:** Dos funciones nuevas en `src/lib/loyalty.ts` (otorgar con idempotencia, y revertir por pedido) que `orders.ts` invoca en las transiciones de estado. Los puntos "por confirmar" se **calculan al vuelo** desde los pedidos pagados sin entregar y nunca se guardan, de modo que el comprador los ve pero no puede gastarlos.

**Tech Stack:** Next.js 16 App Router (Server Actions + Client Components), Prisma 6.19.2 + PostgreSQL, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-12-puntos-al-entregar-design.md`

## Global Constraints

- **Nunca uses `npx`.** Usa `node_modules/.bin/...`.
- **No hay base de datos accesible desde esta máquina.** `DATABASE_URL` apunta a producción pero el puerto 5432 está cerrado. **No ejecutes consultas, ni `prisma db push`, ni levantes el servidor de desarrollo.** La verificación local es de tipos.
- **`npm run build` no valida tipos** (`ignoreBuildErrors: true`). La verificación útil es `node_modules/.bin/tsc --noEmit` **filtrando por los archivos tocados**.
- **Línea base de tipos: 20 errores preexistentes.** Lo que importa es que no aparezcan errores nuevos.
- **El proyecto NO tiene framework de pruebas** y no se va a agregar uno. No escribas tests.
- **Este trabajo NO toca el esquema de la base de datos.** No hay `prisma db push`.
- **El shell es zsh.** No agrupes opciones de `ssh` en variables.
- **Nunca transferir `.env` ni `.env.local`.** Antes de desplegar, listar archivos y esperar confirmación del usuario (regla de `CLAUDE.md`).
- **El servidor puede ir adelante del repo.** Antes de subir un archivo existente, comparar con el del servidor.
- **No tocar** `src/app/(seller-center)/products/new/actions.ts`: el punto de venta ya revierte puntos correctamente y está fuera de alcance.
- **Convención de signos (no la cambies):** `earnPoints` guarda `points` **positivo**; `redeemPoints` guarda `points: -points` (**negativo**). Por eso restar `txn.points` del saldo quita lo ganado **y devuelve lo canjeado** en la misma operación.
- **Monto base de los puntos:** `order.total - order.shippingCost`. `createOrder` guarda `total: finalTotal + shippingCost`, así que esa resta recupera exactamente el monto que hoy se usa. Los puntos se ganan sobre la mercancía, no sobre el envío.
- **Estados de pedido pagados y sin entregar:** `PAID`, `ACCEPTED`, `SHIPPED`. `PENDING` y `PENDING_PAYMENT` NO cuentan (no hay pago confirmado). `COMPLETED` es "Entregado".
- **Texto de interfaz en español.**

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/loyalty.ts` (modificar) | `earnPointsForDeliveredOrder`, `revertOrderLoyalty`, `getPendingPointsByBuyer` |
| `src/app/actions/orders.ts` (modificar) | Quitar el otorgamiento de `createOrder`; otorgar/revertir en las transiciones de estado y al borrar |
| `src/app/actions/loyalty.ts` (modificar) | `getMyLoyalty` devuelve además los puntos por confirmar |
| `src/app/(marketplace)/mis-puntos/page.tsx` (modificar) | Pasar los puntos por confirmar al cliente |
| `src/app/(marketplace)/mis-puntos/LoyaltyAccountClient.tsx` (modificar) | Mostrar "Por confirmar" |
| `scripts/corregir-puntos-no-pagados.mjs` (crear) | Ajuste de un solo uso, se corre en el servidor |

---

### Task 1: Funciones de lealtad para pedidos

**Files:**
- Modify: `src/lib/loyalty.ts` (agregar al final del archivo)

**Interfaces:**
- Consumes: `mxnToPoints`, `earnPoints` y `prisma`, ya presentes en ese archivo.
- Produces:
  - `earnPointsForDeliveredOrder(order: { id: string; sellerId: string; buyerId: string; total: number; shippingCost: number }): Promise<{ earned: number; skipped?: boolean }>`
  - `revertOrderLoyalty(orderId: string): Promise<{ reverted: number }>`
  - `getPendingPointsByBuyer(buyerId: string): Promise<PendingPoints[]>` donde `PendingPoints = { sellerId: string; points: number; seller: { id: string; name: string; businessName: string | null; logoUrl: string | null; sellerSlug: string | null } }`

  Las usan las Tareas 2 y 3.

- [ ] **Step 1: Agregar el otorgamiento idempotente**

Al final de `src/lib/loyalty.ts`:

```ts
// Otorga los puntos de un pedido ya entregado.
// Idempotente: si ese pedido ya tiene un movimiento EARN, no hace nada. Así,
// marcar dos veces como entregado no duplica los puntos.
export async function earnPointsForDeliveredOrder(order: {
    id: string;
    sellerId: string;
    buyerId: string;
    total: number;
    shippingCost: number;
}) {
    const yaOtorgado = await (prisma as any).loyaltyTransaction.findFirst({
        where: { orderId: order.id, type: "EARN" },
        select: { id: true },
    });
    if (yaOtorgado) return { earned: 0, skipped: true as const };

    // Los puntos se ganan sobre la mercancía, no sobre el envío.
    const base = (order.total || 0) - (order.shippingCost || 0);
    if (base <= 0) return { earned: 0, skipped: true as const };

    return earnPoints({
        sellerId: order.sellerId,
        customer: { buyerId: order.buyerId },
        amountMXN: base,
        orderId: order.id,
    });
}
```

- [ ] **Step 2: Agregar la reversión por pedido**

```ts
// Deshace todos los movimientos de puntos ligados a un pedido: quita lo ganado
// y devuelve lo canjeado. Funciona para ambos casos con la misma resta porque
// EARN guarda los puntos en positivo y REDEEM en negativo.
// Idempotente: borra los movimientos, así que repetirla no hace nada.
export async function revertOrderLoyalty(orderId: string) {
    return prisma.$transaction(async (tx: any) => {
        const txns = await tx.loyaltyTransaction.findMany({ where: { orderId } });
        if (txns.length === 0) return { reverted: 0 };

        for (const t of txns) {
            const account = await tx.loyaltyAccount.findUnique({ where: { id: t.accountId } });
            if (!account) continue;
            await tx.loyaltyAccount.update({
                where: { id: account.id },
                data: { balance: Math.max(0, account.balance - t.points) },
            });
        }

        await tx.loyaltyTransaction.deleteMany({ where: { orderId } });
        return { reverted: txns.length };
    });
}
```

El `Math.max(0, ...)` replica lo que ya hace `deleteSale` en el mostrador: si el comprador ya gastó esos puntos en otra compra, el saldo se queda en cero en vez de irse a negativo.

- [ ] **Step 3: Agregar el cálculo de puntos por confirmar**

```ts
// Estados en los que un pedido ya se pagó pero todavía no se entrega.
// PENDING y PENDING_PAYMENT quedan fuera a propósito: no hay pago confirmado.
const ESTADOS_PAGADO_SIN_ENTREGAR = ["PAID", "ACCEPTED", "SHIPPED"];

// Puntos que el comprador ganará cuando le entreguen lo que ya pagó.
// NO se guardan en ningún lado: se calculan cada vez que se piden. Esa es la
// razón por la que puede verlos sin poder gastarlos — nunca entran a su saldo.
export async function getPendingPointsByBuyer(buyerId: string) {
    const orders = await (prisma as any).order.findMany({
        where: { buyerId, status: { in: ESTADOS_PAGADO_SIN_ENTREGAR } },
        select: {
            sellerId: true,
            total: true,
            shippingCost: true,
            seller: { select: { id: true, name: true, businessName: true, logoUrl: true, sellerSlug: true } },
        },
    });
    if (orders.length === 0) return [];

    const sellerIds = [...new Set(orders.map((o: any) => o.sellerId))] as string[];
    const programs = await (prisma as any).loyaltyProgram.findMany({
        where: { sellerId: { in: sellerIds }, isActive: true },
        select: { sellerId: true, earnRate: true },
    });
    const tasaPorVendedor = new Map<string, number>(programs.map((p: any) => [p.sellerId, p.earnRate]));

    const acumulado = new Map<string, { sellerId: string; points: number; seller: any }>();
    for (const o of orders) {
        const tasa = tasaPorVendedor.get(o.sellerId);
        if (!tasa) continue;
        const pts = mxnToPoints((o.total || 0) - (o.shippingCost || 0), tasa);
        if (pts <= 0) continue;
        const previo = acumulado.get(o.sellerId);
        if (previo) previo.points += pts;
        else acumulado.set(o.sellerId, { sellerId: o.sellerId, points: pts, seller: o.seller });
    }
    return Array.from(acumulado.values());
}
```

- [ ] **Step 4: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "lib/loyalty" || echo "SIN ERRORES en lib/loyalty"
```
Expected: `SIN ERRORES en lib/loyalty`

- [ ] **Step 5: Commit**

```bash
git add src/lib/loyalty.ts
git commit -m "feat(puntos): otorgar por pedido entregado, revertir por pedido y calcular pendientes"
```

---

### Task 2: Enganchar los puntos a las transiciones del pedido

**Files:**
- Modify: `src/app/actions/orders.ts` (import ~línea 14; bloque de lealtad de `createOrder` ~líneas 219-231; `updateOrderStatus` ~líneas 292-396; `deleteOrder` ~líneas 400-425)

**Interfaces:**
- Consumes: `earnPointsForDeliveredOrder` y `revertOrderLoyalty` de la Tarea 1.
- Produces: el comportamiento nuevo. La Tarea 4 lo verifica en el servidor.

- [ ] **Step 1: Actualizar el import de lealtad**

En `src/app/actions/orders.ts`, la línea 14 dice hoy:

```ts
import { earnPoints, redeemPoints, pointsToMXN, getProgram } from "@/lib/loyalty";
```

Sustituirla por:

```ts
import { redeemPoints, pointsToMXN, getProgram, earnPointsForDeliveredOrder, revertOrderLoyalty } from "@/lib/loyalty";
```

`earnPoints` sale porque `createOrder` deja de otorgar; `redeemPoints`, `pointsToMXN` y `getProgram` se quedan: el canje sigue ocurriendo al comprar.

- [ ] **Step 2: Quitar el otorgamiento de `createOrder`**

Dentro de `createOrder`, **eliminar por completo** este bloque (queda justo después del bloque de `redeemPoints`):

```ts
        if (finalTotal > 0) {
            try {
                await earnPoints({
                    sellerId: data.sellerId,
                    customer: { buyerId: user.id },
                    amountMXN: finalTotal,
                    orderId: order.id,
                });
            } catch (e) {
                console.error("Loyalty earn failed:", e);
            }
        }
```

**No toques** el bloque de `redeemPoints` que está arriba de éste: el descuento por puntos se sigue aplicando al comprar porque afecta el precio que el comprador paga.

- [ ] **Step 3: Otorgar y revertir en `updateOrderStatus`**

En `updateOrderStatus`, justo **después** del bloque `if (status === 'ACCEPTED' || status === 'REJECTED') { ... }` y **antes** de `revalidatePath("/orders");`, agregar:

```ts
        // Los puntos se ganan hasta que el pedido se entrega.
        if (status === 'COMPLETED') {
            try {
                await earnPointsForDeliveredOrder({
                    id: updatedOrder.id,
                    sellerId: updatedOrder.sellerId,
                    buyerId: updatedOrder.buyerId,
                    total: updatedOrder.total,
                    shippingCost: updatedOrder.shippingCost,
                });
            } catch (e) {
                console.error("Loyalty earn on delivery failed:", e);
            }
        }

        // Si el pedido se cae, se deshace todo lo de puntos: se quita lo ganado
        // (si ya se había entregado) y se devuelve lo que el comprador canjeó.
        if (status === 'CANCELLED' || status === 'REJECTED' || status === 'REFUNDED') {
            try {
                await revertOrderLoyalty(updatedOrder.id);
            } catch (e) {
                console.error("Loyalty revert failed:", e);
            }
        }
```

- [ ] **Step 4: Revertir también al borrar un pedido**

En `deleteOrder`, justo **antes** de la línea `await prisma.order.delete({ where: { id: orderId } });`, agregar:

```ts
        // Antes de borrar, deshacer los puntos para no dejar movimientos
        // apuntando a un pedido que ya no existe.
        try {
            await revertOrderLoyalty(orderId);
        } catch (e) {
            console.error("Loyalty revert on delete failed:", e);
        }
```

- [ ] **Step 5: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "actions/orders" || echo "SIN ERRORES en actions/orders"
```
Expected: `SIN ERRORES en actions/orders`

- [ ] **Step 6: Confirmar que no quedó ningún uso de `earnPoints` suelto**

Run:
```bash
grep -n "earnPoints" src/app/actions/orders.ts || echo "LIMPIO: orders.ts ya no llama a earnPoints directamente"
```
Expected: solo aparece `earnPointsForDeliveredOrder` en el import y en la llamada del Step 3; **no** debe aparecer `earnPoints(` a secas.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/orders.ts
git commit -m "feat(puntos): ganarlos al entregar y revertirlos al cancelar o devolver"
```

---

### Task 3: El comprador ve sus puntos por confirmar

**Files:**
- Modify: `src/app/actions/loyalty.ts` (`getMyLoyalty` ~líneas 59-74)
- Modify: `src/app/(marketplace)/mis-puntos/page.tsx`
- Modify: `src/app/(marketplace)/mis-puntos/LoyaltyAccountClient.tsx` (tipo `Account` ~líneas 15-27, bloque del saldo ~líneas 86-89, estado vacío ~líneas 33-40)

**Interfaces:**
- Consumes: `getPendingPointsByBuyer` de la Tarea 1.
- Produces: `getMyLoyalty()` devuelve `{ accounts: any[]; pending: PendingPoints[] }` con `PendingPoints = { sellerId: string; points: number; seller: { id, name, businessName, logoUrl, sellerSlug } }`.

- [ ] **Step 1: Devolver los pendientes desde la acción**

En `src/app/actions/loyalty.ts`, el import de `@/lib/loyalty` (líneas 4-9) dice hoy:

```ts
import {
    getProgram,
    getAccountBalance,
    pointsToMXN,
    mxnToPoints,
} from "@/lib/loyalty";
```

Agregarle `getPendingPointsByBuyer`:

```ts
import {
    getProgram,
    getAccountBalance,
    pointsToMXN,
    mxnToPoints,
    getPendingPointsByBuyer,
} from "@/lib/loyalty";
```

Y sustituir el cuerpo de `getMyLoyalty` por:

```ts
export async function getMyLoyalty() {
    const user = await getSessionUser();
    if (!user) return { accounts: [] as any[], pending: [] as any[] };
    const [accounts, pending] = await Promise.all([
        (prisma as any).loyaltyAccount.findMany({
            where: { buyerId: user.id },
            include: {
                seller: { select: { id: true, name: true, businessName: true, logoUrl: true, sellerSlug: true } },
                transactions: {
                    orderBy: { createdAt: "desc" },
                    take: 50,
                },
            },
            orderBy: { updatedAt: "desc" },
        }),
        getPendingPointsByBuyer(user.id),
    ]);
    return { accounts, pending };
}
```

- [ ] **Step 2: Pasar los pendientes a la pantalla**

En `src/app/(marketplace)/mis-puntos/page.tsx`, sustituir:

```tsx
    const { accounts } = await getMyLoyalty();
    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <LoyaltyAccountClient accounts={accounts} />
        </div>
    );
```

por:

```tsx
    const { accounts, pending } = await getMyLoyalty();
    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <LoyaltyAccountClient accounts={accounts} pending={pending} />
        </div>
    );
```

- [ ] **Step 3: Aceptar la prop nueva en el cliente**

En `LoyaltyAccountClient.tsx`, agregar el tipo junto al tipo `Account` existente:

```tsx
type Pending = {
    sellerId: string;
    points: number;
    seller: {
        id: string;
        name: string;
        businessName: string | null;
        logoUrl: string | null;
        sellerSlug: string | null;
    };
};
```

Y cambiar la firma del componente:

```tsx
export default function LoyaltyAccountClient({ accounts, pending = [] }: { accounts: Account[]; pending?: Pending[] }) {
```

- [ ] **Step 4: Mostrar los puntos por confirmar en cada tienda**

Dentro del `map` de cuentas, sustituir el bloque del saldo:

```tsx
                                <div className="text-right">
                                    <p className="text-2xl font-black text-amber-600">{acc.balance.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">puntos</p>
                                </div>
```

por:

```tsx
                                <div className="text-right shrink-0">
                                    <p className="text-2xl font-black text-amber-600">{acc.balance.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">disponibles</p>
                                    {(() => {
                                        const pend = pending.find(p => p.sellerId === acc.sellerId);
                                        if (!pend) return null;
                                        return (
                                            <p className="text-[11px] font-bold text-gray-400 mt-1">
                                                +{pend.points.toLocaleString()} por confirmar
                                            </p>
                                        );
                                    })()}
                                </div>
```

- [ ] **Step 5: Mostrar también las tiendas donde solo hay pendientes**

Un comprador que estrena tienda todavía no tiene cuenta de puntos ahí, así que sin esto no vería nada tras pagar. Justo **después** del `map` de cuentas (fuera de él, dentro del mismo contenedor de la lista), agregar:

```tsx
                {pending
                    .filter(p => !accounts.some(a => a.sellerId === p.sellerId))
                    .map(p => {
                        const nombre = p.seller.businessName || p.seller.name;
                        return (
                            <div key={p.sellerId} className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                                <div className="w-full flex items-center gap-3 p-5">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg font-black">
                                        {nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black truncate">{nombre}</p>
                                        <p className="text-xs text-gray-500">Aún sin puntos disponibles</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-2xl font-black text-gray-300 dark:text-gray-600">0</p>
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">disponibles</p>
                                        <p className="text-[11px] font-bold text-gray-400 mt-1">+{p.points.toLocaleString()} por confirmar</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
```

- [ ] **Step 6: Corregir el estado vacío**

El estado vacío hoy se muestra con `accounts.length === 0`. Si el comprador no tiene cuentas pero sí pendientes, debe verse la lista, no el mensaje de vacío. Cambiar esa condición por:

```tsx
    if (accounts.length === 0 && pending.length === 0) {
```

Y en el resumen de arriba, que hoy dice `Tienes <strong>{totalPoints...}</strong> puntos repartidos en {accounts.length} tienda...`, agregar debajo, dentro del mismo bloque:

```tsx
                    {pending.length > 0 && (
                        <> Además tienes <strong>{pending.reduce((s, p) => s + p.points, 0).toLocaleString()}</strong> puntos por confirmar de pedidos que vienen en camino; se activan cuando te los entreguen.</>
                    )}
```

- [ ] **Step 7: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -E "mis-puntos|actions/loyalty" || echo "SIN ERRORES en los archivos tocados"
```
Expected: `SIN ERRORES en los archivos tocados`

- [ ] **Step 8: Confirmar que el total de errores no subió**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: `20`

- [ ] **Step 9: Commit**

```bash
git add src/app/actions/loyalty.ts "src/app/(marketplace)/mis-puntos/page.tsx" "src/app/(marketplace)/mis-puntos/LoyaltyAccountClient.tsx"
git commit -m "feat(puntos): mostrar al comprador sus puntos por confirmar"
```

---

### Task 4: Script de corrección, despliegue y verificación

**Files:**
- Create: `scripts/corregir-puntos-no-pagados.mjs`
- Deploy: los 5 archivos de las Tareas 1-3

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la funcionalidad viva en producción y el saldo mal otorgado corregido.

- [ ] **Step 1: Crear el script de corrección**

Crear `scripts/corregir-puntos-no-pagados.mjs`. Busca los movimientos `EARN` cuyo pedido nunca se pagó y descuenta esos puntos del saldo, dejando el motivo anotado. **Por defecto solo muestra lo que haría**; hay que pasarle `--aplicar` para que escriba.

```js
// Corrige los puntos que se otorgaron por pedidos que nunca se pagaron.
// Se corre EN EL SERVIDOR, donde sí hay acceso a la base de datos.
//   node scripts/corregir-puntos-no-pagados.mjs            (solo muestra)
//   node scripts/corregir-puntos-no-pagados.mjs --aplicar  (escribe)
import { PrismaClient } from '../src/generated/client/index.js';

const prisma = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');
const SIN_PAGAR = ['PENDING', 'PENDING_PAYMENT'];

const earns = await prisma.loyaltyTransaction.findMany({
    where: { type: 'EARN', orderId: { not: null } },
    select: { id: true, points: true, orderId: true, accountId: true },
});

const ids = [...new Set(earns.map(e => e.orderId))];
const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: { id: true, orderNumber: true, status: true },
});
const porId = new Map(orders.map(o => [o.id, o]));

const aCorregir = earns.filter(e => {
    const o = porId.get(e.orderId);
    return o && SIN_PAGAR.includes(o.status);
});

if (aCorregir.length === 0) {
    console.log('No hay puntos otorgados por pedidos sin pagar. Nada que hacer.');
    await prisma.$disconnect();
    process.exit(0);
}

console.log(`${aCorregir.length} movimiento(s) de puntos por pedidos sin pagar:\n`);
for (const e of aCorregir) {
    const o = porId.get(e.orderId);
    const acc = await prisma.loyaltyAccount.findUnique({
        where: { id: e.accountId },
        select: { balance: true, buyer: { select: { name: true } } },
    });
    console.log(`  pedido ${o.orderNumber} (${o.status})  ${e.points} pts  comprador: ${acc?.buyer?.name || '?'}  saldo actual: ${acc?.balance ?? '?'}`);
}

if (!aplicar) {
    console.log('\nEsto fue solo una vista previa. Para aplicarlo, vuelve a correrlo con --aplicar');
    await prisma.$disconnect();
    process.exit(0);
}

let corregidos = 0;
for (const e of aCorregir) {
    const o = porId.get(e.orderId);
    await prisma.$transaction(async (tx) => {
        const acc = await tx.loyaltyAccount.findUnique({ where: { id: e.accountId } });
        if (!acc) return;
        const quitar = Math.min(acc.balance, e.points);
        if (quitar > 0) {
            await tx.loyaltyAccount.update({
                where: { id: acc.id },
                data: { balance: acc.balance - quitar },
            });
            await tx.loyaltyTransaction.create({
                data: {
                    accountId: acc.id,
                    type: 'ADJUST',
                    points: -quitar,
                    reason: `Corrección: el pedido ${o.orderNumber} nunca se pagó, los puntos no debieron otorgarse.`,
                },
            });
        }
        await tx.loyaltyTransaction.delete({ where: { id: e.id } });
        corregidos++;
    });
}
console.log(`\nListo: ${corregidos} corregido(s).`);
await prisma.$disconnect();
```

`Math.min(acc.balance, e.points)` evita dejar el saldo en negativo si el comprador ya había gastado parte de esos puntos.

- [ ] **Step 2: Verificar la sintaxis del script**

Run:
```bash
node --check scripts/corregir-puntos-no-pagados.mjs
```
Expected: sin salida. Si `--check` se queja de `import` o del `await` de nivel superior, es limitación de la herramienta y no un error del script: dilo en el reporte y no inventes otra verificación.

- [ ] **Step 3: Commit del script**

```bash
git add scripts/corregir-puntos-no-pagados.mjs
git commit -m "chore(scripts): corregir puntos otorgados por pedidos sin pagar"
```

- [ ] **Step 4: Comparar cada archivo modificado contra el servidor**

La versión de git anterior a este trabajo es el commit de la spec, **`9bea6cd`**. Para **cada uno** de los 5 archivos modificados:

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cat '/var/www/modazapo/src/lib/loyalty.ts'" > /tmp/srv-cmp.ts && diff /tmp/srv-cmp.ts <(git show 9bea6cd:"src/lib/loyalty.ts")
```

Repetir para `src/app/actions/orders.ts`, `src/app/actions/loyalty.ts`, `src/app/(marketplace)/mis-puntos/page.tsx` y `src/app/(marketplace)/mis-puntos/LoyaltyAccountClient.tsx`.

Expected: sin diferencias. **Si aparece alguna, detente y avisa al usuario.** Las credenciales SSH están en `SECRETOS.md`.

- [ ] **Step 5: Listar los archivos y pedir confirmación al usuario**

**Regla de `CLAUDE.md`: no transferir nada sin confirmación.** Presentar esta lista y esperar el "sí":

```
src/lib/loyalty.ts                                            (modificar)
src/app/actions/orders.ts                                     (modificar)
src/app/actions/loyalty.ts                                    (modificar)
src/app/(marketplace)/mis-puntos/page.tsx                     (modificar)
src/app/(marketplace)/mis-puntos/LoyaltyAccountClient.tsx     (modificar)
scripts/corregir-puntos-no-pagados.mjs                        (nuevo)

NO se transfiere: .env, .env.local, ni ningún archivo de configuración.
NO se toca la base de datos: no hay cambio de esquema.
```

- [ ] **Step 6: Transferir, compilar y reiniciar**

Transferir cada archivo con `base64 | ssh | base64 -d` (scp falla con rutas con paréntesis), verificando `wc -c` local contra remoto. Luego:

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cd /var/www/modazapo && npm run build && pm2 restart modazapo"
```
Expected: `✓ Compiled successfully` (~35-80 s) y PM2 `online`.

- [ ] **Step 7: Correr el script en vista previa**

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cd /var/www/modazapo && node scripts/corregir-puntos-no-pagados.mjs"
```
Expected: lista el movimiento de 336 puntos del pedido en `PENDING_PAYMENT`. Confirmar con el usuario que la lista es la esperada **antes** de aplicar.

- [ ] **Step 8: Aplicar la corrección**

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cd /var/www/modazapo && node scripts/corregir-puntos-no-pagados.mjs --aplicar"
```
Expected: `Listo: 1 corregido(s).` Volver a correrlo sin `--aplicar` para confirmar que ya no queda nada.

- [ ] **Step 9: Verificación funcional**

Con una cuenta de comprador de prueba y la tienda Kalexa:

1. Hacer un pedido y **no** pagarlo: el comprador no ve puntos nuevos, ni disponibles ni por confirmar.
2. Pagarlo: en *Mis Puntos* aparece "+N por confirmar" en esa tienda, y los disponibles no cambian.
3. Intentar usar esos puntos en el carrito: **no** debe dejarlo (el saldo disponible no los incluye).
4. Como vendedor, "📦 Marcar como Entregado": los puntos pasan a disponibles y el número coincide con el que decía por confirmar.
5. Volver a marcarlo como entregado: los puntos **no** se duplican.
6. Con otro pedido pagado, cancelarlo: desaparece de "por confirmar" y no se otorga nada.
7. Con un pedido donde el comprador **gastó** puntos, cancelarlo: recupera exactamente los que gastó.
8. Marcar como "Devuelto" un pedido ya entregado: se le quitan los puntos que ganó.
9. Borrar un pedido cancelado: no quedan movimientos de puntos apuntando a él.
10. **Que no se rompió el mostrador:** cancelar una venta del punto de venta sigue revirtiendo puntos igual que antes.
11. **Que no se rompió el aislamiento:** un comprador con puntos en dos tiendas sigue sin poder usar los de una en la otra.

- [ ] **Step 10: Revisar el log de errores del servidor**

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "ls -l --time-style=+%H:%M:%S ~/.pm2/logs/modazapo-error.log; date '+ahora %H:%M:%S'"
```
Expected: el log no crece después del reinicio. Los `Failed to find Server Action` que aparezcan durante la compilación son de pestañas abiertas con la versión vieja; se resuelven recargando.
