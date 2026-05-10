import React from 'react';
import ManualImagePlaceholder from '@/components/ManualImagePlaceholder';

export default function ManualVendedorPage() {
  return (
    <div className="space-y-12 text-gray-700">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
          Manual del Vendedor
        </h1>
        <p className="text-lg text-gray-500">
          Guía para dueños de tienda registrados en modazapotlanejo.com y zonadelvestir.com
        </p>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          1. Registrarte y empezar
        </h2>
        <ol className="list-decimal list-outside ml-5 space-y-2 mb-6">
          <li>Entra a <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono">/register/seller</code> y elige un plan (Básico es gratis siempre).</li>
          <li>El admin recibe tu solicitud y la aprueba; te llega un correo con tu contraseña temporal.</li>
          <li>Inicia sesión y cambia la contraseña en <strong>Configuración → Mi Perfil</strong>.</li>
        </ol>
        
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md text-sm text-blue-800 mb-6">
          <p className="font-semibold mb-1">Nota sobre los planes:</p>
          <p>El plan <strong>Básico</strong> es solo marketplace (catálogo + analítica básica) y NO incluye POS. Los planes de paga (Estándar / Pro / Empresarial) sí incluyen POS, sucursales y cajeros. El admin puede activarte el POS manualmente aunque estés en Básico.</p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          2. Configurar tu tienda
        </h2>
        <ul className="list-disc list-outside ml-5 space-y-3 mb-6">
          <li><strong>Configuración → Tienda y facturación:</strong> nombre comercial, logo, dirección, Código Postal, RFC, política de devoluciones.</li>
          <li><strong>Configuración → Sucursales:</strong> agrega cada sucursal/almacén físico. Estas son las "tiendas" o "bodegas" donde se descuenta el inventario.</li>
          <li><strong>Configuración → Métodos de pago:</strong> define cuáles aparecen en el POS (Efectivo, Clip, Zettle, Transferencia, etc.).</li>
          <li><strong>Configuración → Niveles de precio:</strong> descuentos automáticos por volumen (ej. de 6+ piezas baja a $X).</li>
          <li><strong>Configuración → Denominaciones:</strong> monedas/billetes para el conteo de abrir caja y del corte Z.</li>
        </ul>
        <ManualImagePlaceholder description="Captura del menú de configuración de la tienda mostrando las opciones principales." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          3. Subir productos
        </h2>
        <p className="mb-4">
          Ve a <strong>Productos → + Nuevo Modelo</strong>. El proceso es un stepper de 3 pasos:
        </p>
        <ul className="space-y-4 mb-6">
          <li className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-1">Paso 1: Información Básica</h3>
            <p className="text-sm">Nombre, marca, proveedor, categoría, descripción, etiquetas, fotos, precio público y mayoreo.</p>
          </li>
          <li className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-1">Paso 2: Atributos</h3>
            <p className="text-sm">Variantes como talla, color, etc. En la parte superior verás el nombre del producto para identificarlo.</p>
          </li>
          <li className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-1">Paso 3: Inventario</h3>
            <p className="text-sm">Stock inicial por sucursal y combinación de composición de mayoreo (Corrida, Paquete, Caja).</p>
          </li>
        </ul>
        <p className="mb-4">
          Al guardar, el producto entra al catálogo del marketplace y al POS. Para duplicar un producto similar usa el botón <strong>"Duplicar"</strong> en la lista.
        </p>
        <ManualImagePlaceholder description="Captura del formulario de creación de producto (Paso 1 o Paso 2)." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          4. Etiquetas (tags)
        </h2>
        <p className="mb-4">
          Las etiquetas son palabras clave (ej. "Bootcut", "Skinny", "Plus") que ayudan al comprador a filtrar en el catálogo. Al crear/editar un producto puedes:
        </p>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li>Escribir y elegir una etiqueta existente.</li>
          <li>Si no existe, pulsar <strong>"+ Crear"</strong> para agregarla.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          5. Equipo y cajeros
        </h2>
        <p className="mb-4">Ve a <strong>Configuración → Equipo</strong>, donde encontrarás dos pestañas:</p>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg p-5">
            <h3 className="font-bold text-blue-700 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
              Cajeros
            </h3>
            <p className="text-sm">Tienen acceso al POS con tu tienda. Define qué sucursales pueden operar y qué permisos tienen (devoluciones, reportes, comisiones, cortes Z, crear productos).</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-5">
            <h3 className="font-bold text-green-700 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Vendedores de Piso
            </h3>
            <p className="text-sm">Personas que cobran comisión por venta (no inician sesión). El POS los asigna a cada venta para registrar sus comisiones.</p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-sm text-yellow-800 mb-6">
          <p><strong>Nota sobre eliminar personal:</strong> Para borrar permanentemente un cajero o vendedor de piso desactivado, el botón <strong>"🗑 Eliminar"</strong> aparece solo cuando ya está desactivado. Si eliminas un vendedor de piso, su historial de comisiones queda vacío (las ventas viejas pierden el nombre del vendedor pero todo lo demás se conserva: monto, productos, fecha, etc.).</p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          6. Reportes
        </h2>
        <p className="mb-4">La sección de <strong>Reportes</strong> tiene cuatro pestañas con filtros por período y sucursal:</p>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li><strong>Ventas:</strong> KPIs, productos más vendidos, ranking por proveedor.</li>
          <li><strong>Comisiones:</strong> Desglose por vendedor de piso.</li>
          <li><strong>Cortes Z:</strong> Cada sesión de caja cerrada con KPIs y desglose por método de pago.</li>
          <li><strong>Ganancias:</strong> Utilidad por producto (precio venta − costo).</li>
        </ul>
        <ManualImagePlaceholder description="Captura de pantalla de la vista de Reportes o KPIs." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          7. Programa de Puntos (Lealtad)
        </h2>
        <p className="mb-4">
          Activa el programa de lealtad para tus clientes. Define cuántos puntos da cada peso gastado y cuántos pesos vale canjear cada punto. Aplica tanto en el marketplace como en el POS.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          8. Cupones
        </h2>
        <p className="mb-4">
          Crea códigos de descuento (porcentaje o monto fijo) que aplican en el carrito del marketplace para incentivar compras.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          9. Modo Prueba
        </h2>
        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-md text-sm text-purple-900 mb-6">
          <p>
            Ve a <strong>Configuración → Mi Perfil → Modo Prueba</strong>. Si lo activas, tú y todos tus cajeros (en cualquier navegador o dispositivo) entran en modo simulación.
          </p>
          <p className="mt-2 font-medium">Las ventas, devoluciones, traspasos y movimientos de caja NO se guardan en este modo.</p>
          <p className="mt-2">Es muy útil para entrenar nuevos cajeros sin afectar tu inventario o contabilidad real. Solo tú (el dueño) puedes prenderlo y apagarlo.</p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          10. Pedidos del marketplace
        </h2>
        <p className="mb-4">
          Cuando un comprador del marketplace ordena algo, llega aquí. Puedes:
        </p>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li>Aceptar o rechazar el pedido.</li>
          <li>Editar los artículos si negocias cambios con el comprador.</li>
          <li>Enviar guía de Skydropx (si configuraste credenciales).</li>
        </ul>
        <p className="text-sm font-semibold">Al aceptar un pedido el inventario se descuenta automáticamente.</p>
        <ManualImagePlaceholder description="Captura de la vista de un Pedido del Marketplace (detalle)." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          11. Inventario
        </h2>
        <p className="mb-4">
          Vista por producto con stock por sucursal. Haz clic en una celda para abrir el modal de ajuste, donde ingresas la cantidad final exacta para cada sucursal. Cuenta con búsqueda por nombre o modelo con botón "x" para limpiar.
        </p>
        
        <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">11.1 Listón de anuncio en mi página pública</h3>
        <p className="mb-4">
          Ve a <strong>Configuración → Tienda y facturación → 📢 Listón de Anuncio</strong>.
        </p>
        <p className="mb-4">
          Es una barra delgada arriba de tu página de vendedor en el marketplace (la que ven los compradores al entrar a tu tienda). Tiene un botón de ON/OFF, texto libre y modo <strong>Fijo</strong> o <strong>Deslizable</strong> (de derecha a izquierda). Útil para promociones o avisos puntuales.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          12. Calificaciones y mensajes
        </h2>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li><strong>Calificaciones:</strong> Las reseñas que tus compradores te dejaron.</li>
          <li><strong>Mensajes:</strong> Hilo de conversación con compradores sobre pedidos en curso.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          13. Mi Cuenta y Mis Ganancias
        </h2>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li><strong>Mi Cuenta:</strong> Datos personales y de facturación del dueño.</li>
          <li><strong>Mis Ganancias:</strong> Ventas del periodo descontando comisión del marketplace.</li>
        </ul>
      </section>
    </div>
  );
}
