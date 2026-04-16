import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ── Pago completado — dinero queda retenido en la cuenta de la plataforma ──
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const orderIds: string[] = (session.metadata?.orderIds || "").split(",").filter(Boolean);
    const paymentIntentId: string = session.payment_intent || "";

    if (orderIds.length > 0) {
      // Marcar como PAID y guardar el paymentIntentId para futura liberación
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: {
          status: "PAID",
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } as any : {}),
        },
      });
      console.log(`Orders ${orderIds.join(", ")} marked as PAID — funds held in platform account`);
    }
    // ⚠️ NO se transfiere nada al vendedor aquí — el dinero queda retenido
    // La liberación ocurre cuando el comprador confirma recepción (o admin la aprueba)
  }

  // ── Cuenta de vendedor actualizada en Stripe ──────────────────────────────
  if (event.type === "account.updated") {
    const account = event.data.object as any;
    if (account.id) {
      const status = account.charges_enabled
        ? "active"
        : account.details_submitted
        ? "pending_verification"
        : "pending";

      await (prisma.user as any).updateMany({
        where: { stripeAccountId: account.id },
        data: { stripeConnectStatus: status },
      });
    }
  }

  return new NextResponse(null, { status: 200 });
}
