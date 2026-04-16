"use server";

import { stripe } from "@/lib/stripe";
import { getSessionUser } from "@/app/actions/auth";
import { headers } from "next/headers";

interface StripeLineItem {
  price_data: {
    currency: string;
    product_data: {
      name: string;
      images?: string[];
      description?: string;
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

    const host = (await headers()).get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;

    const lineItems: StripeLineItem[] = data.items.map((item) => {
      // Nombre con talla para que Stripe lo muestre claramente
      // item.size puede ser "5", "7", "M", etc. — siempre incluirlo si existe y no es genérico
      const sizeLabel = item.size && item.size !== 'Único' && item.size !== '' ? item.size : null;
      const colorLabel = item.color && item.color !== 'Único' && item.color !== '' ? item.color : null;
      const sizePart = [colorLabel, sizeLabel].filter(Boolean).join(' / ');
      // Si el productName ya tiene [algo] al final, agregar talla después
      const displayName = sizePart ? `${item.productName} — Talla ${sizePart}` : item.productName;

      // Stripe solo acepta URLs absolutas con https:// — no base64, no rutas relativas
      const imageUrl = item.image && item.image.startsWith('https://') ? [item.image] : [];

      return {
        price_data: {
          currency: "mxn",
          product_data: {
            name: displayName,
            images: imageUrl,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/mis-pedidos?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        orderIds: data.orderIds.join(","),
      },
    });

    return { success: true, url: session.url };
  } catch (error: any) {
    console.error("Error creating stripe session:", error);
    return { success: false, error: error.message || "No se pudo iniciar el pago." };
  }
}
