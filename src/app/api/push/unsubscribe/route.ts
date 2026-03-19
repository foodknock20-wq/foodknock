export const dynamic = "force-dynamic";

// src/app/api/push/unsubscribe/route.ts
// POST — marks a subscription as inactive when user turns off notifications.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const { endpoint } = await req.json();

        if (!endpoint) {
            return NextResponse.json(
                { success: false, message: "Endpoint required" },
                { status: 400 }
            );
        }

        await PushSubscription.findOneAndUpdate(
            { endpoint },
            { $set: { isActive: false } }
        );

        return NextResponse.json({ success: true, message: "Unsubscribed" });
    } catch (error) {
        console.error("PUSH_UNSUBSCRIBE_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to unsubscribe" },
            { status: 500 }
        );
    }
}