# Recordatorio de pago pendiente + consentimiento de marketing

**Fecha:** 2026-08-01
**Estado:** Diseño aprobado, pendiente de plan de implementación

## Problema

Cuando un comprador llega al checkout y no completa el pago en Stripe, queda una
orden en `PENDING_PAYMENT` que nadie recupera. Hoy no hay ningún recordatorio, y
—más grave— **el comprador no tiene forma de reanudar el pago**: la página
`mis-pedidos` solo muestra la etiqueta "Esperando pago", sin botón para pagar.
`createCheckoutSession` únicamente se invoca desde el carrito.

Este documento cubre la "Versión A" acordada: recuperar pagos pendientes usando
las órdenes que ya existen en la base de datos. **No** incluye persistir el
carrito en servidor (abandono de carrito "puro", antes del checkout), que sería
un cambio mucho más invasivo sobre `CartContext.tsx`.

## Contexto del código actual

Hallazgos de la exploración previa que sustentan el diseño:

- `createOrder` **no descuenta inventario** al crear la orden; el descuento
  ocurre después, en el cambio de estado (`src/app/actions/orders.ts:332`). Las
  órdenes abandonadas no retienen stock, así que esto es recuperación de ventas,
  no limpieza de inventario.
- El comprador **ya recibe** un correo al crear la orden (`sendNewOrderToBuyer`,
  `src/app/actions/orders.ts:184`), aunque no haya pagado. El recordatorio es un
  segundo contacto, no el primero.
- `createCheckoutSession` (`src/app/actions/stripe.ts:20`) **ignora por completo**
  los parámetros `items` y `total`: reconstruye los line items, el envío y los
  descuentos desde la base de datos usando solo `orderIds`, y ya valida que las
  órdenes pertenezcan al comprador (`buyerId: user.id`, línea 33). Reanudar un
  pago es llamarla con la orden existente; no hace falta lógica nueva de Stripe.
- Un checkout puede generar **varias órdenes** (una por vendedor), todas con el
  mismo `payment_intent`.
- No existe ningún campo de consentimiento de marketing ni mecanismo de baja.
- El proyecto **no tiene carpeta `prisma/migrations/`**: los cambios de esquema
  se aplican con `prisma db push`.

## Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Destino del link del correo | Botón "Pagar" nuevo en `mis-pedidos` | Es el único destino donde el comprador realmente puede completar la compra. Un link al carrito falla si abre el correo en otro dispositivo, porque el carrito vive en `localStorage`. |
| Cadencia | Un solo recordatorio, ~4 h después | Suficiente separación del correo inicial para no parecer spam; lo bastante pronto para que la intención de compra siga viva. |
| Consentimiento | Se agrega el campo, no filtra nada aún | El recordatorio es **transaccional** (trata de un pedido que el propio comprador inició), no marketing. Filtrarlo por opt-in anularía la función. El campo queda listo para campañas futuras. |

## Diseño

### 1. Esquema (2 campos aditivos)

```prisma
model User {
  marketingConsent Boolean @default(false)
}

model Order {
  paymentReminderSentAt DateTime?
}
```

Ambos son aditivos con default o nullables, así que ninguna consulta existente
se rompe y `prisma db push` los aplica sin pérdida de datos.

`paymentReminderSentAt` es el registro de "ya se envió", indispensable para que
el cron no reenvíe el mismo recordatorio en cada corrida.

### 2. Reanudar el pago

**`src/app/actions/stripe.ts`** — volver `items` y `total` opcionales en la firma
de `createCheckoutSession`. Ya se ignoran dentro de la función, así que es un
cambio de tipos sin efecto en el comportamiento; el carrito los sigue enviando y
no se entera.

**`src/app/(marketplace)/mis-pedidos/page.tsx`** — botón "Pagar" en las órdenes
con estado `PENDING_PAYMENT`, siguiendo el mismo patrón del botón "confirmar
entrega" que ya vive en ese archivo (estado local de carga + `toast` + recarga).
Llama a `createCheckoutSession({ orderIds: [order.id] })` y redirige a la URL
devuelta.

La validación de pertenencia ya ocurre dentro de `createCheckoutSession`, así
que no se abre ninguna superficie de autorización nueva.

### 3. Cron de recordatorio

**`src/app/api/cron/abandoned-payment/route.ts`** — misma forma que
`low-stock-digest`: handler `GET`, protegido comparando `?secret=` contra
`process.env.CRON_SECRET`.

Consulta:

```
status: 'PENDING_PAYMENT'
createdAt <= (ahora - 4 h)    // ya pasó el tiempo de gracia
createdAt >= (ahora - 48 h)   // pero no es una orden vieja del backlog
paymentReminderSentAt: null
```

La **ventana** (con piso de 48 h, no solo techo de 4 h) resuelve el problema del
backlog: en la primera corrida tras el despliegue, las órdenes viejas acumuladas
en `PENDING_PAYMENT` quedan fuera del rango y nadie recibe correos de pedidos de
hace meses.

Las órdenes se **agrupan por comprador**, porque un solo checkout genera una
orden por vendedor: el comprador recibe **un correo** que lista sus pedidos
pendientes, no uno por vendedor.

Tras enviar con éxito, se estampa `paymentReminderSentAt` en las órdenes
incluidas.

### 4. Plantilla de correo

**`src/lib/email/templates.ts`** — nueva función exportada
`sendPendingPaymentReminder`, con el `baseLayout` compartido y el mismo patrón
que las 12 plantillas existentes. La marca se resuelve por el `sourceDomain` de
la orden, igual que hacen las demás. CTA hacia `/mis-pedidos`.

### 5. Consentimiento de marketing

**`src/app/(marketplace)/register/buyer/BuyerRegistrationForm.tsx`** — casilla
opcional, desmarcada por defecto, con texto claro de a qué se está suscribiendo.

**`src/app/actions/auth.ts`** — guardar el valor al crear el usuario.

No se consume en ninguna consulta todavía. Es preparación para campañas futuras.

## Manejo de errores

El cron procesa cada comprador dentro de su propio `try/catch`: si un envío
falla, se registra en consola y el ciclo continúa con los demás.
`paymentReminderSentAt` se estampa **solo tras un envío exitoso**, para que un
fallo transitorio de Resend se reintente en la siguiente corrida en lugar de
perderse.

Todo el flujo es de solo lectura sobre `Order`/`User`, salvo el estampado del
campo nuevo.

## Qué NO se toca

- El webhook de Stripe (`src/app/api/webhooks/stripe/route.ts`)
- `createOrder` y el resto de `src/app/actions/orders.ts`
- El flujo del carrito (`src/app/(marketplace)/cart/page.tsx`, `CartContext.tsx`)
- Escrow (`src/app/actions/escrow.ts`)
- El cron de `low-stock-digest`

## Criterios de verificación

1. **Envío correcto:** crear una orden `PENDING_PAYMENT` con `createdAt` dentro
   de la ventana → correr el cron con el secret → se envía 1 correo y
   `paymentReminderSentAt` queda estampado.
2. **Sin duplicados:** correr el cron por segunda vez → 0 correos.
3. **Protección de backlog:** una orden con `createdAt` de hace 5 días no genera
   correo.
4. **Agrupación:** un comprador con 2 órdenes pendientes de 2 vendedores recibe
   1 correo con ambas, no 2 correos.
5. **Secret:** una petición sin `?secret=` correcto responde 401.
6. **Reanudar pago:** el botón "Pagar" en `mis-pedidos` abre Stripe con el monto
   correcto, incluyendo envío y descuentos.
7. **Sin regresión:** el checkout normal desde el carrito sigue funcionando y el
   cron de `low-stock-digest` no se ve afectado.

## Puntos abiertos

- **Agendado del cron:** no hay `vercel.json` ni configuración de cron en el
  repo, así que `low-stock-digest` se dispara desde fuera (crontab del VPS o un
  servicio externo). Hay que averiguar cuál es antes de agendar el nuevo endpoint
  de la misma forma. Esto se resuelve durante la implementación, revisando el
  servidor.

## Detalles menores aceptados

- Al reanudar el pago desde `mis-pedidos`, si el comprador cancela en Stripe,
  el `cancel_url` lo devuelve a `/cart` en vez de a `/mis-pedidos`. Es una
  rareza inofensiva; se deja así para no tocar el flujo compartido del carrito.
