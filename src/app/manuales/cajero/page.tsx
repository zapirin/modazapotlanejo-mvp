import React from 'react';
import ManualImagePlaceholder from '@/components/ManualImagePlaceholder';

export default function ManualCajeroPage() {
  return (
    <div className="space-y-12 text-gray-700">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
          Manual del Cajero (Punto de Venta)
        </h1>
        <p className="text-lg text-gray-500">
          Guía operativa para el personal que utiliza el sistema de Punto de Venta (POS).
        </p>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          1. Iniciar el día
        </h2>
        <ol className="list-decimal list-outside ml-5 space-y-2 mb-6">
          <li>Inicia sesión con tu correo y contraseña.</li>
          <li>Si tu vendedor (dueño de tienda) configuró control de caja, antes de vender debes <strong>abrir caja</strong> ingresando el monto inicial en efectivo (fondo de caja).</li>
          <li>Si tu sesión se cierra, el corte Z previo te sugerirá el monto con el que deberías abrir hoy.</li>
        </ol>
        <ManualImagePlaceholder description="Captura del modal 'Abrir Caja' al iniciar el día." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          2. Hacer una venta
        </h2>
        <ol className="list-decimal list-outside ml-5 space-y-3 mb-6">
          <li><strong>Buscar o escanear:</strong> usa el lector de código de barras, o busca por nombre/SKU.</li>
          <li>Selecciona la variante (talla/color) en el modal emergente y ajusta la cantidad.</li>
          <li>Repite el proceso hasta tener todos los artículos en el carrito.</li>
          <li>Asigna un <strong>Vendedor de Piso</strong> (es obligatorio si el dueño lo configuró así para el cálculo de comisiones).</li>
          <li>Selecciona el <strong>Método de Pago</strong> (ej. Efectivo, Tarjeta), ingresa el monto recibido y pulsa <strong>Procesar Venta</strong>.</li>
          <li>Imprime el ticket (puedes pulsar <kbd className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded text-sm text-gray-600">Enter</kbd> para imprimir rápido y cerrar la venta).</li>
        </ol>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md text-sm text-blue-800 mb-6">
          <p><strong>Nota sobre precios por volumen:</strong> El nivel de precio se aplica automáticamente según la cantidad. Por ejemplo, si un cliente compra 8 piezas y existe un nivel "Corrida 8 pz" con precio especial, el POS ajustará el costo unitario por sí solo.</p>
        </div>
        <ManualImagePlaceholder description="Captura de la pantalla principal del POS con productos en el carrito." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          3. Modos del POS
        </h2>
        <p className="mb-4">En la barra superior puedes cambiar entre diferentes modos operativos:</p>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li><span className="font-semibold text-blue-600">Venta</span> (predeterminado): Para cobrar normalmente.</li>
          <li><span className="font-semibold text-red-600">Devolución</span>: El siguiente artículo escaneado se agrega con cantidad negativa al carrito.</li>
          <li><span className="font-semibold text-purple-600">Traspaso</span>: Para mover inventario entre sucursales (no genera un cobro monetario).</li>
        </ul>
        <p className="text-sm text-gray-500 italic">Después de cualquier transacción exitosa, el sistema regresará automáticamente al modo Venta para evitar errores.</p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          4. Devoluciones y carritos mixtos
        </h2>
        <div className="space-y-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-1">Cliente solo trae artículos a devolver</h3>
            <p className="text-sm">Activa el modo <strong>Devolución</strong>, escanea los productos y paga la cantidad correspondiente al cliente en efectivo u otro método.</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-1">Cliente trae uno a devolver y se lleva otros nuevos</h3>
            <p className="text-sm mb-2">Agrega los productos nuevos en modo <strong>Venta</strong>, luego cambia a modo <strong>Devolución</strong> y agrega los que devuelve. El POS calculará el balance:</p>
            <ul className="list-disc list-outside ml-5 text-sm space-y-1">
              <li>Si el <strong>neto es positivo</strong> (el cliente debe pagar diferencia) → mostrará "Total a Cobrar" y se procesará como una venta.</li>
              <li>Si el <strong>neto es negativo</strong> (la tienda debe devolver dinero) → mostrará "Monto a Devolver" y se procesará como devolución.</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          5. Pagos parciales / abonos
        </h2>
        <p className="mb-4">Puedes recibir diferentes métodos de pago en una misma venta (ej. la mitad en efectivo y la mitad con tarjeta):</p>
        <ol className="list-decimal list-outside ml-5 space-y-2 mb-6">
          <li>Escribe el primer monto en el campo "Abonar".</li>
          <li>Pulsa <strong>+ Agregar</strong>.</li>
          <li>Repite el proceso con el siguiente método de pago.</li>
          <li>Verás la lista de <strong>Abonos Realizados</strong> y el <strong>Restante</strong> en la parte superior del panel derecho.</li>
          <li>Cuando el restante llegue a $0, pulsa <strong>Procesar Venta</strong>.</li>
        </ol>
      </section>

      <section className="grid sm:grid-cols-2 gap-8 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
            6. Apartados (Layaway)
          </h2>
          <p className="mb-2 text-sm">Si un cliente quiere apartar mercancía pagando un anticipo:</p>
          <ol className="list-decimal list-outside ml-5 text-sm space-y-1 mb-4">
            <li>Con el carrito lleno, ve a <strong>Opciones → Apartar</strong>.</li>
            <li>Escribe el monto inicial pagado y la fecha límite de vencimiento.</li>
            <li>El producto se descuenta del inventario. El cliente podrá abonar después desde el panel de Apartados en el Dashboard.</li>
          </ol>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
            7. Suspender venta
          </h2>
          <p className="mb-2 text-sm">Si un cliente decide buscar más cosas y no quieres detener la fila de cobro:</p>
          <ul className="list-disc list-outside ml-5 text-sm space-y-1 mb-4">
            <li>Ve a <strong>Opciones → Suspender Venta</strong> (puede tener abonos previos o no).</li>
            <li>La caja queda libre para el siguiente cliente.</li>
            <li>Para retomarla, ve a <strong>Opciones → Ventas Suspendidas</strong>.</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          8. Movimientos de caja y Corte Z
        </h2>
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Movimientos durante el turno</h3>
          <p className="text-sm mb-3">En <strong>Opciones → Movimiento de Caja</strong> puedes registrar entradas y salidas de efectivo (como cambiar billetes por monedas, gastos rápidos del día o retiros del dueño). Estos movimientos aparecerán reflejados en el corte final.</p>
          
          <h3 className="text-lg font-bold text-gray-800 mb-2 mt-4">Cerrar el día (Corte Z)</h3>
          <ol className="list-decimal list-outside ml-5 text-sm space-y-1">
            <li>Ve a <strong>Opciones → Cerrar Caja</strong>.</li>
            <li>Ingresa tu conteo físico del cajón (billetes y monedas).</li>
            <li>El sistema comparará tu conteo físico contra el teórico (ventas - devoluciones + base +/- movimientos). Te mostrará si hay algún sobrante o faltante.</li>
            <li>Al aceptar, se guarda el Corte Z y el sistema cerrará tu sesión por seguridad.</li>
          </ol>
        </div>
        <ManualImagePlaceholder description="Captura de la pantalla del Corte Z mostrando el resumen de caja." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          9. Modos especiales
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-md">
            <h3 className="font-bold text-orange-800 mb-1">🧪 Modo Prueba</h3>
            <p className="text-sm text-orange-900">Si ves una banda naranja arriba, estás en simulación. Ninguna venta ni movimiento afectará la base de datos real. <strong>Solo el dueño</strong> puede activar o desactivar este modo desde su cuenta principal. Muy útil para practicar.</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-md">
            <h3 className="font-bold text-gray-800 mb-1">📶 Modo Offline</h3>
            <p className="text-sm text-gray-600">Si pierdes el internet, el POS seguirá funcionando con tu inventario cacheado. Las ventas quedarán guardadas en tu dispositivo. Verás un contador "X pendientes" que se sincronizará automáticamente cuando regrese la conexión.</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          10. Atajos de teclado útiles
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
            <kbd className="bg-white border border-gray-300 px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm">F1</kbd>
            <span className="text-sm text-gray-600">Refrescar POS</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
            <kbd className="bg-white border border-gray-300 px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm">F2</kbd>
            <span className="text-sm text-gray-600">Buscar producto</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
            <kbd className="bg-white border border-gray-300 px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm">F3</kbd>
            <span className="text-sm text-gray-600">Agregar cliente</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
            <kbd className="bg-white border border-gray-300 px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm">F7</kbd>
            <span className="text-sm text-gray-600">Ir a Pago</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
            <kbd className="bg-white border border-gray-300 px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm">Enter</kbd>
            <span className="text-sm text-gray-600">Imprimir / Confirmar</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
            <kbd className="bg-white border border-gray-300 px-2 py-1 rounded text-xs font-bold text-gray-700 shadow-sm">Esc</kbd>
            <span className="text-sm text-gray-600">Cerrar modales</span>
          </div>
        </div>
      </section>
      
      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          11. Solución de problemas comunes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-700">Situación</th>
                <th className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-700">Solución</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Modal de variantes selecciona la primera sola</td>
                <td className="px-4 py-3 text-gray-600">Usa las flechas <kbd className="bg-gray-200 px-1 rounded">↑</kbd><kbd className="bg-gray-200 px-1 rounded">↓</kbd> de tu teclado para elegir, <kbd className="bg-gray-200 px-1 rounded">Enter</kbd> solo confirma cuando tiene el foco (borde azul) visible.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">El ticket no se imprimió</td>
                <td className="px-4 py-3 text-gray-600">Puedes reimprimir desde el <strong>Dashboard principal → Ventas</strong> → selecciona el ticket → botón <strong>Reimprimir</strong>.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Me equivoqué en un movimiento de caja</td>
                <td className="px-4 py-3 text-gray-600">El movimiento ya quedó registrado y aparecerá en el corte Z. Avísale a tu jefe para que lo tome en cuenta contablemente.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Cliente quiere editar una venta ya cobrada</td>
                <td className="px-4 py-3 text-gray-600">Solo el vendedor (dueño o admin) tiene los permisos para editar ventas procesadas desde su propio panel de control.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
