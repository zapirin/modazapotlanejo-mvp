# Abrir el ticket desde el historial de un cliente — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al hacer clic (o tocar en móvil) una fila del historial de transacciones de un cliente se abra el ticket completo de esa venta.

**Architecture:** El modal de ticket ya existe y funciona dentro de `ProductSalesHistoryModal.tsx`. Se extrae tal cual a `src/components/SaleTicketModal.tsx` para que lo usen las dos pantallas, se amplía `getSaleForReprint` para que también responda a cajeros, y se hacen interactivas las filas del historial del cliente.

**Tech Stack:** Next.js 16 App Router (Server Actions + Client Components), Prisma 6.19.2 + PostgreSQL, Tailwind 4, `sonner` para avisos.

**Spec:** `docs/superpowers/specs/2026-08-12-ticket-desde-historial-cliente-design.md`

## Global Constraints

- **Nunca uses `npx`.** Usa `node_modules/.bin/...`.
- **No hay base de datos accesible desde esta máquina.** `DATABASE_URL` apunta a producción pero el puerto 5432 está cerrado. **No ejecutes consultas, ni `prisma db push`, ni levantes el servidor de desarrollo.** La verificación local es de tipos.
- **`npm run build` no valida tipos** (`ignoreBuildErrors: true` en `next.config.ts`). La verificación útil es `node_modules/.bin/tsc --noEmit` **filtrando por los archivos tocados**.
- **Línea base de tipos: 20 errores preexistentes** ajenos a este trabajo. Lo que importa es que no aparezcan errores nuevos en los archivos tocados.
- **El proyecto NO tiene framework de pruebas** (`package.json` solo trae `dev`, `build`, `start`, `lint`, `postinstall`) y no se va a agregar uno. No escribas tests.
- **El shell es zsh.** No agrupes opciones de `ssh` en variables; escríbelas en línea.
- **Nunca transferir `.env` ni `.env.local` al servidor.** Antes de desplegar, listar los archivos y esperar confirmación del usuario (regla de `CLAUDE.md`).
- **El servidor puede ir adelante del repo.** Antes de subir un archivo existente, comparar con el del servidor (`diff`).
- **No tocar:** `src/app/(seller-center)/pos/SaleTicket.tsx`, `src/app/(seller-center)/settings/actions.ts`, `src/app/(seller-center)/clients/actions.ts`, `src/app/(seller-center)/clients/page.tsx`, `src/app/(seller-center)/clients/ClientsClient.tsx`.
- **Este cambio NO altera** las columnas, los datos ni el diseño de la tabla del historial, ni el diseño del ticket.
- **Texto de interfaz en español**, siguiendo el tono existente (`font-black`, `uppercase tracking-widest` en etiquetas).
- El alias `@/*` resuelve a `./src/*` y **funciona con paréntesis en la ruta** (ya se usa `@/app/(seller-center)/products/new/actions` en `src/app/api/pos/sync/route.ts`).
- `<Toaster />` está montado en `src/app/layout.tsx:56`, así que `toast` de `sonner` funciona en cualquier pantalla.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/components/SaleTicketModal.tsx` (crear) | Modal de ticket compartido: cabecera, `SaleTicket`, botones Cerrar/Imprimir, y el ayudante de impresión |
| `src/app/(seller-center)/products/ProductSalesHistoryModal.tsx` (modificar) | Borra su copia del modal y del ayudante; consume el compartido |
| `src/app/(seller-center)/inventory/actions.ts` (modificar) | `getSaleForReprint` acepta cajeros del vendedor |
| `src/app/(seller-center)/clients/[id]/ClientHistoryClient.tsx` (modificar) | Filas interactivas que abren el ticket |

---

### Task 1: Extraer el modal de ticket a un componente compartido

**Files:**
- Create: `src/components/SaleTicketModal.tsx`
- Modify: `src/app/(seller-center)/products/ProductSalesHistoryModal.tsx` (ayudante `printSaleTicket` ~líneas 23-49, estado `globalConfig` ~línea 66, carga de config ~líneas 78-86, bloque del modal ~líneas 213-243)

**Interfaces:**
- Consumes: `SaleTicket` de `@/app/(seller-center)/pos/SaleTicket` (props `{ sale, elementId, isReprint?, storeName?, logoUrl? }`) y `getStoreSettings` de `@/app/(seller-center)/settings/actions` (devuelve `{ success: boolean; data?: any; error?: string }`).
- Produces: componente por defecto `SaleTicketModal({ sale, onClose })` con `sale: any` (la venta ya cargada, tal como la devuelve `getSaleForReprint`) y `onClose: () => void`. Lo usa la Tarea 3.

- [ ] **Step 1: Crear el componente compartido**

Crear `src/components/SaleTicketModal.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from 'react';
import SaleTicket from '@/app/(seller-center)/pos/SaleTicket';
import { getStoreSettings } from '@/app/(seller-center)/settings/actions';

const TICKET_ELEMENT_ID = 'sale-ticket-modal';

// Imprime solo el ticket: esconde el resto del body, inserta una copia del
// ticket, manda a imprimir y restaura todo. Movido tal cual desde
// ProductSalesHistoryModal.tsx.
const printSaleTicket = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const bodyChildren = Array.from(document.body.children) as HTMLElement[];
    const savedStyles: { el: HTMLElement; display: string }[] = [];
    bodyChildren.forEach(child => {
        savedStyles.push({ el: child, display: child.style.display });
        child.style.display = 'none';
    });
    const printArea = document.createElement('div');
    printArea.style.cssText = 'background:white;margin:0;padding:0;width:100%;display:flex;justify-content:center;';
    printArea.innerHTML = el.outerHTML;
    printArea.querySelectorAll('[class]').forEach(node => { (node as HTMLElement).style.boxShadow = 'none'; });
    document.body.appendChild(printArea);
    const origBg = document.body.style.background;
    const origMargin = document.body.style.margin;
    document.body.style.background = 'white';
    document.body.style.margin = '0';
    try { window.print(); } catch (err) { console.error(err); }
    const restore = () => {
        printArea.remove();
        document.body.style.background = origBg;
        document.body.style.margin = origMargin;
        savedStyles.forEach(({ el: child, display }) => { child.style.display = display; });
    };
    window.addEventListener('afterprint', restore, { once: true });
    setTimeout(restore, 3000);
};

export default function SaleTicketModal({
    sale,
    onClose,
}: {
    sale: any;
    onClose: () => void;
}) {
    // El logo y el nombre de la tienda los resuelve el propio modal, para que
    // ninguna pantalla que lo use tenga que acordarse de pasarlos.
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        let cancelled = false;
        getStoreSettings().then(res => {
            if (cancelled) return;
            if (res.success) setConfig(res.data);
        });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-border bg-gray-50 dark:bg-gray-800/50 rounded-t-3xl shrink-0 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-foreground">🖨️ Ticket #{sale.receiptNumber || sale.id.slice(-6)}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{new Date(sale.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 flex items-center justify-center font-bold transition-colors">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900 flex justify-center">
                    <SaleTicket
                        sale={sale}
                        elementId={TICKET_ELEMENT_ID}
                        isReprint
                        logoUrl={config?.logoUrl}
                        storeName={config?.storeName}
                    />
                </div>
                <div className="p-4 bg-card border-t border-border flex gap-3 rounded-b-3xl">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-border text-sm font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >Cerrar</button>
                    <button
                        onClick={() => printSaleTicket(TICKET_ELEMENT_ID)}
                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors flex justify-center items-center gap-2"
                    >🖨️ Imprimir</button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Importar el compartido en `ProductSalesHistoryModal.tsx`**

Agregar el import junto a los existentes, y **eliminar** el import de `SaleTicket` (ya no se usa ahí):

```tsx
import SaleTicketModal from '@/components/SaleTicketModal';
```

Queda: se borra `import SaleTicket from '../pos/SaleTicket';`, se agrega el de arriba, y `getProductSalesHistory`/`getSaleForReprint` se quedan como están.

- [ ] **Step 3: Borrar el ayudante duplicado**

En `ProductSalesHistoryModal.tsx`, **eliminar por completo** la constante `printSaleTicket` (~líneas 23-49, desde `const printSaleTicket = (elementId: string) => {` hasta su `};`). Ahora vive en el componente compartido.

- [ ] **Step 4: Quitar el estado de configuración que ya no se usa**

En el mismo archivo:

- Eliminar la línea `const [globalConfig, setGlobalConfig] = useState<any>(null);`
- Dentro del `useEffect`, eliminar el bloque que la cargaba:

```tsx
        // Cargar config global para el logo del ticket (solo una vez)
        if (!globalConfig) {
            import('../settings/actions').then(({ getStoreSettings }) => {
                getStoreSettings().then(res => {
                    if (cancelled) return;
                    if (res.success) setGlobalConfig(res.data);
                });
            });
        }
```

- Y quitar `globalConfig` del arreglo de dependencias, que queda: `}, [productId, page, status]);`

- [ ] **Step 5: Reemplazar el modal en línea por el componente**

Sustituir todo el bloque `{reprintSale && ( ... )}` (~líneas 213-243, el `<div className="fixed inset-0 bg-black/70 z-[60] ...">` completo) por:

```tsx
            {reprintSale && (
                <SaleTicketModal sale={reprintSale} onClose={() => setReprintSale(null)} />
            )}
```

El estado `reprintSale` y la función `handleViewTicket` no se tocan.

- [ ] **Step 6: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -E "SaleTicketModal|ProductSalesHistoryModal" || echo "SIN ERRORES en los archivos tocados"
```
Expected: `SIN ERRORES en los archivos tocados`. Si aparece `Cannot find module '@/components/SaleTicketModal'`, revisa que el archivo esté en `src/components/` con ese nombre exacto.

- [ ] **Step 7: Confirmar que no quedaron restos**

Run:
```bash
grep -n "printSaleTicket\|globalConfig\|from '../pos/SaleTicket'" "src/app/(seller-center)/products/ProductSalesHistoryModal.tsx" || echo "LIMPIO: no quedan referencias viejas"
```
Expected: `LIMPIO: no quedan referencias viejas`

- [ ] **Step 8: Commit**

```bash
git add src/components/SaleTicketModal.tsx "src/app/(seller-center)/products/ProductSalesHistoryModal.tsx"
git commit -m "refactor(ticket): extraer el modal de ticket a un componente compartido"
```

---

### Task 2: Ampliar `getSaleForReprint` para cajeros

**Files:**
- Modify: `src/app/(seller-center)/inventory/actions.ts` (`getSaleForReprint` ~líneas 225-256)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `getSaleForReprint(saleId: string)` sigue devolviendo la venta con `items`/`variant`/`product`, `client`, `paymentMethod`, `location`, `soldBy`, `salesperson`, o `null`. Cambia solo **quién** puede llamarla. La usa la Tarea 3.

- [ ] **Step 1: Agregar el ayudante de vendedor efectivo**

En `src/app/(seller-center)/inventory/actions.ts`, justo **antes** de `export async function getSaleForReprint`, agregar:

```ts
// Vendedor al que pertenece la sesión: el propio SELLER, o el vendedor que
// gestiona al CASHIER. Cualquier otro rol queda fuera.
async function resolveSaleOwnerId(user: any): Promise<string | null> {
    if (!user) return null;
    if (user.role === 'SELLER') return user.id;
    if (user.role === 'CASHIER') {
        const cashier = await (prisma.user as any).findUnique({
            where: { id: user.id },
            select: { managedBySellerId: true },
        });
        return cashier?.managedBySellerId || null;
    }
    return null;
}
```

- [ ] **Step 2: Usar el ayudante en `getSaleForReprint`**

Sustituir estas dos líneas del inicio de la función:

```ts
        const user = await getSessionUser();
        if (!user || user.role !== 'SELLER') return null;
```

por:

```ts
        const user = await getSessionUser();
        const ownerId = await resolveSaleOwnerId(user);
        if (!ownerId) return null;
```

Y sustituir la validación del final:

```ts
        if (sale.sellerId && sale.sellerId !== user.id) return null;
```

por:

```ts
        if (sale.sellerId && sale.sellerId !== ownerId) return null;
```

**Deliberado:** se conserva la forma `sale.sellerId && ...`, igual que hoy. Una venta antigua con `sellerId` nulo sigue pasando, como siempre; cambiar eso escondería ventas viejas legítimas y no es el objetivo de esta tarea. El aislamiento entre vendedores no se debilita: una venta **con** dueño solo la ve ese dueño (o su cajero).

**No toques** `getProductSalesHistory`, en el mismo archivo, que sigue siendo exclusiva del vendedor.

- [ ] **Step 3: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "inventory/actions" || echo "SIN ERRORES en inventory/actions"
```
Expected: `SIN ERRORES en inventory/actions`

- [ ] **Step 4: Commit**

```bash
git add "src/app/(seller-center)/inventory/actions.ts"
git commit -m "feat(ticket): permitir que el cajero abra el ticket de una venta"
```

---

### Task 3: Filas del historial del cliente que abren el ticket

**Files:**
- Modify: `src/app/(seller-center)/clients/[id]/ClientHistoryClient.tsx` (imports ~líneas 1-5, estado ~líneas 8-9, cabecera de tabla ~líneas 92-99, fila ~líneas 116-149, cierre del componente ~línea 163)

**Interfaces:**
- Consumes: `SaleTicketModal({ sale, onClose })` de la Tarea 1 y `getSaleForReprint(saleId)` de la Tarea 2.
- Produces: la funcionalidad visible. La Tarea 4 la verifica en el navegador.

- [ ] **Step 1: Agregar los imports**

En `src/app/(seller-center)/clients/[id]/ClientHistoryClient.tsx`, junto a los imports existentes:

```tsx
import { toast } from 'sonner';
import SaleTicketModal from '@/components/SaleTicketModal';
import { getSaleForReprint } from '../../inventory/actions';
```

- [ ] **Step 2: Agregar el estado**

Dentro de `ClientHistoryClient`, junto a `const [isLoading, setIsLoading] = useState(true);`:

```tsx
    const [ticketSale, setTicketSale] = useState<any | null>(null);
    const [openingSaleId, setOpeningSaleId] = useState<string | null>(null);
```

- [ ] **Step 3: Agregar la función que abre el ticket**

Justo después del `useEffect` existente:

```tsx
    const handleOpenTicket = async (saleId: string) => {
        if (openingSaleId) return;            // ya hay una abriéndose: ignora más clics
        setOpeningSaleId(saleId);
        const sale = await getSaleForReprint(saleId);
        setOpeningSaleId(null);
        if (sale) setTicketSale(sale);
        else toast.error('No se pudo abrir el ticket.');
    };
```

- [ ] **Step 4: Agregar la columna de la flecha en la cabecera**

En el `<thead>`, después de `<th className="px-6 py-4 text-right">Saldo Adeudado (Si Layaway)</th>`:

```tsx
                                    <th className="px-4 py-4 w-10"><span className="sr-only">Ver ticket</span></th>
```

- [ ] **Step 5: Hacer la fila interactiva**

Sustituir la apertura de la fila:

```tsx
                                        <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
```

por:

```tsx
                                        <tr
                                            key={sale.id}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Ver ticket de la venta ${sale.receiptNumber ? `#PDV${sale.receiptNumber}` : ''}`}
                                            onClick={() => handleOpenTicket(sale.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenTicket(sale.id); }
                                            }}
                                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors focus:outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
                                        >
```

- [ ] **Step 6: Agregar la celda de la flecha**

Dentro de la misma fila, después de la última celda (la del saldo adeudado, que termina en `</td>` justo antes de `</tr>`):

```tsx
                                            <td className="px-4 py-4 text-right text-gray-300 dark:text-gray-600">
                                                {openingSaleId === sale.id ? '⋯' : '›'}
                                            </td>
```

- [ ] **Step 7: Montar el modal**

El archivo termina así:

```tsx
                )}
            </div>
        </div>
    );
}
```

El `</div>` interno cierra la tarjeta del historial y el externo cierra el contenedor de la página. El modal va **entre los dos**, quedando:

```tsx
                )}
            </div>

            {ticketSale && (
                <SaleTicketModal sale={ticketSale} onClose={() => setTicketSale(null)} />
            )}
        </div>
    );
}
```

O sea, agregar:

```tsx
            {ticketSale && (
                <SaleTicketModal sale={ticketSale} onClose={() => setTicketSale(null)} />
            )}
```

- [ ] **Step 8: Verificar tipos**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -E "ClientHistoryClient|SaleTicketModal" || echo "SIN ERRORES en los archivos tocados"
```
Expected: `SIN ERRORES en los archivos tocados`

- [ ] **Step 9: Confirmar que el total de errores no subió**

Run:
```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: `20` (la línea base). Si sale más, hay un error nuevo introducido por este trabajo.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(seller-center)/clients/[id]/ClientHistoryClient.tsx"
git commit -m "feat(clientes): abrir el ticket de una venta desde el historial"
```

---

### Task 4: Despliegue y verificación con datos reales

**Files:**
- Deploy: los 4 archivos de las Tareas 1-3

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la funcionalidad viva en producción, verificada.

- [ ] **Step 1: Comparar cada archivo modificado contra el servidor**

El servidor puede tener código que no está en git. Para **cada uno** de los 3 archivos que se modifican (no el que se crea), comparar antes de subir:

La versión de git anterior a este trabajo es el commit de la spec, **`4543440`**. Úsalo como referencia fija en vez de `HEAD~N`, que se desajusta si hubo rondas de corrección:

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cat '/var/www/modazapo/src/app/(seller-center)/products/ProductSalesHistoryModal.tsx'" > /tmp/srv-cmp.tsx && diff /tmp/srv-cmp.tsx <(git show 4543440:"src/app/(seller-center)/products/ProductSalesHistoryModal.tsx")
```

Repetir cambiando la ruta para `src/app/(seller-center)/inventory/actions.ts` y `src/app/(seller-center)/clients/[id]/ClientHistoryClient.tsx`.

Expected: sin diferencias. **Si aparece alguna, detente y avisa al usuario** — significa que el servidor tiene código más reciente que el repo. Las credenciales SSH están en `SECRETOS.md`.

- [ ] **Step 2: Listar los archivos y pedir confirmación al usuario**

**Regla de `CLAUDE.md`: no transferir nada sin confirmación.** Presentar esta lista y esperar el "sí":

```
src/components/SaleTicketModal.tsx                                   (nuevo)
src/app/(seller-center)/products/ProductSalesHistoryModal.tsx        (modificar)
src/app/(seller-center)/inventory/actions.ts                         (modificar)
src/app/(seller-center)/clients/[id]/ClientHistoryClient.tsx         (modificar)

NO se transfiere: .env, .env.local, ni ningún archivo de configuración.
```

- [ ] **Step 3: Transferir los archivos**

`scp` falla con rutas que llevan paréntesis, así que se transfiere codificando en base64. Para cada archivo:

```bash
base64 -i "src/components/SaleTicketModal.tsx" | ssh -o StrictHostKeyChecking=no root@187.124.158.239 "base64 -d > '/var/www/modazapo/src/components/SaleTicketModal.tsx'"
```

Verificar que llegaron con el tamaño correcto comparando `wc -c` local contra remoto para cada uno.

- [ ] **Step 4: Compilar y reiniciar**

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "cd /var/www/modazapo && npm run build && pm2 restart modazapo"
```
Expected: `✓ Compiled successfully` (tarda ~35-80 segundos) y PM2 reporta `online`. **No hace falta `prisma db push`: este trabajo no toca la base de datos.**

- [ ] **Step 5: Verificación funcional en el navegador**

Entrando como Kalexa Fashion (vendedor):

1. `Clientes → Ver` en un cliente con varias ventas: cada fila muestra `›` al final y el cursor cambia al pasar encima.
2. Clic en una fila → se abre el ticket **de esa venta**, con su folio correcto y los productos que se llevó.
3. Clic en otra fila distinta → abre la suya, no la anterior.
4. El botón **Imprimir** manda solo el ticket, no la pantalla completa.
5. Cerrar y reabrir funciona; el fondo del historial sigue navegable después de cerrar.
6. En el celular, tocar la fila hace lo mismo.
7. Con el teclado: `Tab` llega a las filas y `Enter` abre el ticket.
8. **Que no se rompió lo de antes:** `Inventario → un producto → 📊 Historial de Ventas` sigue abriendo su ticket igual que siempre, con logo y nombre de tienda.
9. Como cajero (con sesión de cajero): `Clientes → Ver` → una fila abre su ticket con el logo y el nombre de la tienda del vendedor.
10. La tabla, sus columnas y los recuadros de Ventas / Saldo Global se ven igual que antes.

- [ ] **Step 6: Revisar el log de errores del servidor**

```bash
ssh -o StrictHostKeyChecking=no root@187.124.158.239 "ls -l --time-style=+%H:%M:%S ~/.pm2/logs/modazapo-error.log; date '+ahora %H:%M:%S'"
```
Expected: el log no crece después del reinicio. Los `Failed to find Server Action` o `Invalid Server Actions request` que aparezcan **durante** la compilación son de pestañas abiertas con la versión vieja y se resuelven recargando; no son defectos.
