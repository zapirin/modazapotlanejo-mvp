# CONTEXTO COMPLETO — PROYECTO MODAZAPO
*Actualizado el 14/04/2026 — logos POS, Cortes Z, permisos cajeros, 404→home*

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

### Imágenes locales
- `unoptimized: true` en `next.config.ts` (ya aplicado)

### Skydropx — Credenciales incorrectas (pendiente resolver)
- **Situación:** La API Skydropx retorna `401 Bad credentials` con las credenciales actuales
- **Causa:** Las credenciales de `Configuración → Conexiones → API` son OAuth2 de aplicación (client_id + client_secret), NO el token directo que requiere `api.skydropx.com/v1`
- **Workaround activo:** Cuando la API devuelve 401/403, el código cae automáticamente a cotizaciones mock (FedEx/Estafeta/DHL con precios estimados) para que el carrito funcione
- **Solución permanente:** Obtener el token API correcto de Skydropx (contactar hola@skydropx.com o buscar en perfil personal de Skydropx un "Token de API" individual, diferente del key+secret de Conexiones)
- **Cuando se tenga el token correcto:** `sed -i 's/^SKYDROPX_API_KEY=.*/SKYDROPX_API_KEY=TOKEN_REAL/' /var/www/modazapo/.env && pm2 restart modazapo` (no necesita rebuild)

### Columnas extra en BD (inofensivas)
- La tabla `User` tiene columna `requireCashSession` y `StoreSettings` tiene `aiProvider`/`aiApiKey` en la BD del servidor. No están en el schema.prisma actual (se revirtieron en el código) pero son inofensivas.
- La tabla `User` ahora tiene `canViewCommissions` y `canViewZCuts` (añadidas el 14/04/2026 con `prisma db push`).

### Seguridad — repositorio público
- El repo `zapirin/modazapotlanejo-mvp` en GitHub es **público**
- NUNCA poner contraseñas en CONTEXTO.md ni en ningún archivo rastreado por git
- Todas las credenciales van en `SECRETOS.md` (está en `.gitignore`)
- Los archivos `.bak` también están en `.gitignore`
- La contraseña de BD fue rotada el 13/04/2026 (la versión anterior quedó expuesta en historial de git)

---

## FUNCIONALIDADES IMPLEMENTADAS

### Marketplace
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

### Envíos (Skydropx)
- Cotización de envío en el carrito al seleccionar dirección
- "Correos de México / Sepomex" excluido de las opciones siempre
- Fallback a cotizaciones estimadas (mock) cuando la API no responde o rechaza credenciales
- Campo **CP de Envío** (`shippingZip`) en formulario de registro de vendedor, en Configuración → Tienda y facturación, y se pre-llena automáticamente al aprobar la solicitud
- Prioridad del CP de origen: `shippingZip` en StoreSettings → dirección de sucursal → default "45430"
- Generación de guías de envío desde el panel del vendedor (requiere credenciales válidas)
- Tracking de envíos

### Admin
- Teléfono y WhatsApp visibles en lista de vendedores
- Teléfono copiado al User al aprobar vendedor
- Branding correcto en correos de bienvenida a vendedores
- **Mensualidad (fixedFee)** editable por vendedor en panel Admin → Marketplace (junto a la comisión)
- Panel de vendedores con grid 4 columnas (sm:2, lg:4)

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

### Reportes
- Tab **Ventas**: filtros por periodo, sucursal y producto; accesible a cajeros con `canViewReports`
- **Aislamiento de sucursal**: cajeros solo ven reportes de su sucursal asignada (`allowedLocationIds`); vendedores/admin ven todas
- Tab **Comisiones**: desglose de vendedores de piso; requiere permiso `canViewCommissions`
- Tab **Cortes Z**: lista de sesiones de caja cerradas (más reciente primero) con KPIs y desglose por método de pago; requiere permiso `canViewZCuts`
- Permisos independientes `canViewCommissions` y `canViewZCuts` configurables por cajero en Configuración → Equipo
- Campos nuevos en modelo `User` (schema + BD): `canViewCommissions Boolean @default(false)`, `canViewZCuts Boolean @default(false)`

### Inventario
- Grilla multi-almacén/sucursal para editar stock por ubicación
- Celda de stock clickeable directamente para abrir modal de ajuste

### Productos
- Constructor de nuevo producto con grilla de variantes multi-ubicación integrada
- Bulk actions con autenticación corregida y filtros de inventario por tabla

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
