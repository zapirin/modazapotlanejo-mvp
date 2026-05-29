# 🧠 Memoria Compartida y Contexto del Proyecto — modazapo

Este archivo sirve como el **punto de contacto y memoria compartida** entre diferentes asistentes de Inteligencia Artificial (Antigravity, Claude, ChatGPT, Cursor, etc.). Su objetivo es garantizar una transición perfecta de información sin pérdida de contexto.

---

## 📢 INSTRUCCIONES PARA LA INTELIGENCIA ARTIFICIAL EN TURNO

> [!IMPORTANT]
> **Si eres un nuevo asistente de IA que acaba de recibir este proyecto:**
> 1. Lee este archivo completo para comprender qué se ha construido recientemente y las reglas técnicas.
> 2. Lee [CLAUDE.md](file:///Users/juandelatorredelreal/Downloads/modazapo/CLAUDE.md) para conocer las pautas de estilo de código y los comandos exactos de compilación y despliegue (deploy).
> 3. Lee [SECRETOS.md](file:///Users/juandelatorredelreal/Downloads/modazapo/SECRETOS.md) para obtener credenciales reales de base de datos, SSH y APIs (no uses placeholders).
>
> **Antes de terminar tu sesión de trabajo y devolver el control al usuario:**
> * Actualiza la sección **"📝 Bitácora de Cambios Recientes"** al final de este archivo detallando con precisión qué archivos modificaste, qué funciones agregaste o corregiste, y el estado del despliegue en producción.

---

## 🚀 Estado Actual y Cambios Recientes (Implementados por Antigravity)

Recientemente hemos implementado y desplegado con éxito en el servidor de producción las siguientes características clave:

### 1. Compartir Ticket Digital Interactivo en el POS
* **Archivos clave:** [pos/page.tsx](file:///Users/juandelatorredelreal/Downloads/modazapo/src/app/(seller-center)/pos/page.tsx) | [templates.ts](file:///Users/juandelatorredelreal/Downloads/modazapo/src/lib/email/templates.ts)
* **Funcionalidad:** Al finalizar una venta en el POS con cliente registrado, se abre una modal premium traslúcida (Glassmorphism) que permite decidir si se envía el ticket por correo electrónico o WhatsApp.
* **Atajos de Teclado:** 
  * Presionar **`Esc`** o "No enviar" pasa de inmediato a la modal física de impresión térmica de 80mm.
  * Presionar **`Enter`** o "Enviar ticket" despacha asíncronamente el correo, prepara el chat de WhatsApp y redirige a la modal física de impresión térmica.

### 2. Nombre de Sucursal Dinámico en Tickets de Correo
* **Archivo clave:** [templates.ts](file:///Users/juandelatorredelreal/Downloads/modazapo/src/lib/email/templates.ts)
* **Funcionalidad:** Se reemplazó la marca estática `"ModaZapotlanejo"` en el asunto y saludo del correo por la variable dinámica `brandName`, la cual resuelve de forma automática el nombre real de la sucursal física en la que se opera la venta (mediante la variable `locationName`).

### 3. Ajuste de Formato en WhatsApp
* **Archivo clave:** [pos/page.tsx](file:///Users/juandelatorredelreal/Downloads/modazapo/src/app/(seller-center)/pos/page.tsx)
* **Funcionalidad:** Se eliminó la línea `* COTIZACIÓN *` al generar y compartir la cuenta por WhatsApp, presentándola limpiamente como un desglose tradicional.

### 4. Niveles de Precio Automáticos en el POS
* **Archivo clave:** [pos/page.tsx](file:///Users/juandelatorredelreal/Downloads/modazapo/src/app/(seller-center)/pos/page.tsx)
* **Funcionalidad:** Corregimos una regresión. Ahora el POS evalúa la cantidad total de prendas en el carrito y auto-aplica la tarifa de mayoreo correspondiente configurada con `autoApplyPOS: true` en el panel de vendedor. Si el cajero selecciona manualmente un precio en el dropdown, el auto-aplicador se inhabilita para respetar su decisión.

### 5. Reversión de Puntos de Fidelización en Devoluciones y Cancelaciones
* **Archivo clave:** [actions.ts](file:///Users/juandelatorredelreal/Downloads/modazapo/src/app/(seller-center)/products/new/actions.ts)
* **Funcionalidad:** Al eliminar/cancelar una venta (`deleteSale`) o realizar una devolución (`updateSale` con `isReturn = true`), el sistema localiza las transacciones de fidelidad y resta los puntos ganados o reembolsa los puntos canjeados del saldo del cliente de forma automática.
* **Fórmula de Seguridad:** `Math.max(0, account.balance - ltxn.points)` para blindar los saldos contra valores negativos.

---

## 🛠️ Stack Técnico y Reglas de Despliegue (Resumen)

* **Stack:** Next.js 15/16 App Router (React), Prisma ORM, PostgreSQL (Prisma Client).
* **Servidor VPS:** `187.124.158.239` (Usuario `root`).
* **Ruta en VPS:** `/var/www/modazapo`
* **Gestión:** PM2 (`pm2 restart modazapo`).
* **Importante:**
  * **No** subir archivos de configuración local (`.env`, `.env.local`).
  * Para desplegar: Copiar archivos modificados al VPS, y ejecutar de forma remota:
    ```bash
    cd /var/www/modazapo
    npm run build
    pm2 restart modazapo
    ```

---

## 📝 Bitácora de Cambios Recientes

*(Las inteligencias artificiales deben documentar aquí sus cambios cronológicamente antes de finalizar su turno).*

### [2026-05-22] — Cambios en Fidelización, Niveles de Precio y Sucursal Dinámica (Antigravity)
* **Archivos Modificados**:
  * [pos/page.tsx](file:///Users/juandelatorredelreal/Downloads/modazapo/src/app/(seller-center)/pos/page.tsx)
  * [actions.ts](file:///Users/juandelatorredelreal/Downloads/modazapo/src/app/(seller-center)/products/new/actions.ts)
  * [templates.ts](file:///Users/juandelatorredelreal/Downloads/modazapo/src/lib/email/templates.ts)
* **Resumen de Cambios**:
  * Implementada la deducción de puntos ganados y el reembolso de puntos canjeados en eliminaciones y devoluciones.
  * Corregida la regresión de niveles de precio automáticos por volumen de prendas en el POS respetando el override manual del cajero.
  * Implementado el nombre de sucursal dinámico en el asunto y saludo de correos del ticket digital.
  * Removido el indicador de "COTIZACIÓN" de los desgloses en WhatsApp.
* **Estado de Despliegue**: Desplegado con éxito, compilación y optimización de Next.js sin errores, servidor reiniciado y en funcionamiento estable.
