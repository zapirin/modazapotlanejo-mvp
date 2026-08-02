# Recordatorio de pago pendiente — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recuperar ventas perdidas enviando un recordatorio por correo a los compradores con órdenes en `PENDING_PAYMENT`, y darles un botón para reanudar el pago que hoy no existe.

**Architecture:** Un endpoint de cron protegido por secret busca órdenes sin pagar dentro de una ventana de tiempo, las agrupa por comprador y envía un correo con `Resend`, estampando un campo nuevo para no repetir. El correo apunta a `mis-pedidos`, donde un botón nuevo reanuda el pago llamando a `createCheckoutSession` con la orden que ya existe. Se agrega además un campo de consentimiento de marketing que aún no se consume.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL, Resend, Stripe.

**Spec:** `docs/superpowers/specs/2026-08-01-recordatorio-pago-pendiente-design.md`

## Global Constraints

- **Sin dependencias nuevas.** El proyecto no tiene framework de pruebas (`package.json` solo trae `dev`, `build`, `start`, `lint`, `postinstall`) y no se va a agregar uno. La verificación es por script ejecutable con `node` y comprobación manual en el navegador.
- **Prisma sin migraciones.** No existe `prisma/migrations/`. Los cambios de esquema se aplican con `npx prisma db push`.
- **Nunca ejecutar los scripts de verificación contra producción.** La IP de producción es `187.124.158.239`. El script de la Tarea 5 incluye un guardia que aborta si detecta esa IP en `DATABASE_URL`.
- **Nunca transferir `.env` ni `.env.local` al servidor.** Antes de cualquier despliegue, listar los archivos y esperar confirmación del usuario (regla de `CLAUDE.md`).
- **No tocar:** `src/app/api/webhooks/stripe/route.ts`, `src/app/actions/orders.ts`, `src/app/(marketplace)/cart/page.tsx`, `src/lib/CartContext.tsx`, `src/app/actions/escrow.ts`, `src/app/api/cron/low-stock-digest/route.ts`.
- **Texto de interfaz en español**, siguiendo el tono existente (mayúsculas, `font-black`, tracking ancho).

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma` (modificar) | 2 campos aditivos: `User.marketingConsent`, `Order.paymentReminderSentAt` |
| `src/app/actions/stripe.ts` (modificar) | Volver `items`/`total` opcionales — ya se ignoran |
| `src/app/(marketplace)/mis-pedidos/page.tsx` (modificar) | Botón "Pagar ahora" en órdenes `PENDING_PAYMENT` |
| `src/lib/email/templates.ts` (modificar) | Plantilla `sendPendingPaymentReminder` |
| `src/app/api/cron/abandoned-payment/route.ts` (crear) | Selección, agrupación, envío y estampado |
| `src/app/(marketplace)/register/buyer/BuyerRegistrationForm.tsx` (modificar) | Casilla de consentimiento |
| `src/app/actions/auth.ts` (modificar) | Persistir el consentimiento |
| `scripts/verificar-recordatorio.mjs` (crear) | Utilidad de verificación local |

---

### Task 1: Campos nuevos en el esquema

**Files:**
- Modify: `prisma/schema.prisma` (modelo `User` ~línea 137, modelo `Order` ~línea 566)

**Interfaces:**
- Consumes: nada
- Produces: `User.marketingConsent: boolean` (default `false`, no nulo) y `Order.paymentReminderSentAt: Date | null`, usados por las Tareas 3, 4 y 6.

- [ ] **Step 1: Agregar el campo al modelo `User`**

En `prisma/schema.prisma`, dentro de `model User`, junto a los demás campos escalares (por ejemplo después de `registeredDomain String?`):

```prisma
  marketingConsent          Boolean                @default(false)
```

- [ ] **Step 2: Agregar el campo al modelo `Order`**

Dentro de `model Order`, después de `refundedAt DateTime?`:

```prisma
  paymentReminderSentAt DateTime?
```

- [ ] **Step 3: Aplicar el cambio y regenerar el cliente**

Run:
```bash
npx prisma db push
```
Expected: termina con `Your database is now in sync with your Prisma schema.` y regenera el cliente. Ambos campos son aditivos (uno con default, otro nulo), así que no pide confirmación de pérdida de datos. **Si Prisma advierte de pérdida de datos, detente** — significa que el esquema local difiere del de la base y hay que revisarlo antes de continuar.

- [ ] **Step 4: Verificar que los campos existen**

Run:
```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.order.findMany({take:1,select:{id:true,paymentReminderSentAt:true}}).then(r=>{console.log('Order OK',r);return p.user.findMany({take:1,select:{id:true,marketingConsent:true}})}).then(r=>{console.log('User OK',r);process.exit(0)}).catch(e=>{console.error('FALLO:',e.message);process.exit(1)})"
```
Expected: imprime `Order OK [...]` y `User OK [...]` y sale con código 0. Si algún campo no existiera, Prisma lanzaría un error de columna desconocida.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(esquema): campos para el recordatorio de pago y el consentimiento de marketing"
```

---

### Task 2: Botón para reanudar el pago

**Files:**
- Modify: `src/app/actions/stripe.ts:20-24`
- Modify: `src/app/(marketplace)/mis-pedidos/page.tsx`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `createCheckoutSession({ orderIds: string[] })` invocable sin `items` ni `total`. La Tarea 4 depende de que esta pantalla exista, porque es el destino del enlace del correo.

- [ ] **Step 1: Volver opcionales los parámetros ignorados**

En `src/app/actions/stripe.ts`, la función ya reconstruye los line items desde la base de datos (líneas 45-83) e ignora por completo `data.items` y `data.total`. Cambiar solo la firma:

```ts
export async function createCheckoutSession(data: {
  orderIds: string[];
  items?: { productName: string; quantity: number; price: number; image?: string; size?: string; color?: string }[];
  total?: number;
}) {
```

El carrito los sigue enviando y no se ve afectado. No tocar nada más de este archivo.

- [ ] **Step 2: Importar la acción y agregar el estado de carga**

En `src/app/(marketplace)/mis-pedidos/page.tsx`, agregar el import junto a los existentes:

```ts
import { createCheckoutSession } from '@/app/actions/stripe';
```

Y dentro del componente, junto a `const [releasing, setReleasing] = useState<string | null>(null);`:

```ts
    const [paying, setPaying] = useState<string | null>(null);
```

- [ ] **Step 3: Agregar el manejador**

Después de `handleConfirmDelivery` (termina en la línea 48):

```ts
    const handleResumePayment = async (orderId: string) => {
        setPaying(orderId);
        try {
            const res = await createCheckoutSession({ orderIds: [orderId] });
            if (res.success && res.url) {
                window.location.href = res.url;
                return;
            }
            toast.error(res.error || 'No se pudo iniciar el pago');
        } catch {
            toast.error('No se pudo iniciar el pago');
        }
        setPaying(null);
    };
```

No se limpia `paying` en el camino exitoso a propósito: el navegador se está yendo a Stripe y limpiarlo haría parpadear el botón.

- [ ] **Step 4: Agregar el bloque en la tarjeta del pedido**

En el JSX, insertar **justo antes** del comentario `{/* Confirm delivery */}` (línea 135):

```tsx
                                {/* Reanudar pago */}
                                {order.status === 'PENDING_PAYMENT' && (
                                    <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/10 border-t border-border">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div>
                                                <p className="font-black text-sm text-amber-800 dark:text-amber-300">Este pedido está esperando tu pago</p>
                                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                                    Complétalo para que el vendedor pueda prepararlo y enviarlo.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleResumePayment(order.id)}
                                                disabled={paying === order.id}
                                                className="shrink-0 px-6 py-2.5 bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {paying === order.id ? (
                                                    <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Redirigiendo...</>
                                                ) : (
                                                    '💳 Pagar ahora'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
```

- [ ] **Step 5: Verificar que compila**

Run:
```bash
npx tsc --noEmit
```
Expected: sin errores en `mis-pedidos/page.tsx` ni en `stripe.ts`. (El proyecto puede tener errores preexistentes en otros archivos; solo importa que estos dos estén limpios.)

- [ ] **Step 6: Verificar en el navegador**

Run: `npm run dev`

Con una cuenta de comprador que tenga una orden en `PENDING_PAYMENT`, entrar a `/mis-pedidos`. Expected: aparece la franja ámbar con el botón "💳 Pagar ahora"; al pulsarlo redirige a Stripe Checkout con el monto correcto (productos + envío, menos descuentos). Las órdenes en otros estados no muestran la franja.

Si no hay ninguna orden en ese estado, crear una: agregar productos al carrito, pulsar pagar y cancelar en la pantalla de Stripe.

- [ ] **Step 7: Commit**

```bash
git add "src/app/actions/stripe.ts" "src/app/(marketplace)/mis-pedidos/page.tsx"
git commit -m "feat(pedidos): boton para reanudar el pago de un pedido pendiente"
```

---

### Task 3: Plantilla del correo

**Files:**
- Modify: `src/lib/email/templates.ts` (agregar al final del archivo)

**Interfaces:**
- Consumes: helpers privados ya existentes en el archivo — `baseLayout({ brandName?, brandColor?, title, body })`, `ctaButton(text, url, color?)`, `divider`, y la constante `APP_URL`.
- Produces: `sendPendingPaymentReminder({ buyerEmail: string; buyerName: string; orders: { orderNumber: number; total: number; sellerName: string }[]; domain?: string }): Promise<{ success: boolean; error?: unknown }>` — consumida por la Tarea 4.

- [ ] **Step 1: Agregar la plantilla al final de `templates.ts`**

```ts
// ---------------------------------------------------------------------------
// 13. RECORDATORIO DE PAGO PENDIENTE — Para el COMPRADOR
// Lo dispara el cron abandoned-payment cuando una orden lleva horas sin pagarse
// ---------------------------------------------------------------------------

export async function sendPendingPaymentReminder({
  buyerEmail,
  buyerName,
  orders,
  domain,
}: {
  buyerEmail: string;
  buyerName: string;
  orders: { orderNumber: number; total: number; sellerName: string }[];
  domain?: string;
}) {
  const esKalexa = domain?.includes('kalexa');
  const brandName = esKalexa
    ? 'Kalexa Fashion'
    : domain?.includes('zonadelvestir')
      ? 'Zona del Vestir'
      : 'Moda Zapotlanejo';
  const brandColor = esKalexa ? '#8124E3' : '#2563eb';

  const varios = orders.length > 1;
  const total = orders.reduce((suma, o) => suma + o.total, 0);

  const filas = orders.map(o => `
    <tr>
      <td style="padding:10px 12px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;">
        Pedido #${o.orderNumber}
        <br/><span style="font-size:12px;color:#64748b;">${o.sellerName}</span>
      </td>
      <td style="padding:10px 12px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">
        $${o.total.toFixed(2)}
      </td>
    </tr>
  `).join('');

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
      ${varios ? 'Tus pedidos siguen sin pagar' : 'Tu pedido sigue sin pagar'}
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hola <strong>${buyerName}</strong>, notamos que ${varios ? 'tus pedidos quedaron' : 'tu pedido quedó'} sin completar el pago.
      ${varios ? 'Siguen apartados' : 'Sigue apartado'} y ${varios ? 'puedes terminarlos' : 'puedes terminarlo'} en un par de clics.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:collapse;margin:20px 0;overflow:hidden;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Pedido</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#64748b;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <div style="text-align:right;margin-top:8px;">
      <p style="font-size:18px;font-weight:800;color:#1e293b;margin:0;">
        Total: <span style="color:${brandColor};">$${total.toFixed(2)}</span>
      </p>
    </div>

    ${ctaButton('Completar mi pago', `${APP_URL}/mis-pedidos`, brandColor)}

    ${divider}

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Si ya no ${varios ? 'te interesan estos pedidos' : 'te interesa este pedido'}, puedes ignorar este correo: ${varios ? 'se cancelarán' : 'se cancelará'} solo.
    </p>
  `;

  return sendEmail({
    to: buyerEmail,
    subject: varios
      ? `Tienes ${orders.length} pedidos esperando tu pago`
      : `Tu pedido #${orders[0].orderNumber} está esperando tu pago`,
    html: baseLayout({ brandName, brandColor, title: 'Pago pendiente', body }),
    domain,
  });
}
```

- [ ] **Step 2: Verificar que compila**

Run:
```bash
npx tsc --noEmit
```
Expected: sin errores nuevos en `templates.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/templates.ts
git commit -m "feat(correos): plantilla de recordatorio de pago pendiente"
```

---

### Task 4: Endpoint del cron

**Files:**
- Create: `src/app/api/cron/abandoned-payment/route.ts`

**Interfaces:**
- Consumes: `sendPendingPaymentReminder` de la Tarea 3; `Order.paymentReminderSentAt` de la Tarea 1.
- Produces: `GET /api/cron/abandoned-payment?secret=<CRON_SECRET>` → `200 { ok: true, remindersSent: number }` o `401 { error: 'Unauthorized' }`. La Tarea 6 lo agenda.

- [ ] **Step 1: Crear el endpoint**

Sigue la misma forma que `src/app/api/cron/low-stock-digest/route.ts`.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPendingPaymentReminder } from '@/lib/email/templates';

const GRACIA_HORAS = 4;   // no molestar antes de esto
const VENTANA_HORAS = 48; // ni después: evita escribirle al historial viejo

export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const ahora = Date.now();
        const masNuevaQue = new Date(ahora - VENTANA_HORAS * 60 * 60 * 1000);
        const masViejaQue = new Date(ahora - GRACIA_HORAS * 60 * 60 * 1000);

        const orders = await prisma.order.findMany({
            where: {
                status: 'PENDING_PAYMENT',
                paymentReminderSentAt: null,
                createdAt: { lte: masViejaQue, gte: masNuevaQue },
            },
            include: {
                buyer: { select: { id: true, email: true, name: true } },
                seller: { select: { name: true, businessName: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Un checkout genera una orden por vendedor: agrupar para mandar un
        // solo correo por comprador, no uno por vendedor.
        const porComprador = new Map<string, typeof orders>();
        for (const order of orders) {
            if (!order.buyer?.email) continue;
            const lista = porComprador.get(order.buyerId) ?? [];
            lista.push(order);
            porComprador.set(order.buyerId, lista);
        }

        let enviados = 0;

        for (const ordenes of porComprador.values()) {
            const comprador = ordenes[0].buyer;
            try {
                const res = await sendPendingPaymentReminder({
                    buyerEmail: comprador.email,
                    buyerName: comprador.name || 'comprador',
                    orders: ordenes.map(o => ({
                        orderNumber: o.orderNumber,
                        total: o.total,
                        sellerName: o.seller?.businessName || o.seller?.name || 'Vendedor',
                    })),
                    domain: ordenes[0].sourceDomain || undefined,
                });

                // Solo se estampa si el envío salió bien, para que un fallo
                // temporal de Resend se reintente en la siguiente corrida.
                if (!res?.success) {
                    console.error('[abandoned-payment] Envío fallido a', comprador.email, res?.error);
                    continue;
                }

                await prisma.order.updateMany({
                    where: { id: { in: ordenes.map(o => o.id) } },
                    data: { paymentReminderSentAt: new Date() },
                });
                enviados++;
            } catch (e) {
                console.error('[abandoned-payment] Error con', comprador.email, e);
            }
        }

        console.log(`[abandoned-payment] Recordatorios enviados: ${enviados}`);
        return NextResponse.json({ ok: true, remindersSent: enviados });
    } catch (error: any) {
        console.error('[abandoned-payment] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verificar que compila**

Run:
```bash
npx tsc --noEmit
```
Expected: sin errores nuevos.

- [ ] **Step 3: Verificar que el secret protege el endpoint**

Con `npm run dev` corriendo:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/cron/abandoned-payment"
```
Expected: `401`

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/cron/abandoned-payment?secret=incorrecto"
```
Expected: `401`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/abandoned-payment/route.ts
git commit -m "feat(cron): endpoint de recordatorio de pago pendiente"
```

---

### Task 5: Verificación end-to-end

**Files:**
- Create: `scripts/verificar-recordatorio.mjs`

**Interfaces:**
- Consumes: el endpoint de la Tarea 4, los campos de la Tarea 1.
- Produces: nada que consuma código de producción. Es una utilidad de desarrollo.

- [ ] **Step 1: Crear el script de apoyo**

Usa `@prisma/client`, que ya está instalado — no hace falta `tsx` ni ninguna dependencia nueva.

```js
// Utilidad de desarrollo para verificar el recordatorio de pago pendiente.
// Uso:
//   node scripts/verificar-recordatorio.mjs estado
//   node scripts/verificar-recordatorio.mjs preparar <horas>
import { PrismaClient } from '@prisma/client';

// Guardia: este script modifica datos, jamás debe correr contra producción.
const url = process.env.DATABASE_URL || '';
if (url.includes('187.124.158.239')) {
    console.error('ABORTADO: DATABASE_URL apunta a producción.');
    process.exit(1);
}

const prisma = new PrismaClient();
const [comando, arg] = process.argv.slice(2);

const resumen = (o) =>
    `#${o.orderNumber} ${o.status} creada=${o.createdAt.toISOString()} recordatorio=${o.paymentReminderSentAt?.toISOString() ?? 'null'}`;

if (comando === 'estado') {
    const ordenes = await prisma.order.findMany({
        where: { status: 'PENDING_PAYMENT' },
        select: { id: true, orderNumber: true, status: true, createdAt: true, paymentReminderSentAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });
    console.log(`Órdenes PENDING_PAYMENT (${ordenes.length}):`);
    ordenes.forEach(o => console.log('  ' + resumen(o)));
} else if (comando === 'preparar') {
    const horas = Number(arg);
    if (!Number.isFinite(horas)) {
        console.error('Uso: node scripts/verificar-recordatorio.mjs preparar <horas>');
        process.exit(1);
    }
    const reciente = await prisma.order.findFirst({
        where: { status: 'PENDING_PAYMENT' },
        orderBy: { createdAt: 'desc' },
        select: { buyerId: true },
    });
    if (!reciente) {
        console.error('No hay ninguna orden PENDING_PAYMENT. Crea una desde el carrito y cancela en Stripe.');
        process.exit(1);
    }
    // Se preparan TODAS las órdenes pendientes de ese comprador, no solo una:
    // así se puede probar también el caso agrupado (varios vendedores).
    await prisma.order.updateMany({
        where: { status: 'PENDING_PAYMENT', buyerId: reciente.buyerId },
        data: {
            createdAt: new Date(Date.now() - horas * 60 * 60 * 1000),
            paymentReminderSentAt: null,
        },
    });
    const actualizadas = await prisma.order.findMany({
        where: { status: 'PENDING_PAYMENT', buyerId: reciente.buyerId },
        select: { id: true, orderNumber: true, status: true, createdAt: true, paymentReminderSentAt: true },
    });
    console.log(`Órdenes preparadas para el comprador ${reciente.buyerId} (${actualizadas.length}):`);
    actualizadas.forEach(o => console.log('  ' + resumen(o)));
} else {
    console.error('Comandos: estado | preparar <horas>');
    process.exit(1);
}

await prisma.$disconnect();
```

- [ ] **Step 2: Verificar el envío (criterio 1 del spec)**

Necesitas una orden en `PENDING_PAYMENT`; si no hay, créala desde el carrito cancelando en Stripe. Con `npm run dev` corriendo:

```bash
node scripts/verificar-recordatorio.mjs preparar 6
```
Expected: imprime la orden con `createdAt` de hace 6 horas y `recordatorio=null`.

```bash
curl -s "http://localhost:3000/api/cron/abandoned-payment?secret=$CRON_SECRET"
```
Expected: `{"ok":true,"remindersSent":1}` y llega el correo a la dirección del comprador.

```bash
node scripts/verificar-recordatorio.mjs estado
```
Expected: esa orden ahora tiene `recordatorio=` con una fecha, no `null`.

- [ ] **Step 3: Verificar que no duplica (criterio 2)**

```bash
curl -s "http://localhost:3000/api/cron/abandoned-payment?secret=$CRON_SECRET"
```
Expected: `{"ok":true,"remindersSent":0}` y no llega ningún correo.

- [ ] **Step 4: Verificar la protección del historial viejo (criterio 3)**

```bash
node scripts/verificar-recordatorio.mjs preparar 120
curl -s "http://localhost:3000/api/cron/abandoned-payment?secret=$CRON_SECRET"
```
Expected: `{"ok":true,"remindersSent":0}` — 120 horas queda fuera de la ventana de 48.

- [ ] **Step 5: Verificar la ventana de gracia**

```bash
node scripts/verificar-recordatorio.mjs preparar 1
curl -s "http://localhost:3000/api/cron/abandoned-payment?secret=$CRON_SECRET"
```
Expected: `{"ok":true,"remindersSent":0}` — 1 hora aún no cumple la gracia de 4.

- [ ] **Step 6: Verificar la agrupación (criterio 4)**

Requiere un comprador con 2 órdenes `PENDING_PAYMENT` de vendedores distintos: llenar el carrito con productos de dos tiendas, pulsar pagar y cancelar en Stripe. Como `preparar` actúa sobre todas las órdenes pendientes de ese comprador, basta con:

```bash
node scripts/verificar-recordatorio.mjs preparar 6
```
Expected: lista las 2 órdenes preparadas.

```bash
curl -s "http://localhost:3000/api/cron/abandoned-payment?secret=$CRON_SECRET"
```
Expected: `{"ok":true,"remindersSent":1}` — `1`, no `2` — y llega **un solo correo** listando ambos pedidos con el total sumado.

- [ ] **Step 7: Verificar que no hubo regresión (criterio 7)**

- Hacer una compra completa desde el carrito hasta el pago exitoso en Stripe. Expected: la orden pasa a `PAID` como siempre.
- Run: `curl -s "http://localhost:3000/api/cron/low-stock-digest?secret=$CRON_SECRET"`. Expected: responde `{"ok":true,...}` igual que antes.

- [ ] **Step 8: Commit**

```bash
git add scripts/verificar-recordatorio.mjs
git commit -m "chore(scripts): utilidad para verificar el recordatorio de pago"
```

---

### Task 6: Consentimiento de marketing

**Files:**
- Modify: `src/app/actions/auth.ts:207-249`
- Modify: `src/app/(marketplace)/register/buyer/BuyerRegistrationForm.tsx`

**Interfaces:**
- Consumes: `User.marketingConsent` de la Tarea 1.
- Produces: nada que se consuma todavía. Es preparación para campañas futuras.

- [ ] **Step 1: Aceptar el consentimiento en la acción de registro**

En `src/app/actions/auth.ts`, agregar el campo a la firma de `registerBuyer` (después de `registeredDomain?: string;`):

```ts
    marketingConsent?: boolean;
```

Y dentro de `prisma.user.create`, después de `registeredDomain: domain,`:

```ts
                marketingConsent: data.marketingConsent ?? false,
```

- [ ] **Step 2: Agregar el estado en el formulario**

En `BuyerRegistrationForm.tsx`, junto a los otros `useState` (después de la línea 27):

```ts
    const [marketingConsent, setMarketingConsent] = useState(false);
```

- [ ] **Step 3: Enviarlo al registrar**

Dentro de la llamada a `registerBuyer`, después de `registeredDomain,`:

```ts
            marketingConsent,
```

- [ ] **Step 4: Agregar la casilla**

Insertar **justo antes** del `<button type="submit"`:

```tsx
                    <label className="flex items-start gap-3 px-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={marketingConsent}
                            onChange={(e) => setMarketingConsent(e.target.checked)}
                            className="mt-0.5 w-5 h-5 rounded-md border-border accent-blue-600 shrink-0"
                        />
                        <span className="text-[11px] font-bold text-gray-500 leading-relaxed">
                            Quiero recibir ofertas y novedades por correo. Puedes pedirnos que te demos de baja cuando quieras.
                        </span>
                    </label>
```

Va desmarcada por defecto y es opcional: el formulario se envía igual sin marcarla.

- [ ] **Step 5: Verificar que compila**

Run:
```bash
npx tsc --noEmit
```
Expected: sin errores nuevos.

- [ ] **Step 6: Verificar en el navegador**

Con `npm run dev`, registrar un comprador de prueba **con** la casilla marcada, y otro **sin** marcarla.

```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.findMany({where:{role:'BUYER'},select:{email:true,marketingConsent:true},orderBy:{createdAt:'desc'},take:2}).then(r=>{console.log(r);process.exit(0)})"
```
Expected: el primero con `marketingConsent: true`, el segundo con `false`.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/auth.ts "src/app/(marketplace)/register/buyer/BuyerRegistrationForm.tsx"
git commit -m "feat(registro): casilla opcional de consentimiento de marketing"
```

---

### Task 7: Despliegue y agendado del cron

**Files:**
- Ninguno del repositorio. Cambios en el servidor de producción.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la función corriendo en producción.

- [ ] **Step 1: Averiguar cómo se dispara hoy el cron existente**

Este es el punto abierto del spec. Por SSH al servidor (credenciales en `SECRETOS.md`):

```bash
crontab -l
```

Buscar una línea que llame a `low-stock-digest`. Si no aparece ahí, revisar `sudo crontab -l` y `ls /etc/cron.d/`. Si tampoco, el disparador es un servicio externo (tipo cron-job.org) y hay que preguntarle al usuario cuál usa. **No inventar un mecanismo nuevo: replicar el que ya existe.**

- [ ] **Step 2: Comparar los archivos con el servidor antes de subir**

El servidor tiene código que no está en git. Para cada archivo a transferir, comparar primero contra la versión remota y confirmar que no se pisa trabajo que solo existe allá.

Archivos a transferir (los 6 del repositorio; `scripts/verificar-recordatorio.mjs` **no** se sube, es solo local):

```
prisma/schema.prisma
src/app/actions/stripe.ts
src/app/actions/auth.ts
src/app/(marketplace)/mis-pedidos/page.tsx
src/app/(marketplace)/register/buyer/BuyerRegistrationForm.tsx
src/lib/email/templates.ts
src/app/api/cron/abandoned-payment/route.ts
```

**Listar estos archivos al usuario y esperar su confirmación antes de transferir** (regla de `CLAUDE.md`). **Nunca transferir `.env` ni `.env.local`.**

- [ ] **Step 3: Transferir, aplicar el esquema y reconstruir**

Transferir con `base64 | ssh | base64 -d` (SCP falla con las rutas que llevan paréntesis). Después, en el servidor:

```bash
cd /var/www/modazapo && npx prisma db push && npm run build && pm2 restart modazapo
```

Verificar con `ls -la` que los archivos llegaron con el tamaño correcto.

- [ ] **Step 4: Probar en producción sin mandar correos masivos**

```bash
curl -s "https://modazapotlanejo.com/api/cron/abandoned-payment?secret=<CRON_SECRET del servidor>"
```
Expected: `{"ok":true,"remindersSent":N}`. Por la ventana de 48 horas, `N` debe ser pequeño o `0` — **si sale un número grande, algo está mal con la ventana**: revisar antes de agendarlo.

- [ ] **Step 5: Agendar el cron igual que el existente**

Con el mecanismo hallado en el Step 1, agendarlo **cada hora**. La granularidad fina la da la ventana de 4-48 h, no la frecuencia; correrlo cada hora hace que el recordatorio salga entre las 4 y 5 horas del abandono.

Si es `crontab`, la línea sería (ajustando dominio y ruta al patrón del cron existente):

```
0 * * * * curl -s "https://modazapotlanejo.com/api/cron/abandoned-payment?secret=<CRON_SECRET>" >/dev/null 2>&1
```

- [ ] **Step 6: Confirmar al día siguiente**

Run: `pm2 logs modazapo --nostream --lines 100 | grep abandoned-payment`
Expected: líneas `[abandoned-payment] Recordatorios enviados: N` una vez por hora, sin errores.

- [ ] **Step 7: Commit final**

```bash
git add docs/superpowers/plans/2026-08-01-recordatorio-pago-pendiente.md
git commit -m "docs(plan): plan de implementacion del recordatorio de pago"
```
