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

  const session = event.data.object as any;

  if (event.type === "checkout.session.completed") {
    const orderIds = session.metadata?.orderIds?.split(",");

    if (orderIds && orderIds.length > 0) {
      await prisma.order.updateMany({
        where: {
          id: { in: orderIds },
        },
        data: {
          status: "PAID",
        },
      });
      console.log(`Orders ${orderIds.join(", ")} updated to PAID`);
    }
  }

  return new NextResponse(null, { status: 200 });
}
