export const dynamic = "force-dynamic";

// src/app/api/orders/track/[orderId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import mongoose from "mongoose";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    await connectDB();

    const { orderId: rawOrderId } = await context.params;
    const orderId = decodeURIComponent(rawOrderId).replace(/^#/, "").trim();

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Order ID is required" },
        { status: 400 }
      );
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(orderId);

    const order = await Order.findOne(
      isObjectId ? { $or: [{ orderId }, { _id: orderId }] } : { orderId }
    )
      .select(
        "_id orderId customerName phone address landmark orderType items totalAmount status note createdAt"
      )
      .lean();

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "No order found with that ID. Please check and try again.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("TRACK_ORDER_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}