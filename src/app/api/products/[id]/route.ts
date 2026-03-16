// src/app/api/products/[id]/route.ts
// FIXES:
//   1. Removed all revalidatePath() calls → eliminates ISR write costs
//   2. Rejects base64 image updates — must use Cloudinary URL
//   3. Added force-dynamic
//   4. lean() on read queries

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function generateSlug(name: string) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

// ─── GET /api/products/[id] ───────────────────────────────────────────────
export async function GET(_req: NextRequest, context: RouteContext) {
    try {
        await connectDB();
        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid product ID" }, { status: 400 });
        }
        const product = await Product.findById(id).lean();
        if (!product) {
            return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, product });
    } catch (error) {
        console.error("GET_PRODUCT_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to fetch product" }, { status: 500 });
    }
}

// ─── PATCH /api/products/[id] ─────────────────────────────────────────────
export async function PATCH(req: NextRequest, context: RouteContext) {
    try {
        await connectDB();
        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid product ID" }, { status: 400 });
        }

        const body = await req.json();
        const { _id, __v, ...updateData } = body;

        // ✅ Reject base64 images
        if (typeof updateData.image === "string" && updateData.image.startsWith("data:")) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Base64 images are not allowed. Upload via /api/upload/image and pass the Cloudinary URL.",
                },
                { status: 400 }
            );
        }

        if (typeof updateData.tags === "string") {
            updateData.tags = updateData.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
        }
        if (typeof updateData.ingredients === "string") {
            updateData.ingredients = updateData.ingredients.split(",").map((i: string) => i.trim()).filter(Boolean);
        }

        if (updateData.price !== undefined) {
            const p = Number(updateData.price);
            if (isNaN(p) || p < 0) {
                return NextResponse.json({ success: false, message: "Invalid price" }, { status: 400 });
            }
            updateData.price = p;
        }

        if (updateData.stock !== undefined) {
            const s = Number(updateData.stock);
            if (isNaN(s) || s < 0) {
                return NextResponse.json({ success: false, message: "Invalid stock" }, { status: 400 });
            }
            updateData.stock = s;
            updateData.isAvailable =
                updateData.isAvailable === undefined ? s > 0 : Boolean(updateData.isAvailable);
        }

        if ("compareAtPrice" in updateData) {
            const raw = updateData.compareAtPrice;
            if (raw === null || raw === "" || raw === undefined) {
                updateData.compareAtPrice = null;
            } else {
                const cap = Number(raw);
                if (isNaN(cap) || cap < 0) {
                    return NextResponse.json({ success: false, message: "Invalid original price" }, { status: 400 });
                }
                const effectivePrice =
                    updateData.price !== undefined
                        ? updateData.price
                        : ((await Product.findById(id).select("price").lean()) as any)?.price ?? 0;
                if (cap <= effectivePrice) {
                    return NextResponse.json(
                        { success: false, message: "Original price must be greater than the selling price" },
                        { status: 400 }
                    );
                }
                updateData.compareAtPrice = cap;
            }
        }

        const oldProduct = await Product.findById(id).select("slug name").lean();
        if (!oldProduct) {
            return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
        }

        if (updateData.name && !updateData.slug) {
            const trimmedName = String(updateData.name).trim();
            const oldName     = String((oldProduct as any).name ?? "").trim();
            if (trimmedName && trimmedName !== oldName) {
                const base = generateSlug(trimmedName);
                let slug = base;
                let suffix = 1;
                while (await Product.findOne({ _id: { $ne: id }, slug }).select("_id").lean()) {
                    slug = `${base}-${suffix++}`;
                }
                updateData.slug = slug;
            }
        }

        if (updateData.name)                           updateData.name             = String(updateData.name).trim();
        if (updateData.description)                    updateData.description      = String(updateData.description).trim();
        if (updateData.shortDescription !== undefined) updateData.shortDescription = String(updateData.shortDescription ?? "").trim();
        if (updateData.category)                       updateData.category         = String(updateData.category).trim();

        const product = await Product.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!product) {
            return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
        }

        // ✅ No revalidatePath() — pages are force-dynamic, no ISR to bust

        return NextResponse.json({ success: true, product });
    } catch (error: any) {
        console.error("PATCH_PRODUCT_ERROR", error);
        if (error.code === 11000) {
            return NextResponse.json({ success: false, message: "A product with that slug already exists" }, { status: 409 });
        }
        return NextResponse.json(
            { success: false, message: error.message ?? "Failed to update product" },
            { status: 500 }
        );
    }
}

// ─── DELETE /api/products/[id] ────────────────────────────────────────────
export async function DELETE(_req: NextRequest, context: RouteContext) {
    try {
        await connectDB();
        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid product ID" }, { status: 400 });
        }
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
        }
        // ✅ No revalidatePath() — no ISR to bust
        return NextResponse.json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
        console.error("DELETE_PRODUCT_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to delete product" }, { status: 500 });
    }
}
