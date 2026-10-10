export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/apiAuth";
import { createOffer, listOffers, type OfferInput } from "@/lib/adminOffers";
import type { OfferStatus } from "@/models/Offer";

export async function GET(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const url = new URL(req.url);
        const result = await listOffers({
            status: (url.searchParams.get("status") as OfferStatus | null) ?? undefined,
            campaignId: url.searchParams.get("campaignId") ?? undefined,
            page: Number(url.searchParams.get("page") ?? 1),
            limit: Number(url.searchParams.get("limit") ?? 25),
        });
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("ADMIN_OFFERS_LIST_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to load offers" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });

    try {
        await connectDB();
        const body = (await req.json().catch(() => ({}))) as OfferInput;
        const offer = await createOffer(body);
        return NextResponse.json({ success: true, offer }, { status: 201 });
    } catch (error) {
        console.error("ADMIN_OFFER_CREATE_ERROR", error);
        const message = error instanceof Error ? error.message : "Failed to create offer";
        return NextResponse.json({ success: false, message }, { status: 400 });
    }
}
