# Puntos de lealtad: ganarlos al entregar, no al pedir

**Fecha:** 2026-08-12
**Estado:** Diseño aprobado, pendiente de plan de implementación

## Problema

En las compras en línea, los puntos de lealtad se otorgan dentro de `createOrder`,
es decir **al crear el pedido, antes de que el comprador pague**. Ningún camino
posterior los revierte. De ahí salen tres huecos:

1. **Pedido nunca pagado, puntos otorgados.** El carrito crea las órdenes en
   `PENDING_PAYMENT` (`cart/page.tsx:368`); los puntos se dan igual.
2. **Cancelar no anula nada.** `updateOrderStatus` (`src/app/actions/orders.ts:292`)
   no toca lealtad; lo único que hace con inventario es descontar al aceptar.
3. **Borrar deja puntos huérfanos.** `deleteOrder` (`orders.ts:400`) hace
   `prisma.order.delete` sin revertir los `LoyaltyTransaction` que apuntan a esa
   orden.

### Evidencia en producción (2026-08-12)

| Estado del pedido | Movimientos de puntos ligados | Observación |
|---|---|---|
| `COMPLETED` | 1 | correcto |
| `CANCELLED` | 7 | nunca revertidos |
| pedido borrado | 15 | huérfanos |
| `PENDING_PAYMENT` | 1 (336 pts, saldo vivo) | nunca pagó |

Además hay **17 movimientos `ADJUST` que suman −3,350 puntos**, todos del
2026-08-03 con el motivo `"N"`: el vendedor ya venía corrigiendo esto a mano. Por
eso casi todas las cuentas afectadas están hoy en cero. El único saldo vivo mal
otorgado es el de 336 puntos.

## Lo que YA funciona y no se toca

Verificado antes de diseñar; no forma parte del alcance:

- **Ventas del punto de venta.** `deleteSale` (`products/new/actions.ts:956`)
  revierte los puntos antes de marcar la venta `CANCELLED`. La convención de
  signos es correcta: `earnPoints` guarda `points` positivo y `redeemPoints`
  guarda `points: -points` (`src/lib/loyalty.ts:109,149`), así que la resta
  `balance - ltxn.points` quita lo ganado **y devuelve lo canjeado**.
- **Aislamiento por vendedor.** `LoyaltyAccount` es única por
  `@@unique([sellerId, buyerId])`; el carrito aplica los puntos por tienda
  (`loyaltyApplied` es un `Record<sellerId, points>`, `cart/page.tsx:379`) y
  `redeemPoints` valida en servidor que el saldo de **ese** vendedor alcance
  (`loyalty.ts:141`). Un comprador no puede pagarle a la tienda B con puntos de
  la tienda A.
- Las tasas del programa (`earnRate`, `redeemRate`, `minRedeemPoints`) y el resto
  de la pantalla del Programa de Puntos.

## Estados de pedido relevantes

| Estado | Etiqueta que ve el vendedor | ¿Pagado? | ¿Entregado? |
|---|---|---|---|
| `PENDING_PAYMENT` | Pago Pendiente | no | no |
| `PENDING` | Pendiente | no confirmado | no |
| `PAID` | — (lo pone el webhook de Stripe) | sí | no |
| `ACCEPTED` | Aceptado | sí | no |
| `SHIPPED` | Enviado | sí | no |
| `COMPLETED` | **Entregado** | sí | **sí** |
| `CANCELLED` / `REJECTED` | Cancelado / Rechazado | — | no |
| `REFUNDED` | Devuelto | — | se deshizo |

`COMPLETED` es el estado que pone el botón "📦 Marcar como Entregado"
(`orders/OrdersClient.tsx:654`).

## Diseño

### 1. Los puntos se ganan al entregar

Se **quita** la llamada a `earnPoints` de `createOrder` y se **agrega** en
`updateOrderStatus`, en la transición a `COMPLETED`.

Monto base: `order.total - order.shippingCost`. Es exactamente el `finalTotal`
que hoy se usa, porque `createOrder` guarda `total: finalTotal + shippingCost`
(`orders.ts:133`). **No cambia cuántos puntos gana la gente, solo cuándo.**

**Idempotencia:** antes de otorgar, se verifica que no exista ya un
`LoyaltyTransaction` de tipo `EARN` con ese `orderId`. Un pedido que pase dos
veces por `COMPLETED` no otorga dos veces.

### 2. Los puntos canjeados se siguen gastando al comprar

`redeemPoints` se queda en `createOrder`: el descuento afecta el precio que el
comprador paga, así que no puede diferirse.

Lo nuevo es la devolución: al pasar un pedido a `CANCELLED`, `REJECTED` o
`REFUNDED`, se revierten **todos** los `LoyaltyTransaction` de ese `orderId`
—los `EARN` restando y los `REDEEM` devolviendo— con la misma aritmética que ya
usa `deleteSale`: `balance - txn.points`, y se borran los movimientos.

Consecuencia por estado:

- Cancelado **antes** de entregar: no hay `EARN` que quitar (nunca se otorgó); se
  le devuelven los puntos que gastó.
- `REFUNDED` **después** de entregar: se le quita lo ganado y se le devuelve lo
  gastado.

**Idempotencia:** la reversión borra los movimientos, así que repetirla no hace
nada la segunda vez.

### 3. Borrar un pedido revierte primero

`deleteOrder` ejecuta la misma reversión antes del `order.delete`. Como solo
permite borrar pedidos ya `CANCELLED`/`REJECTED`, en la práctica no habrá nada
que revertir, pero cierra la puerta a dejar huérfanos.

### 4. El comprador ve sus puntos "por confirmar"

En `Mis Puntos` (`(marketplace)/mis-puntos/`), cada tienda muestra dos números:

```
Kalexa fashion
  Disponibles      1,240 pts
  Por confirmar      336 pts     ← de 2 pedidos en camino
```

**Los puntos por confirmar NO se guardan.** Se calculan al vuelo sumando
`mxnToPoints(order.total - order.shippingCost, earnRate)` sobre los pedidos de
ese comprador y ese vendedor con estado `PAID`, `ACCEPTED` o `SHIPPED`.

Esta es la propiedad de seguridad del diseño: como nunca entran a
`LoyaltyAccount.balance`, el comprador **no puede gastarlos** aunque los vea, sin
necesidad de candados adicionales en el carrito ni en `redeemPoints`. `PENDING` y
`PENDING_PAYMENT` quedan fuera porque no hay pago confirmado.

Si un vendedor no tiene programa activo o su `earnRate` es 0, su bloque de "por
confirmar" no se muestra.

### 5. Corrección del saldo vivo mal otorgado

Los 336 puntos de la cuenta ligada al pedido en `PENDING_PAYMENT` se restan con
un `ADJUST` cuyo `reason` explique el motivo, mediante la función `adjustPoints`
que ya existe (`loyalty.ts:167`). Se hace con un script de un solo uso ejecutado
en el servidor, no con código de la aplicación.

Los movimientos históricos huérfanos (los 15 de pedidos borrados y los 7 de
cancelados) **no se tocan**: sus cuentas ya están en cero por los ajustes
manuales del vendedor, y borrarlos reescribiría un historial que él ya concilió.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/lib/loyalty.ts` | nueva función de reversión por `orderId`, y cálculo de puntos por confirmar |
| `src/app/actions/orders.ts` | quitar `earnPoints` de `createOrder`; otorgar en `updateOrderStatus` al pasar a `COMPLETED`; revertir en `CANCELLED`/`REJECTED`/`REFUNDED`; revertir en `deleteOrder` |
| `src/app/actions/loyalty.ts` | `getMyLoyalty` devuelve además los puntos por confirmar por vendedor |
| `src/app/(marketplace)/mis-puntos/LoyaltyAccountClient.tsx` | mostrar "Por confirmar" |
| `scripts/corregir-puntos-336.mjs` (crear) | ajuste de un solo uso, se corre en el servidor |

`products/new/actions.ts` **no se modifica**: el punto de venta ya está correcto.

## Criterios de verificación

1. Un pedido nuevo que queda en "Esperando pago" **no** otorga puntos.
2. Al pagarlo, el comprador ve el monto en "Por confirmar" y su saldo disponible
   no cambia.
3. Los puntos "por confirmar" **no** se pueden usar en el carrito.
4. Al marcarlo "📦 Marcar como Entregado", los puntos pasan a disponibles y el
   monto coincide con el que se veía por confirmar.
5. Marcar dos veces como entregado no duplica los puntos.
6. Cancelar un pedido pagado y no entregado: desaparece de "por confirmar" y no
   se otorga nada.
7. Un comprador que gastó puntos en un pedido y ese pedido se cancela: recupera
   exactamente los puntos que gastó.
8. Marcar como "Devuelto" un pedido ya entregado: se le quitan los puntos que
   ganó por él.
9. Borrar un pedido cancelado no deja movimientos de puntos apuntando a él.
10. La cuenta con los 336 puntos queda en el saldo correcto, con el ajuste
    visible en su historial.
11. **No se rompió el mostrador:** cancelar una venta del punto de venta sigue
    revirtiendo puntos como hoy.
12. **No se rompió el aislamiento:** un comprador con puntos en dos tiendas sigue
    sin poder usar los de una en la otra.
