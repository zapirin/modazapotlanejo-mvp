# CONTEXTO — Modazapo Marketplace
*Última actualización: 28 de marzo 2026*

## 🏗️ STACK TÉCNICO
| Componente | Tecnología |
|---|---|
| Framework | Next.js (App Router), React 19, TypeScript |
| Estilos | Tailwind CSS 4 |
| ORM | Prisma 6.19.2 |
| Base de datos | PostgreSQL en VPS Hostinger (migrado desde Supabase) |
| Storage imágenes | Supabase Storage (solo imágenes, NO la BD) |
| Deploy | Vercel |
| Email | Resend (noreply@modazapotlanejo.com) |
| Pagos | Stripe |

## 📁 REPOSITORIO Y ACCESOS
- **GitHub:** https://github.com/zapirin/modazapotlanejo-mvp.git
- **Vercel:** tienda-modazapo.vercel.app
- **Dominio 1:** modazapotlanejo.com → "Moda Zapotlanejo" (azul)
- **Dominio 2:** zonadelvestir.com → "Zona del Vestir" (violeta)

## 🗄️ BASE DE DATOS
```
DATABASE_URL="postgresql://modazapo:ModaZapo2026x@187.124.158.239:5432/modazapo"
DIRECT_URL="postgresql://modazapo:ModaZapo2026x@187.124.158.239:5432/modazapo"
```

### VPS Hostinger
- IP: 187.124.158.239
- OS: AlmaLinux 9.7
- SSH: ssh root@187.124.158.239
- PostgreSQL corriendo en puerto 5432
- CyberPanel instalado (WordPress kalexafashion.com + PHPPOS)
- Backups en: /root/backup_20260327/

### Supabase (solo Storage)
- Project ID: ynbcslgimrrccqohirzl
- Storage URL: https://ynbcslgimrrccqohirzl.supabase.co/storage/v1/object/public/product-images/
- Estado: Limitado hasta 3 de abril 2026 — la BD ya NO usa Supabase

## 👥 USUARIOS
| Email | Rol | Notas |
|---|---|---|
| jcarlosdlt@gmail.com | ADMIN | Administrador principal |
| kalexa.fashion@gmail.com | SELLER | Tienda Kalexa Fashion |

### Asignar contraseña desde Mac:
```bash
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
node -e "const crypto=require('crypto');console.log(crypto.createHash('sha256').update('CONTRASEÑA').digest('hex'));"
psql "postgresql://modazapo:ModaZapo2026x@187.124.158.239:5432/modazapo" -c "UPDATE \"User\" SET \"passwordHash\"='HASH' WHERE email='email@x.com';"
```

## 🌐 MULTI-TENANT
- src/lib/brand.ts — config estática de marcas
- layout.tsx lee el host y aplica CSS vars: --brand-600, --brand-500, etc.
- Login: page.tsx (server) + LoginClient.tsx (client) — muestra logo y color de cada marca
- Logo ZDV: https://ynbcslgimrrccqohirzl.supabase.co/storage/v1/object/public/product-images/logo_zonadelvestir_transparent.png
- DNS: modazapotlanejo.com → Vercel nameservers (ns1/ns2.vercel-dns.com)
- Resend verificado en modazapotlanejo.com

## ✅ FUNCIONALIDADES IMPLEMENTADAS

### Marketplace
- Landing, catálogo, producto, carrito, checkout (Stripe + Skydropx)
- Wishlist, mensajes, órdenes, seguimiento
- Registro compradores (dirección opcional) y vendedores (plan + domicilio obligatorio)
- Login con branding dinámico por dominio
- Calificaciones y reseñas (solo compradores con compra completada)
- Orden categorías: DAMAS → CABALLEROS → NIÑOS → ACCESORIOS → CALZADO

### Seller Center
- Dashboard, productos con variantes, POS completo
- POS offline con sync, sesiones de caja, denominaciones
- Periféricos: impresora red/BT, lector barras, cajón dinero, pantalla cliente
- Botón "Abrir cajón" en POS (según permiso canOpenDrawer del cajero)
- Equipo/cajeros con permisos granulares + toggle canOpenDrawer
- Pedidos, mensajes, reseñas recibidas, inventario

### Admin
- Panel con tabs: Sitio, Vendedores, Destacados, Fotografía, Planes, Marcas, Mi Cuenta
- Vendedores colapsables, subpestañas Activos/Desactivados
- Desactivados: reactivar o eliminar permanente (con productos)
- Solicitudes pendientes + reset credenciales por email
- Selector colores por dominio (no funciona aún — problema caché Next.js)
- Planes, fotografía, URLs legales editables

## 🐛 PENDIENTES

### Críticos
1. **canOpenDrawer, SellerReview, PosPeripheral, BrandConfig** — en schema.prisma pero NO en BD. Ejecutar `npx prisma db push` cuando Supabase se libere (3 abril) o directamente contra el VPS
2. **Colores por dominio desde admin** — selector existe pero no se refleja. Cambiar manualmente en src/lib/brand.ts hasta que se resuelva el caché

### Funcionalidades pendientes
3. **Editor visual del marketplace** (solicitado, no implementado)
4. **Migración 5,402 productos de PHPPOS** — script `migrar_productos.py` creado, pendiente de ejecutar
5. **Notificaciones wishlist** (email cuando baja precio o vuelve stock)
6. **Colecciones/Temporadas** en página del vendedor
7. **Moderación de reseñas** en admin

## 📋 ARCHIVOS CLAVE
```
src/lib/brand.ts                    — Config marcas por dominio
src/app/(marketplace)/layout.tsx    — Inyecta CSS vars de color
src/app/(marketplace)/Navbar.tsx    — Logo dinámico
src/app/login/page.tsx              — Server (lee dominio)
src/app/login/LoginClient.tsx       — Client (UI con brand)
src/app/(seller-center)/admin/marketplace/MarketplaceClient.tsx — Panel admin
src/app/actions/auth.ts             — Login, registro, reset
src/app/actions/marketplace.ts      — Settings, vendedores
src/app/actions/reviews.ts          — Reseñas
src/app/actions/peripherals.ts      — Periféricos POS
src/components/SellerReviews.tsx    — Componente reseñas
```

## 🔧 COMANDOS FRECUENTES
```bash
# Desarrollo local
cd ~/Downloads/modazapo
rm -rf .next && npx prisma db push && npm run dev

# Deploy
git add . && git commit -m "mensaje" && git push origin main

# BD desde Mac
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
psql "postgresql://modazapo:ModaZapo2026x@187.124.158.239:5432/modazapo"

# SSH VPS
ssh root@187.124.158.239

# MySQL VPS (PHPPOS/WordPress)
mysql --no-defaults -u root -phSZ6XCn3tF8w3M kale_pos -e "SHOW TABLES;"
```

## 📊 DATOS DEL NEGOCIO
- Propietario: Juan Carlos de la Torre del Real (jcarlosdlt@gmail.com)
- Negocio: Kalexa Fashion — ropa mayorista, Zapotlanejo, Jalisco
- PHPPOS: 5,402 productos activos listos para migrar
- Categorías BD: DAMAS, CABALLEROS, NIÑOS, ACCESORIOS, CALZADO
- VPS MySQL contraseña: hSZ6XCn3tF8w3M
