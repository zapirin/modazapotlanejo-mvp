# Manual del Cajero (Punto de Venta)

Para personal que opera el POS de un vendedor.

## 1. Iniciar el día
1. Inicia sesión con tu correo y contraseña.
2. Si tu vendedor configuró control de caja, antes de vender debes **abrir caja**: ingresa el monto inicial en efectivo.
3. Si tu sesión vence, el cierre Z previo te muestra el monto sugerido para abrir hoy.

## 2. Hacer una venta
1. **Buscar o escanear** un código de barras / nombre / SKU.
2. Selecciona la variante (talla/color) en el modal y la cantidad.
3. Repite hasta tener el carrito completo.
4. Asigna **Vendedor de Piso** (obligatorio si el dueño lo configuró así).
5. Selecciona **Método de Pago**, ingresa el monto recibido y pulsa **Procesar Venta**.
6. Imprime el ticket (puedes pulsar Enter para imprimir rápido).

> El **nivel de precio** se aplica automáticamente según la cantidad: por ejemplo, si compras 8 piezas y hay un nivel "Corrida 8 pz" con precio especial, el POS lo aplica solo.

## 3. Modos del POS
En la barra superior puedes cambiar entre:
- **Venta** (predeterminado): cobrar normal.
- **Devolución**: el siguiente artículo escaneado se agrega con cantidad negativa.
- **Traspaso**: mover stock entre sucursales (no hay cobro).

Después de cualquier transacción exitosa, el modo regresa automáticamente a **Venta**.

## 4. Devoluciones y carritos mixtos
- **Cliente solo trae artículos a devolver**: activa **Modo Devolución**, escanéalos, paga la diferencia al cliente.
- **Cliente trae uno a devolver y se lleva otros nuevos**: agrega los nuevos en modo Venta y los devueltos en modo Devolución. El POS calcula automáticamente:
  - Si el **neto es positivo** (cliente paga la diferencia) → muestra "Total a Cobrar" y procesa como Venta.
  - Si el **neto es negativo** (la tienda devuelve) → muestra "Monto a Devolver" y procesa como Devolución.

## 5. Pagos parciales / abonos
Puedes recibir varios pagos en una venta (efectivo + tarjeta, por ejemplo):
1. Escribe el primer monto en "Abonar".
2. Pulsa **+ Agregar**.
3. Repite con el siguiente método.
4. La lista de **Abonos Realizados** y el **Restante** aparecen junto al "Total a Cobrar" (parte alta del panel derecho).
5. Cuando el restante llegue a $0, pulsa **Procesar Venta**.

## 6. Apartados (layaway)
Cliente pide que le aparten producto pagando un anticipo:
1. Carrito completo → **Opciones → Apartar**.
2. Escribe el monto inicial pagado y la fecha de vencimiento.
3. El producto se descuenta del inventario; el cliente abona después en **Dashboard → Apartados**.

## 7. Suspender venta
Cliente quiere irse a buscar más cosas y no congestionar la caja:
- **Opciones → Suspender Venta** (puede o no llevar abono).
- Reanudar desde **Opciones → Ventas Suspendidas**.

## 8. Movimientos de caja
**Opciones → Movimiento de Caja**: registra entradas y salidas de efectivo (cambio de billetes, gastos del día, retiros). Aparece en el corte Z al cierre. El primer campo del modal es **Monto**, el segundo **Motivo**.

## 9. Cerrar el día (Corte Z)
1. **Opciones → Cerrar Caja**.
2. Ingresa el conteo físico del cajón.
3. El sistema te muestra diferencias y guarda el corte Z.
4. Quedas deslogueado automáticamente.

## 10. Modo Prueba
Si tu vendedor lo activó, verás una **banda naranja** arriba que dice "🧪 Modo Prueba activo". Todo lo que hagas se simula y NO se guarda en la base de datos. Cuando el dueño lo apague, vuelves a operar normal.

> Solo el dueño puede prender o apagar Modo Prueba (en su Mi Perfil). Tú no puedes cambiarlo.

## 11. Modo Offline
Si pierdes conexión, el POS sigue funcionando con productos cacheados. Las ventas se guardan localmente y se sincronizan automáticamente cuando vuelvas a estar en línea. Verás un contador "X pendientes" en la barra de estado.

## 12. Traspasos entre sucursales
1. Cambia a **Modo Traspaso** desde la barra superior.
2. Selecciona sucursal **origen** y **destino**.
3. Escanea o agrega productos.
4. Pulsa **Completar Traspaso**.
5. Imprime el ticket de traspaso (sirve como evidencia).

## 13. Cambiar entre claro y oscuro
En el sidebar, debajo de "Reportes", está el botón con 🌙 (modo claro activo) o ☀️ (modo oscuro activo). Click para alternar.

## 14. Atajos de teclado útiles
- **F1**: refrescar página
- **F2**: buscar producto
- **F3**: agregar cliente
- **F7**: campo de pago
- **Enter**: imprimir ticket al finalizar venta
- **Esc**: cerrar modales

## 15. Problemas comunes
| Problema | Qué hacer |
|---|---|
| El modal de variantes selecciona la primera al pulsar Enter | Usa flechas ↑↓ para elegir, Enter solo confirma cuando hay foco visible |
| Una venta no se imprimió | Reimprime desde Dashboard → Ventas → ese ticket → botón Reimprimir |
| Equivoqué un movimiento de caja | Aparecerá en el corte Z, díselo a tu jefe para que lo justifique |
| Cliente quiere editar una venta ya cobrada | Solo el vendedor (admin de tienda) puede editar ventas desde su Dashboard |
