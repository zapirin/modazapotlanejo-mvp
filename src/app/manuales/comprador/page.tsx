import React from 'react';
import ManualImagePlaceholder from '@/components/ManualImagePlaceholder';

export default function ManualCompradorPage() {
  return (
    <div className="space-y-12 text-gray-700">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
          Manual del Comprador
        </h1>
        <p className="text-lg text-gray-500">
          Guía para clientes que compran en modazapotlanejo.com, zonadelvestir.com o kalexafashion.com
        </p>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          1. Buscar productos
        </h2>
        <ul className="list-disc list-outside ml-5 space-y-3 mb-6">
          <li><strong>Cajita de búsqueda:</strong> encuentra por nombre, SKU, marca, color, talla o etiqueta.</li>
          <li>
            <strong>Sidebar de filtros</strong> (todas colapsables, click en la flecha para abrir/cerrar):
            <ul className="list-circle list-outside ml-5 mt-2 space-y-1">
              <li><strong>Categorías</strong> y subcategorías (Damas, Caballeros, Niños, etc.)</li>
              <li><strong>Marcas</strong></li>
              <li><strong>Tallas</strong> — botones con todas las tallas disponibles (9, 11, 13, S, M, L…)</li>
              <li><strong>Colores</strong> — botones con todos los colores</li>
              <li><strong>Etiquetas</strong> — botones con palabras clave (Bootcut, Skinny, Plus, etc.)</li>
            </ul>
          </li>
          <li>
            <strong>Los filtros se combinan:</strong> puedes elegir talla 9 + color Negro + etiqueta Bootcut a la vez para resultados exactos.
          </li>
          <li>
            Botón <strong>"Limpiar filtros"</strong> arriba del sidebar borra todos los filtros activos.
          </li>
        </ul>
        <ManualImagePlaceholder description="Captura del catálogo mostrando el sidebar de filtros y la barra de búsqueda." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          2. Comprar
        </h2>
        <ol className="list-decimal list-outside ml-5 space-y-3 mb-6">
          <li>Haz clic en el producto y elige tus variantes (talla, color, cantidad).</li>
          <li>Presiona <strong>Agregar al carrito</strong>.</li>
          <li>Si tienes cuenta y dirección guardada, verás el costo de envío real (vía Skydropx).</li>
          <li>Si tu pedido califica para descuento por volumen, los precios bajarán automáticamente en el carrito.</li>
          <li>Aplica un cupón de descuento si tienes un código.</li>
          <li>Canjea puntos del programa de lealtad si participas.</li>
          <li>Paga de forma segura con tarjeta (Stripe) o con el método de pago que ofrezca el vendedor.</li>
        </ol>
        <ManualImagePlaceholder description="Captura de la vista del carrito de compras." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          3. Programa de Puntos
        </h2>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li>Cada vendedor define su propio programa de lealtad.</li>
          <li>Acumulas puntos por cada peso gastado en tiendas participantes.</li>
          <li>En el carrito, si tienes saldo suficiente, puedes canjearlos por descuento.</li>
          <li>Puedes revisar tu balance de puntos en <strong>Mi Cuenta → Puntos</strong>.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          4. Mis pedidos
        </h2>
        <p className="mb-4">
          En <strong>Mi Cuenta → Pedidos</strong> puedes ver el estado de cada pedido (Pendiente, Aceptado, Enviado, Completado, Rechazado). Si el vendedor ofrece guía de envío, el número de rastreo (tracking) aparecerá aquí.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          5. Lista de deseos
        </h2>
        <p className="mb-4">
          Presiona el corazón (❤) en cualquier producto que te guste. Se guardará en <strong>Mi Cuenta → Wishlist</strong> para que puedas volver a verlo después.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          6. Compra Protegida (solo marketplace multi-vendor)
        </h2>
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-md text-sm text-green-900 mb-6">
          <p>
            Si pagas con tarjeta en modazapotlanejo.com o zonadelvestir.com, <strong>el dinero queda retenido</strong> de forma segura hasta que recibas tu pedido y estés conforme.
          </p>
          <p className="mt-2 text-xs text-green-700">
            * No aplica en kalexafashion.com, ya que es un acuerdo directo con ese vendedor (pagas con tarjeta directo a su tienda).
          </p>
        </div>
        
        <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">6.1 Modo claro / oscuro</h3>
        <p className="mb-4">
          El sitio arranca siempre en <strong>modo claro</strong>. Si prefieres un tema oscuro, usa el botón ☀️/🌙 en la barra superior. Tu preferencia quedará guardada para futuras visitas a ese dominio.
        </p>

        <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">6.2 Listón de avisos</h3>
        <p className="mb-4">
          Si ves una franja delgada de colores con un texto arriba (a veces deslizándose de derecha a izquierda), es un <strong>anuncio</strong> del operador del marketplace o del vendedor en turno. Es solo informativo; pulsar la franja no hace ninguna acción, todo el contenido está en el texto.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          7. Mi Cuenta
        </h2>
        <p className="mb-4">En tu panel de control puedes gestionar:</p>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li><strong>Datos personales:</strong> nombre, correo, teléfono.</li>
          <li><strong>Direcciones:</strong> agrega y edita direcciones de envío. La que marques como predeterminada se usará automáticamente al pagar.</li>
          <li><strong>Pedidos:</strong> historial completo con estado actual.</li>
          <li><strong>Wishlist:</strong> productos que guardaste con el corazón.</li>
          <li><strong>Puntos:</strong> tu balance del programa de lealtad, separado por vendedor.</li>
          <li><strong>Cambiar contraseña.</strong></li>
        </ul>
        <ManualImagePlaceholder description="Captura del panel principal de Mi Cuenta (Dashboard del comprador)." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          8. Calificar un pedido
        </h2>
        <p className="mb-4">
          Cuando un pedido pasa a estado <strong>Completado</strong>, puedes dejar una reseña al vendedor y al producto desde <strong>Mi Cuenta → Pedidos → Calificar</strong>. Tus reseñas ayudan a otros compradores a tomar buenas decisiones y mejoran el posicionamiento de los buenos vendedores.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          9. Mensajes con el vendedor
        </h2>
        <p className="mb-4">
          Si tienes comentarios, dudas o necesitas acordar algo sobre tu pedido, puedes usar el hilo de mensajes directo con el vendedor en <strong>Mi Cuenta → Mensajes</strong>.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          10. Problemas comunes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-700">Problema</th>
                <th className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-700">Qué hacer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">No puedo iniciar sesión</td>
                <td className="px-4 py-3 text-gray-600">Pulsa <em>"¿Olvidaste tu contraseña?"</em> en la página de inicio de sesión.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Mi pedido lleva días en "Pendiente"</td>
                <td className="px-4 py-3 text-gray-600">El vendedor aún no lo ha aceptado. Mándale un mensaje desde <strong>Mi Cuenta → Mensajes</strong>.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Quiero devolver un producto</td>
                <td className="px-4 py-3 text-gray-600">Cada vendedor tiene su propia política de devoluciones. Contáctalo desde <strong>Mi Cuenta → Mensajes</strong> para acordar la devolución.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">El cupón no aplica</td>
                <td className="px-4 py-3 text-gray-600">Verifica que el código sea específicamente del vendedor al que le estás comprando y que siga vigente.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Cambié de opinión sobre el envío</td>
                <td className="px-4 py-3 text-gray-600">Mientras el vendedor <strong>no</strong> lo haya aceptado, puedes cancelar el pedido desde <strong>Mi Cuenta → Pedidos</strong>.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
