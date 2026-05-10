# CONTEXTO COMPLETO — PROYECTO MODAZAPO
*Actualizado el 02/05/2026 — búsqueda sin acentos, etiquetas Code 128, sincronización inventario, orden tallas, cambio POS*

---

## INFORMACIÓN DEL DESARROLLADOR
- **Nombre:** Juan Carlos De la Torre
- **Rol:** Dueño y desarrollador del proyecto (no programador)
- **Email:** jcarlosdlt@gmail.com
- **Ubicación:** Guadalajara, Jalisco, México

---

## INFRAESTRUCTURA DEL SERVIDOR

### VPS Hostinger
- **IP:** 187.124.158.239
- **OS:** AlmaLinux 9.7
- **Usuario SSH:** root
- **Servidor Web:** OpenLiteSpeed
- **Process Manager:** PM2
- **Nombre servidor:** srv1491301.hstgr.cloud

### Acceso SSH
```bash
ssh root@187.124.158.239
# Password: ver SECRETOS.md (no incluido en git)
```

### Base de Datos PostgreSQL
```bash
PGPASSWORD='[ver SECRETOS.md]' psql -h 187.124.158.239 -U modazapo -d modazapo
```
- **Host:** 187.124.158.239
- **Usuario:** modazapo
- **Password:** ver SECRETOS.md (no incluido en git) — rotada el 13/04/2026
- **Database:** modazapo

### Rutas importantes en el servidor
- **Código fuente:** `/var/www/modazapo/src`
- **Archivo .env:** `/var/www/modazapo/.env`
- **Uploads:** `/var/www/modazapo/uploads` (UPLOAD_DIR=/var/www/modazapo/uploads)

---

## PROYECTO

### Stack Tecnológico
- **Framework:** Next.js 16 (Turbopack)
- **ORM:** Prisma
- **Base de datos:** PostgreSQL
- **Servidor web:** OpenLiteSpeed
- **Process Manager:** PM2
- **SSL:** acme.sh
- **Email:** Resend (RESEND_API_KEY configurada en .env)
- **DNS:** donweb.com (modazapotlanejo.com, zonadelvestir.com)

### Comando de rebuild (SIEMPRE usar este)
```bash
cd /var/www/modazapo && npm run build && pm2 restart modazapo
```

### Reiniciar sin rebuild (solo para cambios en .env)
```bash
pm2 restart modazapo
```

### Ver logs
```bash
pm2 logs modazapo --lines 50 --nostream | tail -30
```

---

## DOMINIOS Y CONFIGURACIÓN

| Dominio | Tipo | Estado |
|---------|------|--------|
| modazapotlanejo.com | Marketplace principal | Activo |
| zonadelvestir.com | Marketplace secundario | Activo |
| kalexa.modazapotlanejo.com | Mirror Kalexa Fashion | Activo |
| kalexafashion.com | Tienda Kalexa (Migrado de WP) | Activo |
| pos.kalexafashion.com | POS Kalexa | Activo |

### Archivos de configuración OLS
- **Vhosts:** `/usr/local/lsws/conf/vhosts/`
- **Config global:** `/usr/local/lsws/conf/httpd_config.conf`
- **Reiniciar OLS:** `/usr/local/lsws/bin/lswsctrl restart`
- **Certificados:** `/root/.acme.sh/` y `/etc/letsencrypt/live/`

---

## VENDEDORES ACTUALES

| Vendedor | Email | Dominio |
|----------|-------|---------|
| Kalexa fashion | kalexa.fashion@gmail.com | modazapotlanejo.com, kalexafashion.com |
| SORRENTOSHOPMX | Sorrentoshop944@gmail.com | modazapotlanejo.com |

---

## ARCHIVOS CLAVE DEL CÓDIGO

| Archivo | Descripción |
|---------|-------------|
| `src/lib/brand.ts` | Branding por dominio (colores, logo, nombre, isSingleVendor) |
| `src/proxy.ts` | Limpia headers duplicados de OLS, rutas públicas (MANDATORIO agregar nuevas rutas aquí) |
| `next.config.ts` | Config Next.js (unoptimized, allowedOrigins) |
| `src/lib/email/templates.ts` | Plantillas de correo |
| `src/lib/email/resend.ts` | Configuración Resend y remitente por dominio |
| `src/app/actions/orders.ts` | Creación de pedidos y correos |
| `src/app/actions/marketplace.ts` | Configuración del marketplace |
| `src/app/actions/auth.ts` | Autenticación |
| `src/lib/posOfflineStore.ts` | Caché offline del POS (IndexedDB) |
| `src/lib/skydropx.ts` | Cliente API Skydropx: cotizaciones, guías, tracking. Tiene fallback a datos mock |
| `src/app/actions/shipping.ts` | Server actions de envío: cotizar, crear guía, consultar estado |
| `src/app/(seller-center)/admin/marketplace/MarketplaceClient.tsx` | Panel admin de vendedores con comisión y mensualidad |
| `src/app/(seller-center)/admin/applications/actions.ts` | Aprobación de solicitudes de vendedor (pre-llena StoreSettings) |
| `src/app/(marketplace)/register/seller/SellerRegistrationForm.tsx` | Formulario de registro de vendedor |
| `src/app/(seller-center)/reports/actions.ts` | Server actions de reportes: ventas, comisiones, Cortes Z, permisos |
| `src/app/(seller-center)/reports/page.tsx` | UI de reportes con tabs Ventas / Comisiones / Cortes Z |
| `src/app/(seller-center)/settings/team/actions.ts` | CRUD de cajeros (incluye `canViewCommissions`, `canViewZCuts`) |
| `src/app/(seller-center)/settings/team/page.tsx` | UI gestión de cajeros con permisos granulares |
| `src/app/not-found.tsx` | Redirige cualquier URL no encontrada (404) al home `/` |
| `public/logos/clip.svg` | Logo Clip México (64×64, #FC4C02) para POS |
| `public/logos/paypal.svg` | Logo PayPal/Zettle (64×64, #003087) para POS |
| `public/logos/ualabis.svg` | Logo Ualabis (64×64, #022A9A) para POS |

### Archivos de respaldo activos
- `prisma/schema.prisma.bak` — backup del schema antes de cambios recientes
- `src/app/(seller-center)/settings/general/page.tsx.bak` — backup de Tienda y Facturación

---

## REGLAS DE TRABAJO (MUY IMPORTANTES)

1. **Siempre hacer respaldo** antes de modificar:
   ```bash
   cp archivo.tsx archivo.tsx.bak
   # Usar .bak2, .bak3 para versiones adicionales
   ```

2. **Usar Python3 para modificar archivos** (NO bash heredocs):
   ```bash
   python3 - << 'EOF'
   path = '/var/www/modazapo/src/...'
   with open(path, 'r') as f:
       content = f.read()
   # modificaciones
   with open(path, 'w') as f:
       f.write(content)
   EOF
   ```

3. **Pedir autorización** antes de cualquier cambio

4. **Un problema a la vez**

5. **Reconstruir siempre** después de cambios en código

6. **Si algo se rompe** — restaurar el respaldo más reciente

7. **Juan Carlos NO es programador** — explicar todo en términos simples

---

## PROBLEMAS CONOCIDOS Y SOLUCIONES

### Error "Invalid URL" / "Invalid Server Actions request"
- **Causa:** OpenLiteSpeed inyecta header `X-Forwarded-Proto` duplicado con coma
- **Solución:** El `proxy.ts` limpia estos headers. Si una ruta nueva da este error, agregarla al matcher del proxy y a `allowedOrigins` en `next.config.ts`

### Stock desde sucursales
- Cuando existen registros en `InventoryLevel`, el stock se calcula desde ahí, no desde `Variant.stock`
- **IMPORTANTE:** Las ventas en POS decrementan `Variant.stock` Y `InventoryLevel` atómicamente (fix 02/05/2026). Si hay desync, usar la query de sincronización (ver historial de commits `50bf5d3`)

### Imágenes locales
- `unoptimized: true` en `next.config.ts` (ya aplicado)

### Skydropx — Credenciales incorrectas (pendiente resolver)
- **Situación:** La API Skydropx retorna `401 Bad credentials` con las credenciales actuales
- **Causa:** Las credenciales de `Configuración → Conexiones → API` son OAuth2 de aplicación (client_id + client_secret), NO el token directo que requiere `api.skydropx.com/v1`
- **Workaround activo:** Cuando la API devuelve 401/403, el código cae automáticamente a cotizaciones mock (FedEx/Estafeta/DHL con precios estimados) para que el carrito funcione
- **Solución permanente:** Obtener el token API correcto de Skydropx (contactar hola@skydropx.com o buscar en perfil personal de Skydropx un "Token de API" individual, diferente del key+secret de Conexiones)
- **Cuando se tenga el token correcto:** `sed -i 's/^SKYDROPX_API_KEY=.*/SKYDROPX_API_KEY=TOKEN_REAL/' /var/www/modazapo/.env && pm2 restart modazapo` (no necesita rebuild)

### Columnas extra en BD (inofensivas)
- La tabla `User` ahora tiene `requireCashSession`, `requireSalesperson`, `cashierCanDeleteSuspended` (añadidas en abril 2026 con `prisma db push`)
- La tabla `User` tiene `canViewCommissions` y `canViewZCuts` (añadidas el 14/04/2026)
- `StoreSettings` tiene `aiProvider`/`aiApiKey` en la BD del servidor (inofensivas)

### Seguridad — repositorio público
- El repo `zapirin/modazapotlanejo-mvp` en GitHub es **público**
- NUNCA poner contraseñas en CONTEXTO.md ni en ningún archivo rastreado por git
- Todas las credenciales van en `SECRETOS.md` (está en `.gitignore`)
- Los archivos `.bak` también están en `.gitignore`
- La contraseña de BD fue rotada el 13/04/2026 (la versión anterior quedó expuesta en historial de git)

---

## FUNCIONALIDADES IMPLEMENTADAS

### Marketplace
- **Visibilidad de precios configurable**: toggle en Admin → Marketplace para mostrar precios a todos o solo a usuarios logueados (uno por marketplace global y uno por marca/dominio). Agregar al carrito siempre requiere login. Configuración guardada en `MarketplaceSettings.showPricesPublicly` y `BrandConfig.showPricesPublicly`
- Catálogo público sin login requerido
- Niveles de precio por volumen (auto en marketplace y POS)
- Carrito con modos de mayoreo (Corrida/Paquete/Caja)
- Correos al vendedor y comprador al crear pedido con branding por dominio
- Badge de marca condicional (no muestra "Genérico")
- Generación de descripciones con IA (Anthropic/OpenAI/Gemini)
- Columnas Cat/Marca/Prov y Mayoreo en lista de productos
- Atributos Dinámicos: Eliminación de "0 colores" y soporte para cualquier atributo definido por el vendedor
- Centrado de categorías en Landing Page y sección de Categorías
- **Cupones de descuento** por vendedor en el carrito
- **Marcas sin productos ocultas**: el menú superior y el sidebar del catálogo solo muestran marcas con ≥1 producto activo/online (en los 3 dominios)
- **Filtros del catálogo (sidebar) colapsables**: Categorías, Marcas, Tallas, Colores y Etiquetas. Las tres últimas son chips que filtran por `?size=`, `?color=` y `?tag=`. Combinables entre sí.
- **Descuento por volumen aplicado al precio unitario** en pedidos: el descuento ya no se guarda solo a nivel de orden — se incrusta en el precio de cada `OrderItem` para que correos y dashboard muestren los precios reales cobrados.
- **Avisos del marketplace ocultos en single-vendor**: el banner del footer (Compra Protegida + Vendedores Verificados + Pagos 100% Seguros) y el cuadro verde de Compra Protegida en detalle de producto no aparecen cuando `brand.isSingleVendor` (kalexafashion.com).
- **Listón de anuncio por dominio** (`BrandConfig.announcementEnabled/Text/Mode`): franja superior fija en el marketplace. Cada dominio (modazapotlanejo, zonadelvestir, kalexa) tiene su propio mensaje y modo `'static'` (fijo) o `'marquee'` (deslizable derecha→izquierda). Animación CSS via clase `.announcement-marquee` y keyframe `marquee` en `globals.css` (25s linear, pausa al hover). Componente `AnnouncementBar.tsx`. Al estar visible empuja el navbar 32px abajo (`style top:32`) y el `<main>` pasa de `pt-28` a `pt-36`. Admin edita modazapotlanejo y zonadelvestir desde la pestaña **Sitio** (upsert vía `updateBrandConfig`); kalexa y futuras marcas desde la pestaña **Marcas**. Estas dos primeras se filtran fuera de la pestaña Marcas para evitar duplicación.
- **Listón de anuncio por vendedor** (`StoreSettings.announcementEnabled/Text/Mode`): cada vendedor configura su propio listón en **Configuración → Tienda y facturación → 📢 Listón de Anuncio** (UI con toggle, textarea y radio Fijo/Deslizable). Se renderiza inline arriba del banner en `/vendor/[slug]` (no fijo). `getVendorBySlug` ahora incluye `storeSettings` en el select.
- **Página de vendedor respeta `showPricesPublicly`**: `/vendor/[slug]` ya no oculta el precio incondicionalmente cuando el visitante no está logueado. Resuelve `canShowPrice = isLoggedIn || showPricesPublicly` leyendo `MarketplaceSettings` (global) y la entrada de `brandsConfig` para el host actual. Comportamiento alineado con el catálogo.
- **Tema claro por default en marketplace**: el script `theme-init` en `src/app/layout.tsx` ya no auto-activa el modo oscuro por `prefers-color-scheme: dark`. Solo se activa si `localStorage.theme === 'dark'`. El toggle del Navbar sigue persistiendo en localStorage por origen.

### Envíos (Skydropx)
- Cotización de envío en el carrito al seleccionar dirección
- "Correos de México / Sepomex" excluido de las opciones siempre
- Fallback a cotizaciones estimadas (mock) cuando la API no responde o rechaza credenciales
- Campo **CP de Envío** (`shippingZip`) en formulario de registro de vendedor, en Configuración → Tienda y facturación, y se pre-llena automáticamente al aprobar la solicitud
- Prioridad del CP de origen: `shippingZip` en StoreSettings → dirección de sucursal → default "45430"
- Generación de guías de envío desde el panel del vendedor (requiere credenciales válidas)
- Tracking de envíos

### Admin
- **Gestión de marcas**: botones Desactivar/Activar y Eliminar en cada tarjeta de marca; las marcas inactivas muestran banner amarillo de advertencia
- **Login por dominio**: la página de login muestra "Volver a [Nombre de Marca]" en lugar de "Volver al Marketplace" en dominios de marca propia
- Teléfono y WhatsApp visibles en lista de vendedores
- Teléfono copiado al User al aprobar vendedor
- Branding correcto en correos de bienvenida a vendedores
- **Mensualidad (fixedFee)** editable por vendedor en panel Admin → Marketplace (junto a la comisión)
- Panel de vendedores con grid 4 columnas (sm:2, lg:4)
- **Editor de planes con casilla "Incluye POS"** (Admin → Marketplace → 💼 Planes): cada plan puede marcarse como "solo marketplace" o "incluye POS". El plan Básico por default no incluye POS y el Seller arranca con `posEnabled: false`. Admin puede activarlo manualmente desde la pestaña de vendedores en cualquier momento.
- **Aprobación de aplicación respeta `includesPos`**: al aprobar una solicitud, el sistema busca el plan en `MarketplaceSettings.plans` y aplica `posEnabled` según el flag (fallback: si planName === 'Básico' o vacío, sin POS).

### Registro de Vendedor
- Campo "Calle y Número" ahora es **obligatorio**
- Campo **CP de Envío** (5 dígitos) requerido y validado
- CP de envío se transfiere a StoreSettings al aprobar la solicitud

### Página de Vendedor (marketplace)
- Banner sin espacio blanco extra entre el navbar y el encabezado del vendedor
- Layout `<main pt-28>` ya cubre el clearance del navbar; la página no agrega padding extra

### Kalexa Fashion (kalexa.modazapotlanejo.com)
- Logo, colores e imagen hero configurables desde Admin
- CTA "Listo para escalar" oculto
- Categorías Accesorios y Calzado ocultas
- Carrito sin opciones de envío (coordinación WhatsApp)
- Botón WhatsApp siempre verde
- "PayPal" cambiado a "Tarjeta de Débito/Crédito"
- Correos con branding morado de Kalexa

### POS
- Modo offline con IndexedDB (productos en caché local)
- Sincronización automática de ventas offline
- Niveles de precio automáticos según cantidad en carrito
- Sidebar cajero muestra logo y nombre del vendedor
- Ticket con dirección de sucursal correcta (no la general)
- Reportes accesibles para cajeros con permiso
- Alerta de inventario bajo ajustada a 1 pieza
- Optimización móvil (iPhone): Barra de herramientas compacta y tabla de ticket responsiva
- **Variantes con stock cero/negativo** pueden venderse (advertencia naranja en lugar de bloqueo)
- **Ticket impresión**: función reescrita con CSS inline + `window.onload` (eliminada dependencia a CDN Tailwind que causaba papel en blanco)
- **Logos de métodos de pago**: Clip, Zettle/PayPal y Ualabis muestran iconos SVG reales en lugar de emojis (archivos en `/public/logos/`)
- **Notificación de cambio en efectivo**: aparece en esquina superior derecha al cerrar el modal del ticket, dura 2 segundos
- **Lightbox de imágenes**: clicar el nombre de un producto en el carrito muestra su foto en pantalla completa
- **Vendedor de piso obligatorio**: toggle en Configuración → Tienda que bloquea completar venta si no se asigna vendedor de piso
- **Ventas suspendidas con abono**: el efectivo abonado al suspender se registra como `CashMovement IN` en el Corte Z activo; al completar la venta en sesión posterior se crea `CashMovement OUT` para evitar doble conteo
- **Cajero puede eliminar ventas suspendidas**: toggle en Configuración → Tienda; ventas con abono nunca pueden ser eliminadas por cajero
- **Bug fix**: ventas suspendidas reanudadas ahora se eliminan correctamente (el problema era que `deleteSuspendedSale` bloqueaba a cajeros — ahora usa `clearResumedSale`)
- **Corte Z → auto-logout**: al cerrar sesión de caja se desloguea automáticamente; el monto contado queda en `localStorage` para pre-llenarlo al abrir la siguiente sesión
- **Bug fix cambio en efectivo**: el toast verde de "Cambio" ahora muestra la resta correcta (pagado − total) y no el monto bruto escrito. El bug era un doble conteo cuando se procesaba un pago parcial automático (`explicitReceivedAmount` + `partialSumAtSale` se sumaban dos veces)
- **Modo Prueba compartido por seller (DB-backed)**: campo `User.posTestMode` en schema. Cuando el seller lo activa desde Configuración → Mi Perfil, todos sus cajeros (en cualquier navegador/dispositivo) entran en modo simulación. Las acciones del POS usan helpers `fakeSaleResult/fakeOk/fakeSession/fakeTransfer` y NO tocan la DB. Hook `useTestMode` en `pos/TestMode.tsx` hace fetch del flag al montar, al volver a foco y cada 60s. Toggle en `settings/profile/page.tsx` llama a `setPosTestMode` server action.
- **Toggle de tema oscuro en sidebar de cajero**: botón 🌙/☀️ debajo de "Reportes" en el sidebar minimal del cajero (`SidebarLayout.tsx`).
- **Devolución vs Venta determinada por neto firmado**: el toggle `isReturnMode` controla solo el signo al escanear (siguiente artículo con cantidad −1). La naturaleza real de la transacción (venta o devolución) la decide `isNetReturn = calculateNetSubtotal() < 0`. Esto permite carritos mixtos: si cliente trae 1 artículo a devolver y se lleva 3 nuevos, el POS muestra "Total a Cobrar" y procesa como Venta porque el neto es positivo.
- **Lista de abonos en card superior**: la lista de pagos parciales y el "Restante" ahora aparecen dentro del card de "TOTAL A COBRAR" en la parte alta del panel derecho del POS (visible sin scroll). El card inferior solo muestra Subtotal/Descuento/Total a Pagar.
- **TZ del servidor en `America/Mexico_City`**: variable `TZ` aplicada al proceso PM2 (`pm2 restart modazapo --update-env` con `TZ` env). Cualquier `new Date()` server-side y formatos de fecha trabajan en hora de México por defecto. La DB sigue almacenando timestamps en UTC.

### Reportes
- Tab **Ventas**: filtros por periodo, sucursal y producto; accesible a cajeros con `canViewReports`
- **Aislamiento de sucursal**: cajeros solo ven reportes de su sucursal asignada (`allowedLocationIds`); vendedores/admin ven todas
- Tab **Comisiones**: desglose de vendedores de piso; requiere permiso `canViewCommissions`
- Tab **Cortes Z**: lista de sesiones de caja cerradas (más reciente primero) con KPIs y desglose por método de pago; requiere permiso `canViewZCuts`
- Permisos independientes `canViewCommissions` y `canViewZCuts` configurables por cajero en Configuración → Equipo
- Campos nuevos en modelo `User` (schema + BD): `canViewCommissions Boolean @default(false)`, `canViewZCuts Boolean @default(false)`
- **Filtro de sucursal en todas las pestañas** de reportes (no solo Comisiones)

### Inventario
- Grilla multi-almacén/sucursal para editar stock por ubicación
- Celda de stock clickeable directamente para abrir modal de ajuste
- **Lightbox de imágenes**: pasar el mouse sobre la foto de un producto muestra ícono 🔍; al hacer clic se abre en pantalla completa (aplica también en Gestión de Productos — vista tabla y vista tarjeta)
- **Búsqueda sin acentos**: `/inventory` usa SQL `translate(lower(name), ...)` para búsqueda insensible a acentos (ej: "monaco" encuentra "Mónaco")
- **Orden de tallas en modal de ajuste**: las variantes se muestran en el orden definido en `variantOptions` (ej: Chica → Mediana → Grande → XL)
- **Sincronización inventario**: ventas POS ahora actualizan `InventoryLevel` y `Variant.stock` simultáneamente en transacción; todas las rutas (venta, devolución, cancelación, edición, apartado) están cubiertas

### Productos
- Constructor de nuevo producto con grilla de variantes multi-ubicación integrada
- Bulk actions con autenticación corregida y filtros de inventario por tabla
- **Búsqueda sin acentos** en `/products` (Gestión de Productos): normalización NFD en el cliente
- **Búsqueda sin acentos en marcas y proveedores** al crear/editar producto: normalización NFD
- **Generación de etiquetas / códigos de barras** (Code 128 y QR): botón en lista de productos. Code 128 ahora centrado con márgenes en los 4 lados; barras más altas (`height: 70`) y más angostas (`width: 1.2`) para mejor legibilidad
- **Orden de tallas en detalle de producto** (marketplace): respeta el orden definido en `variantOptions.values` en lugar del orden aleatorio del Set
- **Combobox de etiquetas con autocompletado**: al crear/editar producto, el campo Etiquetas autocompleta con tags existentes y permite crear uno nuevo si no hay match. Mismo patrón que Marcas/Proveedores. Aplica en `/products/new` y `/products/[id]/edit`.
- **Nombre del producto visible en pasos 2 y 3** del stepper de creación/edición: bajo el indicador de paso aparece "Creando: <nombre>" o "Editando: <nombre>" para identificar el producto sin volver al paso 1.
- **Botón "x" en buscador**: tanto `/products` como `/inventory` tienen un botón limpiar al final del campo de búsqueda (aparece solo cuando hay texto).
- **Eliminar permanentemente vendedor de piso desactivado** (`Configuración → Equipo`): botón "🗑 Eliminar" aparece solo en vendedores ya desactivados. La acción `permanentlyDeleteFloorSalesperson` limpia `soldBySalespersonId = null` en ventas históricas y borra el registro. Las ventas viejas pierden el nombre del vendedor pero conservan monto, productos, fecha, etc.

### Navegación
- **404 → Home**: cualquier URL inexistente redirige automáticamente al home (`/`) en los 3 dominios, en lugar de mostrar la página de error de Next.js (`src/app/not-found.tsx`)

---

## PENDIENTES

- [ ] Correo restablecimiento de contraseña con branding correcto
- [ ] Revisar PHPPOS (Google Drive ~102MB) para ideas de mejora al POS
- [ ] Correo al vendedor de ZonaDelVestir con branding correcto al registrarse
- [ ] **Branding en Dashboard zonadelvestir.com** — sidebar muestra "Moda Zapotlanejo" en azul en lugar de "Zona del Vestir" en violeta (plan de implementación existe en `.claude/plans/sprightly-chasing-blanket.md`)
- [ ] Ocultar icono de mensajes en Header si no hay mensajes sin leer
- [ ] Botón WhatsApp en detalle de producto con info del producto (solo kalexafashion.com)
- [ ] Implementar Slugs de productos basados en el nombre en lugar de ID
- [ ] **Skydropx — credenciales reales:** Obtener token API correcto de Skydropx para activar cotizaciones reales (actualmente usa mock)

---

## SERVICIOS EXTERNOS

| Servicio | Uso | Notas |
|----------|-----|-------|
| Resend | Email transaccional | API Key real en .env |
| Anthropic API | IA para descripciones | $5 USD cargados |
| Hostinger | VPS | Plan activo |
| donweb.com | DNS | modazapotlanejo.com y zonadelvestir.com |
| Stripe | Pagos marketplace | Configurado |
| Skydropx | Cotización y generación de guías de envío | Credenciales en `/var/www/modazapo/.env` — actualmente con 401, usando mock. SKYDROPX_API_KEY y SKYDROPX_API_SECRET presentes pero incorrectos para la v1 REST API |

---
