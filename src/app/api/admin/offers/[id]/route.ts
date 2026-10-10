export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { updateOffer, type OfferUpdateInput } from "@/lib/adminOffers";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const { id } = await params;
        const body = (await req.json().catch(() => ({}))) as OfferUpdateInput;
        const offer = await updateOffer(id, body);
        return NextResponse.json({ success: true, offer });
    } catch (error) {
        console.error("ADMIN_OFFER_UPDATE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to update offer";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
