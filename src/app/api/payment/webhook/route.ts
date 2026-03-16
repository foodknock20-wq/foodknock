export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest("hex");

    if (expected !== signature) {
      return NextResponse.json({ success: false });
    }

    const event = JSON.parse(body);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;

      await connectDB();

      const existing = await Order.findOne({
        razorpayPaymentId: payment.id,
      });

      if (existing) {
        return NextResponse.json({ success: true });
      }

      console.log("Webhook payment captured:", payment.id);

      // Optional:
      // Here you could call verify logic if needed
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("WEBHOOK ERROR", err);
    return NextResponse.json({ success: false });
  }
}