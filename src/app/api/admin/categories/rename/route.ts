// src/app/api/admin/categories/rename/route.ts
//
// Phase 15E — rename a category across every product currently assigned to
// it. Admin-only, explicit allowlisted body shape (no mass assignment),
// bounded to the actual product count (renameCategoryEverywhere runs one
// updateMany scoped to the matched category — never an unbounded catalog
// rewrite). Never touches historical Order item snapshots — those carry
// their own copied name/price, not a live category reference.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { renameCategoryEverywhere, CategoryValidationError } from "@/lib/catalogCategories";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const admin = await requireAdmin(req);
        if (!admin) {
            return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
        }

        const body = await req.json();
        const oldName = typeof body?.oldName === "string" ? body.oldName : "";
        const newName = typeof body?.newName === "string" ? body.newName : "";

        if (!oldName.trim() || !newName.trim()) {
            return NextResponse.json({ success: false, message: "Both the current and new category name are required" }, { status: 400 });
        }

        const updatedCount = await renameCategoryEverywhere(oldName, newName);

        return NextResponse.json({ success: true, updatedCount });
    } catch (error) {
        if (error instanceof CategoryValidationError) {
            return NextResponse.json({ success: false, message: error.message }, { status: error.status });
        }
        console.error("RENAME_CATEGORY_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to rename category" }, { status: 500 });
    }
}
