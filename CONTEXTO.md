# CONTEXTO DEL PROYECTO — MODAZAPO
> Archivo de contexto para sesiones de IA. Al iniciar una sesión nueva, comparte este archivo para retomar donde se dejó.

---

## 1. ¿Qué es el proyecto?

**Modazapo** es un marketplace mayorista de moda, inspirado en [fashiongo.net](https://fashiongo.net), con un diferenciador clave: incluye un **Punto de Venta (POS) multilocación** integrado que sincroniza inventario en tiempo real entre todas las sucursales y el marketplace online.

### Características principales ya construidas:
- Marketplace B2B (comprador/vendedor) con catálogo, wishlist, pedidos, mensajería interna
- Seller Center completo: productos, inventario, categorías, marcas, proveedores, etiquetas
- POS muy completo: ventas, devoluciones, apartados (layaway), ventas suspendidas, traspasos entre sucursales, corte Z, sesiones de caja, pagos parciales, niveles de precio, descuentos manuales, impresión de tickets térmicos 80mm, integración WhatsApp para cotizaciones
- Sistema de roles RBAC: ADMIN, MANAGER, CASHIER, BUYER, SELLER
- Multi-marca: soporta `modazapotlanejo.com` y `zonadelvestir.com` desde el mismo codebase
- Registro de compradores (retail y mayoreo) y vendedores con flujo de aprobación por admin
- Dashboard del vendedor (básico)
- CRM básico de clientes con crédito de tienda
- Reportes básicos
- Servicio de fotografía (VAS)
- Recuperación de contraseña por email

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Frontend | React 19, Tailwind CSS 4 |
| Lenguaje | TypeScript 5 |
| ORM | Prisma 6.19.2 |
| Base de datos | PostgreSQL via Supabase |
| Emails | Resend 6.9.3 |
| UI Components | Headless UI 2.2.9 |
| Auth | Sesiones custom con cookies httpOnly (SHA-256) |
| Deploy | Vercel (configurado, aún no en producción) |

---

## 3. Estructura del proyecto

```
modazapo/
├── prisma/
│   └── schema.prisma          ← 28 modelos de BD
├── src/
│   ├── app/
│   │   ├── (marketplace)/     ← Rutas públicas del marketplace
│   │   │   ├── page.tsx       ← Landing page
│   │   │   ├── catalog/       ← Catálogo de productos
│   │   │   ├── cart/          ← Carrito
│   │   │   ├── wishlist/      ← Lista de deseos
│   │   │   ├── vendors/       ← Directorio de vendedores
│   │   │   ├── register/      ← Registro buyer/seller
│   │   │   └── admin/         ← Panel admin (aplicaciones, costos)
│   │   ├── (seller-center)/   ← Rutas del panel del vendedor
│   │   │   ├── dashboard/     ← Dashboard
│   │   │   ├── pos/           ← Punto de Venta (~1400 líneas)
│   │   │   ├── inventory/     ← Inventario
│   │   │   ├── products/      ← CRUD de productos
│   │   │   ├── orders/        ← Pedidos del marketplace
│   │   │   ├── clients/       ← CRM de clientes
│   │   │   ├── messages/      ← Mensajería interna
│   │   │   ├── reports/       ← Reportes
│   │   │   └── settings/      ← Configuración (perfil, sucursales, métodos de pago, niveles de precio)
│   │   ├── actions/           ← Server Actions globales
│   │   │   ├── auth.ts        ← Login, registro, sesión
│   │   │   ├── orders.ts      ← Pedidos del marketplace
│   │   │   ├── admin.ts       ← Gestión de vendedores
│   │   │   ├── messages.ts    ← Mensajería
│   │   │   └── wishlist.ts    ← Wishlist
│   │   ├── api/
│   │   │   └── orders/        ← API routes para aceptar/rechazar pedidos
│   │   ├── login/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── components/
│   │   └── RecentlyViewed.tsx
│   ├── lib/
│   │   ├── prisma.ts          ← Cliente de Prisma (singleton)
│   │   ├── brand.ts           ← Configuración multi-marca
│   │   ├── CartContext.tsx    ← Contexto del carrito
│   │   ├── RecentlyViewedContext.tsx
│   │   └── email/
│   │       ├── resend.ts      ← Función base sendEmail()
│   │       └── templates.ts   ← ⭐ NUEVO en Paso 1
│   └── generated/
│       └── client/            ← Cliente generado por Prisma
└── public/
    └── images/                ← Hero, categorías, logos
```

---

## 4. Variables de entorno (.env)

```env
DATABASE_URL="postgresql://postgres.ynbcslgimrrccqohirzl:***@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=30&sslmode=require"
DIRECT_URL="postgresql://postgres.ynbcslgimrrccqohirzl:***@aws-1-us-east-2.pooler.supabase.com:5432/postgres?connect_timeout=30&sslmode=require"
RESEND_API_KEY=***
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Pendientes de agregar (Paso 2):
# NEXT_PUBLIC_SUPABASE_URL=https://ynbcslgimrrccqohirzl.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=*** (obtener de Supabase Dashboard > Settings > API)
```

**Supabase Project ID:** `ynbcslgimrrccqohirzl`
**Supabase Region:** AWS us-east-2

---

## 5. Modelos principales de la base de datos (Prisma)

| Modelo | Descripción |
|---|---|
| `User` | Usuarios con roles (ADMIN, MANAGER, CASHIER, BUYER, SELLER) |
| `StoreLocation` | Sucursales/puntos de venta |
| `StoreSettings` | Configuración global de la tienda |
| `Product` | Productos con variantes, precios retail/mayoreo, costo |
| `Variant` | Variantes de producto (color, talla, atributos dinámicos) |
| `InventoryLevel` | Stock por variante POR sucursal (clave para multilocación) |
| `InventoryMovement` | Historial de movimientos de inventario |
| `Category` / `Subcategory` | Categorías del catálogo |
| `Brand` | Marcas (por vendedor) |
| `Supplier` | Proveedores (por vendedor) |
| `Tag` | Etiquetas de productos |
| `Sale` | Ventas del POS (incluye apartados, devoluciones, suspendidas) |
| `SaleItem` | Items de cada venta |
| `LayawayPayment` | Pagos parciales de apartados |
| `CashRegisterSession` | Sesiones de caja (corte Z) |
| `CashMovement` | Entradas/salidas manuales de efectivo |
| `Order` | Pedidos del marketplace (buyer → seller) |
| `OrderItem` | Items de cada pedido |
| `Client` | Clientes del POS con crédito de tienda |
| `StoreAccountPayment` | Abonos y cargos a cuenta de clientes |
| `PriceTier` | Niveles de precio (mayoreo, menudeo, custom) |
| `PaymentMethod` | Métodos de pago configurables |
| `Message` | Mensajería interna entre usuarios |
| `Wishlist` | Lista de deseos |
| `SellerApplication` | Solicitudes de registro de vendedores |
| `PhotographyRequest` | Solicitudes de servicio de fotografía |
| `Settlement` | Liquidaciones de comisiones (admin → seller) |
| `MarketplaceSettings` | Configuración global del sitio (landing, destacados) |

---

## 6. Roadmap de mejoras — Estado actual

| # | Mejora | Estado | Notas |
|---|---|---|---|
| 1 | Notificaciones y emails transaccionales | ✅ **COMPLETADO** | Ver detalle abajo |
| 2 | Sincronización de inventario en tiempo real | ✅ **COMPLETADO** | Polling cada 5s, funciona sin WebSockets |
| 3 | Búsqueda avanzada, filtros y mayoreo | ✅ **COMPLETADO** | Full-text, paginación, niveles de precio, corridas/paquetes/cajas |
| 4 | Pasarela de pagos online | ✅ **COMPLETADO** | Stripe Checkout & Webhook |
| 5 | Gestión de envíos y logística | ✅ **COMPLETADO** | Skydropx API integrada |
| 6 | Comisiones y liquidaciones a vendedores | ✅ **COMPLETADO** | Flujo admin → seller |
| 7 | Dashboard del vendedor con métricas reales | ✅ **COMPLETADO** | Integración con Recharts |
| 8 | Aislamiento y Configuración Global | ✅ **COMPLETADO** | Nueva admin dashboard |

---

## 7. Detalle del Paso 1 — Emails completado

### Archivos creados/modificados:

**NUEVO:** `src/lib/email/templates.ts`
Contiene 7 funciones de email con plantillas HTML profesionales:
- `sendNewOrderToSeller()` — cuando comprador hace un pedido
- `sendOrderConfirmedToBuyer()` — cuando vendedor acepta pedido
- `sendOrderRejectedToBuyer()` — cuando vendedor rechaza pedido
- `sendWelcomeToBuyer()` — al registrarse como comprador
- `sendWelcomeToSeller()` — al ser aprobado como vendedor
- `sendLowInventoryAlert()` — stock ≤ 5 piezas (listo, falta trigger)
- `sendLayawayExpiringAlert()` — apartado vence en 24h (listo, falta trigger)

**MODIFICADO:** `src/app/actions/orders.ts`
- Completado el `// TODO` de notificación al vendedor en `createOrder()`
- Agregados emails de confirmación/rechazo en `updateOrderStatus()`

**MODIFICADO:** `src/app/actions/auth.ts`
- Agregado `sendWelcomeToBuyer()` al registrar comprador en `registerBuyer()`

**MODIFICADO:** `src/app/(marketplace)/admin/applications/actions.ts`
- Reemplazado email inline de bienvenida al vendedor con `sendWelcomeToSeller()` de la nueva plantilla

### Emails conectados en Paso 4:
- `sendLowInventoryAlert()` — CONECTADO: se dispara cuando el stock baja a 5 en POS o Marketplace.
- `sendLayawayExpiringAlert()` — conectar con un cron job o verificación diaria

---

## 8. Decisiones técnicas importantes

- **Prisma es el único que escribe en BD.** Supabase Realtime (Paso 2) solo lee eventos, nunca escribe.
- **Los emails son async y no bloquean respuestas.** Se disparan con `.catch(console.error)` para no romper el flujo si Resend falla.
- **Multi-marca por dominio.** `getBrandConfig(host)` en `brand.ts` detecta el dominio y devuelve la configuración correcta.
- **Auth custom con SHA-256.** No usa NextAuth ni Supabase Auth — las sesiones son cookies httpOnly con el userId.
- **El POS usa `sonner` para notificaciones.** Reemplazados los `alert()` nativos por toasts elegantes.
- **`pos/page.tsx` tiene ~2300 líneas.** Pendiente refactorizar en componentes más pequeños (mejora futura).
- **`any` en TypeScript** en varios lugares del POS y catálogo. Pendiente tipar correctamente (mejora futura).

---

## 9. Convención de trabajo acordada

- **Antes de crear, mover o modificar cualquier archivo, explicar el plan y pedir aprobación.**
- Entregar un `.zip` después de cada paso completado, con la carpeta nombrada `modazapo_paso{N}`.
- La estructura del zip debe ser: `modazapo_paso{N}.zip` → `modazapo{N}/` → archivos del proyecto (sin `node_modules`, `.next`, `dist`, `.git`).
- Servicios externos seleccionados: **Stripe** (pagos), **Supabase Realtime** (sync), **Skydropx** (envíos México).
- El proyecto corre actualmente solo en **localhost** (no desplegado en producción).

---

## 10. Cómo usar este archivo en una sesión nueva

1. Abre una sesión nueva con Claude
2. Sube este archivo `CONTEXTO.md`
3. Escribe: *"Retoma el proyecto Modazapo desde donde lo dejamos. El contexto está en el archivo adjunto."*
4. Si vas a continuar con cambios de código, también sube el `.zip` del último paso completado.

---

---

## 11. Detalle del Paso 2 — Sincronización de inventario completado

### Archivos creados/modificados:

**NUEVO:** `src/components/InventoryRealtimeSync.tsx`
Componente que hace polling cada 5 segundos comparando el inventario actual con el anterior.
Si detecta cambios, actualiza la pantalla automáticamente sin recargar.
Muestra indicador visual: 🟡 Conectando → 🟢 En línea → 🔴 Sin sincronización.

**NUEVO:** `src/lib/supabase.ts`
Archivo placeholder conservado como referencia. El cliente de Supabase no se usa activamente
(se intentó WebSockets pero el plan gratuito de Supabase tiene limitaciones con RLS).

**MODIFICADO:** `.env`
Se agregaron:
- `NEXT_PUBLIC_SUPABASE_URL=https://ynbcslgimrrccqohirzl.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...` (anon public key)

**MODIFICADO:** `src/app/(seller-center)/inventory/page.tsx`
- Importa `InventoryRealtimeSync` y `useCallback`
- Agrega `handleInventoryChange` que actualiza el stock en el estado local
- Reemplaza el indicador estático por el componente dinámico

**MODIFICADO:** `src/app/(seller-center)/pos/page.tsx`
- Importa `InventoryRealtimeSync`
- Agrega handler de cambios que actualiza stock en resultados de búsqueda,
  productos por categoría y modal de variantes abierto

### Notas técnicas:
- Se intentó Supabase Realtime (WebSockets) pero genera CHANNEL_ERROR con RLS en plan gratuito
- Solución final: polling cada 5 segundos usando Server Actions existentes
- Las tablas `InventoryLevel` y `Variant` están en la publicación `supabase_realtime` (configurado)
- RLS policies creadas: `Authenticated can read InventoryLevel` y `Authenticated can read Variant`

---

---

## 12. Detalle del Paso 3 — Búsqueda avanzada, filtros y mayoreo

### Archivos creados/modificados:

**MODIFICADO:** `src/app/(marketplace)/actions.ts`
- `getProducts()` mejorado: búsqueda en marca/categoría/etiquetas, filtro de stock, filtro mayoreo/menudeo, paginación 24/página, retorna `{products, total, pageSize}`
- `getLatestProducts()` y `getNewArrivals()` actualizados para nuevo formato
- `getMarketplacePriceTiers(sellerId)` — niveles de precio activos para marketplace

**NUEVO:** `src/lib/discountUtils.ts`
- `calculateAutoDiscount()` — calcula descuento automático por volumen
- Solo aplica niveles con `autoApplyMarketplace = true`
- No aplica si hay items de Corrida/Paquete/Caja (mayoreo)

**MODIFICADO:** `src/app/(marketplace)/catalog/CatalogClient.tsx`
- Checkbox "Solo con stock disponible"
- Filtro tipo de precio (Todos/Mayoreo/Menudeo)
- Botón "Limpiar filtros"
- Paginación
- Badge "Mayoreo" y overlay "Sin stock" en tarjetas

**MODIFICADO:** `src/app/(marketplace)/catalog/[id]/ProductDetailClient.tsx`
- Tallas ordenadas numéricamente con selector `+/-` por talla
- Selección múltiple de tallas al carrito de una sola vez
- Opciones de mayoreo (Corrida/Paquete/Caja) solo para `isWholesale = true`
- Verificación de stock antes de agregar corrida al carrito
- Descuento automático por volumen visible en tiempo real
- Acordeones colapsables (Descripción, Info corrida, Vendedor)

**MODIFICADO:** `src/app/(marketplace)/cart/page.tsx`
- Descuento automático por volumen aplicado por vendedor
- Banner verde con ahorro cuando aplica descuento
- Banner azul "Agrega X piezas más para obtener -Y%" cuando falta para siguiente nivel
- Precio unitario con descuento a la derecha de cada item
- Botón "Vaciar carrito" en encabezado
- Badge del carrito sin límite de 9+

**MODIFICADO:** `src/app/(seller-center)/settings/price-tiers/page.tsx`
- 3 controles por nivel: 🌐 Marketplace auto / 🖥️ POS auto / 🧾 POS manual
- Campo "Mínimo de piezas para activar"

**MODIFICADO:** `prisma/schema.prisma`
- `PriceTier`: +`minQuantity`, +`autoApplyMarketplace`, +`autoApplyPOS`, +`manualPOS`
- `Order`: +`discount`, +`priceTierId`

**IMPORTANTE:** Correr en Supabase SQL Editor para activar niveles existentes:
```sql
UPDATE "PriceTier" SET "autoApplyMarketplace" = true, "manualPOS" = true WHERE "autoApplyMarketplace" IS NULL;
```

---

## 13. Detalle del Paso 4 — Pasarela de pagos y Alertas de Stock

### Archivos creados/modificados:

**NUEVO:** `src/app/actions/stripe.ts`
- `createCheckoutSession()`: Crea sesiones de Stripe para el carrito.
- Redirección automática a Stripe desde el marketplace.

**NUEVO:** `src/app/api/webhooks/stripe/route.ts`
- Webhook que escucha `checkout.session.completed`.
- Actualiza el estado del pedido a `PAID` automáticamente.

**MODIFICADO:** `src/app/actions/orders.ts`
- Agregada lógica de descuento de inventario al aceptar pedidos (`status === 'ACCEPTED'`).
- Conectado el trigger de `sendLowInventoryAlert()` para el marketplace.

**MODIFICADO:** `src/app/(seller-center)/products/new/actions.ts`
- Conectado el trigger de `sendLowInventoryAlert()` en `processSale()` para el POS.

**MODIFICADO:** `src/app/(seller-center)/pos/page.tsx`
- **Modernización:** Reemplazados todos los `alert()` nativos por `toast` de la librería `sonner`.
- Experiencia de usuario más fluída y no bloqueante.

**MODIFICADO:** `src/lib/stripe.ts`
- Inicialización del cliente de Stripe con `STRIPE_SECRET_KEY`.

### Notas técnicas:
- El descuento de stock en el marketplace ahora solo ocurre cuando el vendedor **acepta** el pedido, evitando "apartar" stock de pedidos que podrían ser rechazados.
- Las alertas de stock bajo se agrupan por venta/pedido para no saturar al vendedor con múltiples correos.
- Se requiere configurar `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` y `STRIPE_WEBHOOK_SECRET` en el entorno.

---

*Última actualización: Paso 8 completado — Aislamiento de datos, Sidebar persistente y Configuración Web*

---

## 14. Detalle del Paso 5 — Gestión de envíos con Skydropx

### Archivos creados/modificados:
**MODIFICADO:** `src/app/actions/shipping.ts`
- `quoteShipping()`: Obtiene cotizaciones reales de Skydropx basadas en origen (Zapotlanejo/Sucursal) y destino (Comprador).
- `createShipmentLabel()`: Genera la guía PDF, descuenta el costo y notifica al comprador.
- `getShipmentStatus()`: Rastreo en tiempo real consultando la API de la paquetería.

**NUEVO:** `src/lib/skydropx.ts`
- Cliente base para interactuar con la API REST de Skydropx (Quotes, Shipments, Tracking).

---

## 15. Detalle del Paso 6 — Comisiones y Liquidaciones

### Archivos creados/modificados:
**MODIFICADO:** `prisma/schema.prisma`
- Agregado modelo `Settlement`: Registra pagos del administrador a los fabricantes.
- Campos en `Order`: `commissionAmount`, `sellerEarnings` para cálculo automático.

**NUEVO:** `src/app/actions/settlements.ts`
- `getPendingSettlements()`: Agrupa órdenes completadas por vendedor para pago masivo.
- `createSettlement()`: Genera el registro de liquidación y marca las órdenes como pagadas.

**NUEVO:** `src/app/(seller-center)/admin/settlements/`
- Interfaz para que el administrador revise y procese pagos a fabricantes.

---

## 16. Detalle del Paso 7 — Dashboard con Recharts

### Archivos creados/modificados:
**NUEVO:** `src/app/(seller-center)/dashboard/OverviewCharts.tsx`
- Gráfica de Ventas (AreaChart) con comparativa de ingresos brutos vs netos.
- Distribución por Categorías (PieChart).
- Tabla de Top Productos más vendidos.

**MODIFICADO:** `src/app/(seller-center)/dashboard/actions.ts`
- `getDashboardStats()`: Ahora retorna datos históricos formateados para Recharts.
- Cálculo de "Ventas Brutas" vs "Ganancias Netas" (descontando comisiones).

---

## 17. Detalle del Paso 8 — Aislamiento y Configuración Web

### Archivos creados/modificados:
**MODIFICADO:** `prisma/schema.prisma`
- `StoreSettings`: Ahora incluye `sellerId @unique` para que cada fabricante tenga su propia configuración de tickets/sucursal.
- `MarketplaceSettings`: Nuevo modelo para el control global del administrador.

**MODIFICADO:** `src/app/(seller-center)/SidebarLayout.tsx`
- Refinado para mostrar/ocultar menús según el rol (`ADMIN` vs `SELLER`).
- Los administradores ahora ven herramientas de gestión global y los vendedores sus herramientas operativas.

**NUEVO:** `src/app/(seller-center)/admin/marketplace/`
- Panel para que el administrador configure el título del sitio, imagen de fondo de la landing y productos/vendedores destacados.

---

### Próximo objetivo sugerido: Optimización de carga y refactorización del POS
