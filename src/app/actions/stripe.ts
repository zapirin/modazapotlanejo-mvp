"use server";

import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/app/actions/auth";
import { headers } from "next/headers";

interface StripeLineItem {
  price_data: {
    currency: string;
    product_data: {
      name: string;
      images?: string[];
    };
    unit_amount: number;
  };
  quantity: number;
}

export async function createCheckoutSession(data: {
  orderIds: string[];
  items: { productName: string; quantity: number; price: number; image?: string; size?: string; color?: string }[];
  total: number;
}) {
  try {
    const user = await getSessionUser();
    if (!user) {
      throw new Error("Debes iniciar sesión para pagar.");
    }

    // Obtener órdenes desde la BD con sus items — verificar que pertenezcan al comprador
    const orders = await prisma.order.findMany({
      where: { id: { in: data.orderIds }, buyerId: user.id },
      include: { items: true },
    });

    if (orders.length === 0) {
      throw new Error("No se encontraron los pedidos o no tienes permiso para pagarlos.");
    }

    const host = (await headers()).get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;

    // Construir line items desde los datos de la BD (no del cliente)
    const lineItems: StripeLineItem[] = [];

    for (const order of orders) {
      for (const item of order.items) {
        const sizeLabel = item.size && item.size !== 'Único' && item.size !== '' ? item.size : null;
        const colorLabel = item.color && item.color !== 'Único' && item.color !== '' ? item.color : null;
        const sizePart = [colorLabel, sizeLabel].filter(Boolean).join(' / ');
        const displayName = sizePart ? `${item.productName} — Talla ${sizePart}` : item.productName;

        lineItems.push({
          price_data: {
            currency: "mxn",
            product_data: { name: displayName },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        });
      }
    }

    // Agregar envío como ÚNICO line item para todo el carrito
    // (no por cada orden — el carrito cobra un solo envío a todo el pedido)
    const shippingCostMax = Math.max(0, ...orders.map(o => o.shippingCost || 0));
    if (shippingCostMax > 0) {
      const firstOrderWithShipping = orders.find(o => (o.shippingCost || 0) > 0);
      const carrierName = firstOrderWithShipping?.shippingCarrier || 'Paquetería';
      const serviceName = firstOrderWithShipping?.shippingServiceName || '';
      const shippingLabel = serviceName
        ? `Envío — ${carrierName} (${serviceName})`
        : `Envío — ${carrierName}`;

      lineItems.push({
        price_data: {
          currency: "mxn",
          product_data: { name: shippingLabel },
          unit_amount: Math.round(shippingCostMax * 100),
        },
        quantity: 1,
      });
    }

    const orderIds = orders.map(o => o.id);
    const totalDiscount = orders.reduce((sum, o) => sum + (o.discount || 0), 0);

    let stripeCouponId = undefined;
    if (totalDiscount > 0) {
      const stripeCoupon = await stripe.coupons.create({
        amount_off: Math.round(totalDiscount * 100),
        currency: 'mxn',
        duration: 'once',
        name: 'Cupón de Descuento',
      });
      stripeCouponId = stripeCoupon.id;
    }

    const sessionConfig: any = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/mis-pedidos?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        orderIds: orderIds.join(","),
      },
    };

    if (stripeCouponId) {
      sessionConfig.discounts = [{ coupon: stripeCouponId }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return { success: true, url: session.url };
  } catch (error: any) {
    console.error("Error creating stripe session:", error);
    return { success: false, error: error.message || "No se pudo iniciar el pago." };
  }
}
