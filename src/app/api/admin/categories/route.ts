// src/app/api/admin/categories/route.ts
//
// Phase 15E — category list for the admin Categories screen. Category
// architecture decision: Product.category stays a free-form string (see
// catalogCategories.ts header) — this just reads the live distinct values
// + bounded per-category counts via one aggregation (no N+1).

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getCategoriesWithCounts } from "@/lib/catalogCategories";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const admin = await requireAdmin(req);
        if (!admin) {
            return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
        }

        const categories = await getCategoriesWithCounts();
        return NextResponse.json({ success: true, categories });
    } catch (error) {
        console.error("GET_ADMIN_CATEGORIES_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to fetch categories" }, { status: 500 });
    }
}
