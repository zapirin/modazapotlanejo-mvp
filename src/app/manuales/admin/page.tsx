import React from 'react';
import ManualImagePlaceholder from '@/components/ManualImagePlaceholder';

export default function ManualAdminPage() {
  return (
    <div className="space-y-12 text-gray-700">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
          Manual del Administrador
        </h1>
        <p className="text-lg text-gray-500">
          Guía exclusiva para el dueño/operador general de modazapotlanejo.com
        </p>
      </header>

      <div className="bg-red-50 border border-red-200 p-4 rounded-md text-sm text-red-900 mb-8">
        <strong>Atención:</strong> Las funciones descritas aquí son críticas y afectan el comportamiento de todo el marketplace. Úsalas con precaución.
      </div>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          1. Aprobar solicitudes de vendedores
        </h2>
        <p className="mb-4">Ve a <strong>Admin → Solicitudes</strong> para revisar, aprobar o rechazar cada solicitud de registro nueva. Al aprobar una solicitud, el sistema automáticamente:</p>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li>Crea el usuario con el rol <code className="bg-gray-100 px-1 rounded text-sm text-blue-600">SELLER</code>.</li>
          <li>Le asigna el plan de suscripción que pidió (Básico, Estándar, Pro o Empresarial).</li>
          <li>Activa o desactiva el POS (Punto de Venta) según las características del plan elegido.</li>
          <li>Envía un correo electrónico de bienvenida al vendedor con su contraseña temporal y el branding del dominio donde se registró.</li>
        </ul>
        <ManualImagePlaceholder description="Captura de la vista de Solicitudes Pendientes en el panel de administrador." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          2. Crear vendedor manualmente
        </h2>
        <p className="mb-4">
          Si necesitas registrar a un vendedor directamente sin que pase por el formulario público del marketplace:
        </p>
        <ol className="list-decimal list-outside ml-5 space-y-2 mb-6">
          <li>Ve a <strong>Admin → Marketplace → Vendedores</strong>.</li>
          <li>Pulsa el botón <strong>+ Crear Vendedor</strong>.</li>
          <li>Introduce sus datos: nombre comercial, correo, teléfono y el plan inicial que le otorgarás.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          3. Editor de planes de suscripción
        </h2>
        <p className="mb-4">En <strong>Admin → Marketplace → 💼 Planes</strong> puedes editar las opciones que ven los vendedores al registrarse.</p>
        <ul className="list-disc list-outside ml-5 space-y-3 mb-6">
          <li><strong>Textos visuales:</strong> Nombre del plan, precio mensual y una etiqueta destacada opcional (ej. "⭐ Popular", "🚀 Recomendado").</li>
          <li><strong>Límites:</strong> Cantidad máxima de sucursales, cajeros y productos (0 significa ilimitados).</li>
          <li><strong>Características:</strong> Los bullets (puntos) que aparecen en la tarjeta del plan para convencer al vendedor.</li>
          <li><strong>Casilla "Incluye POS":</strong> Si la desmarcas, ese plan es exclusivamente para venta en línea (sin sucursales ni cajeros). Suele usarse para el plan gratuito.</li>
          <li><strong>Casilla "Resaltado":</strong> Le pone un borde azul o color fuerte a la tarjeta para que llame la atención.</li>
          <li><strong>Casilla "Oculto":</strong> Para desactivar el plan y que ya no se muestre en el registro público.</li>
          <li>Puedes <strong>Reordenar</strong> la posición en que aparecen con las flechas ↑↓ y eliminarlos con 🗑.</li>
        </ul>
        <p className="text-sm font-semibold">Al pulsar "💾 Guardar Planes", los cambios se reflejan inmediatamente en la página pública de registro.</p>
        <ManualImagePlaceholder description="Captura de pantalla del Editor de Planes en el panel de control." />
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          4. Gestionar vendedores activos
        </h2>
        <p className="mb-4">En <strong>Admin → Marketplace → Vendedores</strong> puedes administrar a las tiendas ya aprobadas:</p>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li><strong>Activar/desactivar POS:</strong> Controla manualmente si ese vendedor tiene acceso al sistema de caja (toggle verde).</li>
          <li><strong>Ajustar plan y límites:</strong> Aplica un plan completo con el botón "Asignar Plan Rápido" o edita sus límites individualmente (útil para vendedores con tratos especiales).</li>
          <li><strong>Comisión y mensualidad:</strong> Ajusta el % de comisión que le cobras por cada venta realizada y su cuota mensual (si aplica).</li>
          <li><strong>Contacto:</strong> Ver rápidamente su teléfono y abrir conversación de WhatsApp.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          5. Marcas y dominios
        </h2>
        <div className="space-y-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-1">Marcas</h3>
            <p className="text-sm">En <strong>Admin → Marketplace → Marcas</strong> puedes activar, desactivar o eliminar marcas del catálogo global. Las marcas desactivadas se ocultan del marketplace y muestran un banner amarillo de advertencia en el panel para el administrador.</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-1">Dominios Independientes</h3>
            <p className="text-sm mb-2">En <strong>Admin → Marketplace → Dominios</strong> puedes configurar dominios satélite (ej. kalexafashion.com o zonadelvestir.com). Cada uno tiene logo, colores y textos independientes.</p>
            <p className="text-sm font-medium text-blue-700">Comportamiento "Single-Vendor":</p>
            <p className="text-sm">Si asignas un <code className="bg-white px-1">sellerId</code> específico a un dominio, se convierte en la tienda exclusiva de ese vendedor. Automáticamente ocultará los productos de los demás y quitará los textos de "Compra Protegida" globales (ya que el trato es directo con esa tienda).</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          6. Configuración global del marketplace
        </h2>
        <p className="mb-4">En <strong>Admin → Marketplace → Sitio</strong> ajustas variables globales:</p>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li>Logotipo, título del sitio y URLs legales (Términos, Privacidad).</li>
          <li>El color de marca principal para cada dominio.</li>
          <li><strong>Visibilidad de precios sin login:</strong> Decide si los usuarios no registrados pueden ver precios. Se configura a nivel global o específico por dominio. Afecta tanto al catálogo general como a las páginas públicas de cada vendedor.</li>
        </ul>

        <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">6.1 Listones de Anuncio</h3>
        <p className="mb-2">Son las barras delgadas en la parte superior del sitio para avisos. Se gestionan de forma descentralizada:</p>
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          <li><strong>Para modazapotlanejo y zonadelvestir:</strong> Admin → Marketplace → Sitio → "Listón de Anuncio por Sitio".</li>
          <li><strong>Para tiendas independientes (kalexafashion):</strong> Admin → Marketplace → Marcas → Editar Marca → "Listón de Anuncio".</li>
          <li><strong>Para la página de cada vendedor (/vendor/X):</strong> Cada vendedor configura el suyo desde su propio panel (no necesitas hacerlo tú).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          7. Tareas y acciones rápidas
        </h2>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-700">Lo que quieres hacer</th>
                <th className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-700">Dónde ir y qué presionar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Darle POS a un vendedor con plan Básico (gratis)</td>
                <td className="px-4 py-3 text-gray-600">Admin → Marketplace → Vendedores → Activar el "toggle" verde de POS.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Subir el límite de productos de un vendedor especial</td>
                <td className="px-4 py-3 text-gray-600">Admin → Marketplace → Vendedores → Editar su valor de "Max Productos".</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Cobrarle 3% de comisión a un vendedor específico</td>
                <td className="px-4 py-3 text-gray-600">Admin → Marketplace → Vendedores → Editar campo "Comisión %".</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Ocultar temporalmente el plan Empresarial del registro</td>
                <td className="px-4 py-3 text-gray-600">Admin → Marketplace → 💼 Planes → Hacer clic en el icono 🙈 del plan.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Resetear la contraseña perdida de un vendedor</td>
                <td className="px-4 py-3 text-gray-600">Admin → Marketplace → Vendedores → Botón "Resetear Contraseña" (genera una nueva y se la envía).</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900 bg-gray-50/50">Ver cuánto he ganado en comisiones por ventas</td>
                <td className="px-4 py-3 text-gray-600">Reportes → Comisiones del Marketplace (selecciona el mes).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
          8. Servidor y despliegues técnicos
        </h2>
        <p className="mb-4">Para cuestiones de mantenimiento avanzado. El proyecto está alojado en un servidor VPS de Hostinger:</p>
        <ul className="list-disc list-outside ml-5 space-y-1 mb-6 font-mono text-sm text-gray-600 bg-gray-50 p-4 rounded border border-gray-200">
          <li>IP del servidor: <span className="text-blue-600">187.124.158.239</span></li>
          <li>Administrador de procesos: <span className="text-blue-600">PM2</span> (proceso llamado `modazapo`)</li>
          <li>Zona horaria del sistema: <span className="text-blue-600">America/Mexico_City</span></li>
          <li>
            Comando obligatorio tras cambios de código:<br />
            <code className="bg-gray-200 text-black px-2 py-1 rounded mt-2 inline-block">npm run build && pm2 restart modazapo</code>
          </li>
        </ul>
        <p className="text-sm text-gray-500">Para una vista técnica completa del sistema, consulta el archivo <code className="bg-gray-100 px-1">CONTEXTO.md</code>.</p>
      </section>
    </div>
  );
}
