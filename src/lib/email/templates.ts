import { sendEmail } from './resend';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// BASE LAYOUT
// Wrapper HTML reutilizable para todas las plantillas
// ---------------------------------------------------------------------------

function baseLayout({
  brandName = 'Moda Zapotlanejo',
  brandColor = '#2563eb',
  title,
  body,
}: {
  brandName?: string;
  brandColor?: string;
  title: string;
  body: string;
}) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

              <!-- Header -->
              <tr>
                <td style="background:${brandColor};padding:28px 40px;">
                  <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;text-transform:uppercase;">
                    ${brandName}
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:36px 40px;">
                  ${body}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                    ${brandName} &mdash; Este correo fue generado automáticamente, no respondas a este mensaje.<br/>
                    <a href="${APP_URL}" style="color:#94a3b8;">${APP_URL}</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Botón CTA reutilizable
function ctaButton(text: string, url: string, color = '#2563eb') {
  return `
    <div style="margin:28px 0;">
      <a href="${url}"
         style="display:inline-block;padding:14px 28px;background:${color};color:#ffffff;
                text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;
                letter-spacing:0.3px;">
        ${text}
      </a>
    </div>
  `;
}

// Línea divisora
const divider = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;

// Tabla de items de un pedido
function orderItemsTable(items: { productName: string; quantity: number; price: number; color?: string | null; size?: string | null }[]) {
  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 12px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;">
        ${item.productName}
        ${item.color || item.size ? `<br/><span style="font-size:12px;color:#64748b;">${[item.color, item.size].filter(Boolean).join(' / ')}</span>` : ''}
      </td>
      <td style="padding:10px 12px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;text-align:center;">
        ${item.quantity}
      </td>
      <td style="padding:10px 12px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">
        $${(item.price * item.quantity).toFixed(2)}
      </td>
    </tr>
  `).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:collapse;margin:20px 0;overflow:hidden;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Producto</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#64748b;text-align:center;text-transform:uppercase;letter-spacing:0.5px;">Cant.</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#64748b;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Importe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// 1. NUEVO PEDIDO — Para el VENDEDOR
// Se dispara cuando un comprador hace un pedido en el marketplace
// ---------------------------------------------------------------------------

export async function sendNewOrderToSeller({
  sellerEmail,
  sellerName,
  buyerName,
  orderNumber,
  orderId,
  items,
  total,
  notes,
  brandName,
}: {
  sellerEmail: string;
  sellerName: string;
  buyerName: string;
  orderNumber: number;
  orderId: string;
  items: { productName: string; quantity: number; price: number; color?: string | null; size?: string | null }[];
  total: number;
  notes?: string | null;
  brandName?: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
      ¡Nuevo pedido recibido!
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hola <strong>${sellerName}</strong>, tienes un nuevo pedido esperando tu confirmación.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
        Pedido #${orderNumber}
      </p>
      <p style="margin:6px 0 0;font-size:14px;color:#1e293b;">
        Comprador: <strong>${buyerName}</strong>
      </p>
      ${notes ? `<p style="margin:6px 0 0;font-size:14px;color:#475569;">Nota: ${notes}</p>` : ''}
    </div>

    ${orderItemsTable(items)}

    <div style="text-align:right;margin-top:8px;">
      <p style="font-size:18px;font-weight:800;color:#1e293b;margin:0;">
        Total: <span style="color:#2563eb;">$${total.toFixed(2)}</span>
      </p>
    </div>

    <p style="font-size:14px;color:#64748b;margin-top:24px;">
      Tienes <strong>48 horas</strong> para aceptar o rechazar este pedido antes de que expire automáticamente.
    </p>

    ${ctaButton('Ver y Gestionar Pedido', `${APP_URL}/orders`)}
    ${divider}
    <p style="font-size:12px;color:#94a3b8;margin:0;">
      Si tienes dudas sobre este pedido, puedes contactar al comprador desde la sección de mensajes.
    </p>
  `;

  return sendEmail({
    to: sellerEmail,
    subject: `🛍️ Nuevo pedido #${orderNumber} de ${buyerName}`,
    html: baseLayout({ brandName, title: `Nuevo pedido #${orderNumber}`, body }),
  });
}

// ---------------------------------------------------------------------------
// 2. PEDIDO CONFIRMADO — Para el COMPRADOR
// Se dispara cuando el vendedor acepta el pedido
// ---------------------------------------------------------------------------

export async function sendOrderConfirmedToBuyer({
  buyerEmail,
  buyerName,
  sellerName,
  orderNumber,
  items,
  total,
  sellerNotes,
  brandName,
}: {
  buyerEmail: string;
  buyerName: string;
  sellerName: string;
  orderNumber: number;
  items: { productName: string; quantity: number; price: number; color?: string | null; size?: string | null }[];
  total: number;
  sellerNotes?: string | null;
  brandName?: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
      ¡Tu pedido fue confirmado!
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hola <strong>${buyerName}</strong>, <strong>${sellerName}</strong> ha confirmado tu pedido. 🎉
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
        ✓ Pedido #${orderNumber} Confirmado
      </p>
      ${sellerNotes ? `<p style="margin:8px 0 0;font-size:14px;color:#166534;">Mensaje del vendedor: "${sellerNotes}"</p>` : ''}
    </div>

    ${orderItemsTable(items)}

    <div style="text-align:right;margin-top:8px;">
      <p style="font-size:18px;font-weight:800;color:#1e293b;margin:0;">
        Total: <span style="color:#2563eb;">$${total.toFixed(2)}</span>
      </p>
    </div>

    ${ctaButton('Ver mis pedidos', `${APP_URL}/orders`)}
  `;

  return sendEmail({
    to: buyerEmail,
    subject: `✅ Pedido #${orderNumber} confirmado por ${sellerName}`,
    html: baseLayout({ brandName, title: `Pedido #${orderNumber} confirmado`, body }),
  });
}

// ---------------------------------------------------------------------------
// 3. PEDIDO RECHAZADO — Para el COMPRADOR
// Se dispara cuando el vendedor rechaza el pedido
// ---------------------------------------------------------------------------

export async function sendOrderRejectedToBuyer({
  buyerEmail,
  buyerName,
  sellerName,
  orderNumber,
  sellerNotes,
  brandName,
}: {
  buyerEmail: string;
  buyerName: string;
  sellerName: string;
  orderNumber: number;
  sellerNotes?: string | null;
  brandName?: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
      Actualización sobre tu pedido
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hola <strong>${buyerName}</strong>, lamentablemente <strong>${sellerName}</strong> no puede procesar tu pedido en este momento.
    </p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#dc2626;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
        Pedido #${orderNumber} — No disponible
      </p>
      ${sellerNotes ? `<p style="margin:8px 0 0;font-size:14px;color:#991b1b;">Motivo: "${sellerNotes}"</p>` : ''}
    </div>

    <p style="font-size:14px;color:#64748b;">
      Puedes explorar otros fabricantes en el catálogo o contactar directamente al vendedor para más información.
    </p>

    ${ctaButton('Explorar catálogo', `${APP_URL}/catalog`)}
  `;

  return sendEmail({
    to: buyerEmail,
    subject: `Pedido #${orderNumber} — Actualización de ${sellerName}`,
    html: baseLayout({ brandName, title: `Pedido #${orderNumber} no disponible`, body }),
  });
}

// ---------------------------------------------------------------------------
// 4. BIENVENIDA AL COMPRADOR — Para el COMPRADOR
// Se dispara al registrarse como comprador
// ---------------------------------------------------------------------------

export async function sendWelcomeToBuyer({
  email,
  name,
  isWholesale,
  brandName,
}: {
  email: string;
  name: string;
  isWholesale: boolean;
  brandName?: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
      ¡Bienvenido${isWholesale ? ' mayorista' : ''}, ${name}!
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Tu cuenta ha sido creada exitosamente. ${isWholesale
        ? 'Como comprador mayorista tendrás acceso a precios especiales y catálogos exclusivos de fabricantes.'
        : 'Ya puedes explorar el catálogo y hacer pedidos directamente a los mejores fabricantes.'}
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1e293b;">¿Qué puedes hacer?</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;color:#475569;line-height:1.8;">
        <li>Explorar catálogos de cientos de fabricantes</li>
        ${isWholesale ? '<li>Ver precios de mayoreo exclusivos</li>' : ''}
        <li>Hacer pedidos y rastrear su estado en tiempo real</li>
        <li>Guardar productos en tu lista de deseos</li>
        <li>Contactar directamente a los vendedores</li>
      </ul>
    </div>

    ${ctaButton('Explorar el catálogo', `${APP_URL}/catalog`)}
    ${divider}
    <p style="font-size:12px;color:#94a3b8;margin:0;">
      Tu correo de acceso es: <strong>${email}</strong>
    </p>
  `;

  return sendEmail({
    to: email,
    subject: `¡Bienvenido a ${brandName || 'Moda Zapotlanejo'}! Tu cuenta está lista`,
    html: baseLayout({ brandName, title: `Bienvenido a ${brandName || 'Moda Zapotlanejo'}`, body }),
  });
}

// ---------------------------------------------------------------------------
// 5. BIENVENIDA AL VENDEDOR APROBADO — Para el VENDEDOR
// Se dispara cuando admin aprueba una solicitud de vendedor
// ---------------------------------------------------------------------------

export async function sendWelcomeToSeller({
  email,
  name,
  storeName,
  tempPassword,
  brandName,
}: {
  email: string;
  name: string;
  storeName: string;
  tempPassword: string;
  brandName?: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
      ¡Tu tienda fue aprobada!
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hola <strong>${name}</strong>, tu solicitud para <strong>${storeName}</strong> ha sido aprobada. 
      Ya puedes acceder al Seller Center y comenzar a publicar tus productos.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;">
        Tus credenciales de acceso
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#1e293b;">
        <strong>Correo:</strong> ${email}
      </p>
      <p style="margin:0;font-size:14px;color:#1e293b;">
        <strong>Contraseña temporal:</strong>
        <span style="font-family:monospace;background:#dbeafe;padding:2px 8px;border-radius:4px;font-weight:700;">
          ${tempPassword}
        </span>
      </p>
    </div>

    <p style="font-size:14px;color:#64748b;margin:0 0 8px;">
      Te recomendamos cambiar tu contraseña en la sección de perfil al ingresar por primera vez.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1e293b;">Primeros pasos:</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;color:#475569;line-height:1.8;">
        <li>Configura el perfil de tu tienda</li>
        <li>Crea tus primeros productos con fotos y variantes</li>
        <li>Configura tus sucursales y punto de venta</li>
        <li>Define tus niveles de precio (menudeo / mayoreo)</li>
      </ul>
    </div>

    ${ctaButton('Ir al Seller Center', `${APP_URL}/dashboard`)}
  `;

  return sendEmail({
    to: email,
    subject: `🎉 ¡Tu tienda ${storeName} fue aprobada en ${brandName || 'Moda Zapotlanejo'}!`,
    html: baseLayout({ brandName, title: `Tienda aprobada: ${storeName}`, body }),
  });
}

// ---------------------------------------------------------------------------
// 6. ALERTA DE INVENTARIO BAJO — Para el VENDEDOR
// Se dispara cuando el stock de una variante cae a 5 o menos unidades
// ---------------------------------------------------------------------------

export async function sendLowInventoryAlert({
  sellerEmail,
  sellerName,
  items,
  brandName,
}: {
  sellerEmail: string;
  sellerName: string;
  items: { productName: string; variantName: string; stock: number; locationName?: string }[];
  brandName?: string;
}) {
  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 12px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;">
        ${item.productName}<br/>
        <span style="font-size:12px;color:#64748b;">${item.variantName}</span>
      </td>
      ${item.locationName ? `<td style="padding:10px 12px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">${item.locationName}</td>` : ''}
      <td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:center;">
        <span style="background:${item.stock === 0 ? '#fef2f2' : '#fff7ed'};color:${item.stock === 0 ? '#dc2626' : '#c2410c'};
                     padding:3px 10px;border-radius:20px;font-weight:700;font-size:13px;">
          ${item.stock === 0 ? 'Agotado' : `${item.stock} pz`}
        </span>
      </td>
    </tr>
  `).join('');

  const hasLocation = items.some(i => i.locationName);

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
      Alerta de inventario bajo
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hola <strong>${sellerName}</strong>, los siguientes productos tienen stock crítico y pueden quedar sin disponibilidad pronto.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #fed7aa;border-radius:8px;border-collapse:collapse;overflow:hidden;">
      <thead>
        <tr style="background:#fff7ed;">
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#c2410c;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Producto</th>
          ${hasLocation ? '<th style="padding:10px 12px;font-size:12px;font-weight:700;color:#c2410c;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Sucursal</th>' : ''}
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#c2410c;text-align:center;text-transform:uppercase;letter-spacing:0.5px;">Stock</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p style="font-size:14px;color:#64748b;margin-top:24px;">
      Te recomendamos reabastecer estos productos para no perder ventas.
    </p>

    ${ctaButton('Gestionar inventario', `${APP_URL}/inventory`, '#ea580c')}
  `;

  return sendEmail({
    to: sellerEmail,
    subject: `⚠️ Inventario bajo: ${items.length} producto${items.length > 1 ? 's' : ''} con stock crítico`,
    html: baseLayout({ brandName, title: 'Alerta de inventario bajo', body }),
  });
}

// ---------------------------------------------------------------------------
// 7. APARTADO POR VENCER — Para el CLIENTE del POS
// Se dispara 24h antes de que venza un apartado
// ---------------------------------------------------------------------------

export async function sendLayawayExpiringAlert({
  clientEmail,
  clientName,
  storeName,
  saleId,
  items,
  total,
  amountPaid,
  balance,
  dueDate,
  brandName,
}: {
  clientEmail: string;
  clientName: string;
  storeName: string;
  saleId: string;
  items: { productName: string; quantity: number; price: number }[];
  total: number;
  amountPaid: number;
  balance: number;
  dueDate: Date;
  brandName?: string;
}) {
  const formattedDate = dueDate.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;">
        ${item.productName}
      </td>
      <td style="padding:8px 12px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;text-align:center;">
        ${item.quantity}
      </td>
    </tr>
  `).join('');

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
      Tu apartado vence mañana
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hola <strong>${clientName}</strong>, te recordamos que tienes un apartado en <strong>${storeName}</strong> 
      que vence el <strong>${formattedDate}</strong>.
    </p>

    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
        Resumen de tu apartado
      </p>
      <p style="margin:8px 0 4px;font-size:14px;color:#1e293b;">
        Total: <strong>$${total.toFixed(2)}</strong>
      </p>
      <p style="margin:0 0 4px;font-size:14px;color:#1e293b;">
        Ya pagaste: <strong style="color:#16a34a;">$${amountPaid.toFixed(2)}</strong>
      </p>
      <p style="margin:0;font-size:15px;font-weight:800;color:#dc2626;">
        Resta pagar: $${balance.toFixed(2)}
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:collapse;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#64748b;text-align:left;text-transform:uppercase;">Producto</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#64748b;text-align:center;text-transform:uppercase;">Cant.</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <p style="font-size:14px;color:#64748b;">
      Visítanos antes de que expire para liquidar tu apartado y llevarte tus productos.
      Si no es posible, contáctanos para coordinar una prórroga.
    </p>
  `;

  return sendEmail({
    to: clientEmail,
    subject: `⏰ Tu apartado vence mañana — Saldo pendiente: $${balance.toFixed(2)}`,
    html: baseLayout({ brandName, title: 'Tu apartado vence mañana', body }),
  });
}

// ---------------------------------------------------------------------------
// 8. NOTIFICACIÓN DE ENVÍO — Para el COMPRADOR
// Se dispara cuando el vendedor genera la guía de envío
// ---------------------------------------------------------------------------

export async function sendShipmentNotification({
  buyerEmail,
  buyerName,
  sellerName,
  orderNumber,
  carrier,
  trackingNumber,
  labelUrl,
  estimatedDays,
  brandName,
}: {
  buyerEmail: string;
  buyerName: string;
  sellerName: string;
  orderNumber: number;
  carrier: string;
  trackingNumber: string;
  labelUrl?: string | null;
  estimatedDays?: number | null;
  brandName?: string;
}) {
  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">
      ¡Tu pedido va en camino! 📦
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
      Hola <strong>${buyerName}</strong>, <strong>${sellerName}</strong> ha enviado tu pedido #${orderNumber}.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:13px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
        Datos del envío
      </p>
      <p style="margin:0 0 6px;font-size:14px;color:#1e293b;">
        <strong>Paquetería:</strong> ${carrier}
      </p>
      <p style="margin:0 0 6px;font-size:14px;color:#1e293b;">
        <strong>No. de guía:</strong>
        <span style="font-family:monospace;background:#dcfce7;padding:2px 8px;border-radius:4px;font-weight:700;">
          ${trackingNumber}
        </span>
      </p>
      ${estimatedDays ? `<p style="margin:0;font-size:14px;color:#1e293b;"><strong>Entrega estimada:</strong> ${estimatedDays} día${estimatedDays > 1 ? 's' : ''} hábil${estimatedDays > 1 ? 'es' : ''}</p>` : ''}
    </div>

    <p style="font-size:14px;color:#64748b;">
      Puedes rastrear tu paquete directamente con la paquetería usando el número de guía, 
      o seguir el estado desde la sección "Mis Pedidos".
    </p>

    ${ctaButton('Ver mis pedidos', `${APP_URL}/orders`)}
  `;

  return sendEmail({
    to: buyerEmail,
    subject: `📦 Pedido #${orderNumber} enviado — Guía ${trackingNumber}`,
    html: baseLayout({ brandName, title: `Pedido #${orderNumber} enviado`, body }),
  });
}
