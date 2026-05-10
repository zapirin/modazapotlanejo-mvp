# Manual del Admin (operador del marketplace)

Para el dueño/operador de modazapotlanejo.com (admin global del proyecto).

## 1. Aprobar solicitudes de vendedores
**Admin → Solicitudes**: revisa, aprueba o rechaza cada solicitud nueva. Al aprobar, el sistema:
- Crea el usuario con rol SELLER.
- Asigna el plan que pidió (Básico/Estándar/Pro/Empresarial).
- Aplica `posEnabled` automáticamente según el plan: si la casilla "Incluye POS" del plan está marcada, el seller arranca con POS activo; si no, sin POS.
- Manda un correo de bienvenida con contraseña temporal y branding del dominio donde se registró.

## 2. Crear vendedor manualmente
Si quieres registrar a un vendedor sin que pase por el formulario público:
**Admin → Marketplace → Vendedores → + Crear Vendedor**. Introduce nombre, email, teléfono y plan inicial. Mismas reglas de `posEnabled` que en aprobación.

## 3. Editor de planes
**Admin → Marketplace → 💼 Planes**: edita los planes de suscripción que ven los vendedores al registrarse. Cada plan tiene:
- **Nombre, precio, badge** ("⭐ Popular", "🚀 Recomendado", etc.)
- **Sucursales y cajeros máximos**, productos máximos (0 = ilimitados)
- **Características**: lista de bullets que aparece en la tarjeta del plan
- **Casilla "Incluye POS"**: si la desmarcas, ese plan es solo marketplace (sin POS, sin sucursales, sin cajeros). Útil para un plan gratis.
- **Casilla "Resaltado"**: borde azul destacado en la tarjeta.
- **Casilla "Oculto"**: para no mostrarlo en el registro público.
- **Reordenar** con flechas ↑↓ y eliminar con 🗑.

Al pulsar **💾 Guardar Planes** los cambios se reflejan en `/register/seller`.

## 4. Gestionar vendedores
**Admin → Marketplace → Vendedores**: para cada vendedor puedes:
- **Activar/desactivar** acceso al POS (toggle verde).
- **Ajustar plan**: aplicar plan completo con un click ("Asignar Plan Rápido") o editar individualmente sucursales, cajeros y productos máximos.
- **Comisión y mensualidad**: comisión porcentual por venta + cuota fija mensual.
- Ver datos de contacto, teléfono y WhatsApp.

## 5. Marcas y dominios
- **Admin → Marketplace → Marcas**: activa/desactiva o elimina marcas registradas. Las desactivadas se ocultan en el catálogo y muestran un banner amarillo en la lista.
- **Admin → Marketplace → Dominios** (`BrandConfig`): cada dominio (kalexafashion.com, zonadelvestir.com) puede tener logo, colores, hero, descripción configurables. Los **single-vendor stores** (con `sellerId` asignado al BrandConfig) se comportan diferente:
  - Solo muestran productos de ese vendedor.
  - Ocultan automáticamente avisos del marketplace ("Compra Protegida", "Vendedores Verificados", "Pagos 100% Seguros") porque esos son específicos del marketplace multi-vendor con Stripe.

## 6. Configuración global del marketplace
**Admin → Marketplace → Sitio**:
- Logo, título, etiqueta de vendedores, URLs legales.
- Color de marca por dominio (modazapotlanejo y zonadelvestir).
- Visibilidad de precios sin login (toggle global y por marca/dominio). Aplica al catálogo y a la página pública de cada vendedor.
- **Listón de Anuncio por Sitio** (ver siguiente sección).

## 6.1 Listón de Anuncio
Barra delgada arriba del marketplace para avisos puntuales (ej. "Felicidades a todas las madres en su día"). Cada dominio se administra por separado:

- **modazapotlanejo.com y zonadelvestir.com**: Admin → Marketplace → **Sitio** → "Listón de Anuncio por Sitio". Bloque por dominio con toggle, textarea y radio **Fijo / Deslizable** (de derecha a izquierda). Botón "💾 Guardar Listón" independiente.
- **kalexafashion.com y marcas independientes**: Admin → Marketplace → **Marcas** → tarjeta de la marca → bloque "📢 Listón de Anuncio" con los mismos controles. Se guarda al pulsar "💾 Guardar Configuración de Marca".
- **Por vendedor en su página pública**: cada vendedor configura su propio listón desde su panel (no admin), aparece solo en `/vendor/<slug>`.

## 7. Comisiones del marketplace
**Reportes → Comisiones del Marketplace**: vista admin que muestra cuánto cobraste de comisión a cada vendedor en el periodo.

## 8. Email y branding
Los correos transaccionales (bienvenida, pedido nuevo, pedido confirmado/rechazado, etc.) usan branding del dominio donde el usuario operó:
- modazapotlanejo.com → azul `#2563eb`
- zonadelvestir.com → violeta `#7c3aed`
- kalexafashion.com → morado `#8124E3`

## 9. Servidor y deploys
Aspectos técnicos detallados en `CONTEXTO.md`. Resumen:
- VPS Hostinger en `187.124.158.239`.
- Proceso PM2: `modazapo`.
- Zona horaria del proceso: `America/Mexico_City`.
- Después de cualquier cambio de código: `npm run build && pm2 restart modazapo`.

## 10. Tareas comunes
| Tarea | Cómo |
|---|---|
| Dar POS a un vendedor de plan Básico | Admin → Marketplace → Vendedores → toggle de POS |
| Subir el límite de productos de un vendedor | Admin → Marketplace → Vendedores → editar maxProducts |
| Bajar la comisión a 3% para un seller específico | Admin → Marketplace → Vendedores → editar Comisión |
| Crear un plan nuevo "Premium" con 10 sucursales | Admin → Marketplace → 💼 Planes → + Nuevo Plan |
| Ocultar temporalmente el plan "Empresarial" | Admin → Marketplace → 💼 Planes → 🙈 en ese plan |
| Resetear contraseña de un vendedor | Admin → Marketplace → Vendedores → Resetear Contraseña (genera nueva temporal) |
