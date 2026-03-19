// src/app/api/products/route.ts
// FIXES:
//   1. Removed revalidatePath() — was triggering ISR writes on every mutation
//   2. Image field now expects a Cloudinary URL (not base64)
//      Admin uploads via /api/upload/image first, then sends the URL here
//   3. GET uses lean() + field projection → smaller payloads
//   4. Added export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";

// ✅ No cache — API routes must never be cached on the CDN
export const dynamic = "force-dynamic";

// Public fields safe to expose in list responses
const LIST_PROJECTION =
    "name slug shortDescription price compareAtPrice category image stock isAvailable isFeatured rating tags";

function generateSlug(name: string) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

// ─── GET /api/products ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const slug     = searchParams.get("slug");
        const search   = searchParams.get("search");
        const featured = searchParams.get("featured");

        const query: Record<string, unknown> = {};

        if (slug)     query.slug = slug;
        if (category && category !== "all") {
            query.category = { $regex: new RegExp(`^${category}$`, "i") };
        }
        if (featured === "true") query.isFeatured = true;

        if (search) {
            const regex = new RegExp(search, "i");
            query.$or = [
                { name: regex },
                { category: regex },
                { tags: regex },
            ];
        }

        // ✅ lean() + projection → much smaller payload, faster serialisation
        const products = await Product.find(query)
            .select(LIST_PROJECTION)
            .sort({ isFeatured: -1, createdAt: -1 })
            .maxTimeMS(8000)
            .lean();

        const res = NextResponse.json({ success: true, products });
        // ✅ Light CDN cache (60 s) — safe because pages are force-dynamic
        res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30");
        return res;
    } catch (error) {
        console.error("GET_PRODUCTS_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch products" },
            { status: 500 }
        );
    }
}

// ─── POST /api/products ────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json();

        const {
            name,
            description,
            shortDescription,
            price,
            compareAtPrice,
            stock,
            category,
            image,      // ✅ Must now be a Cloudinary URL (https://res.cloudinary.com/…)
            tags,
            ingredients,
            isFeatured,
            isAvailable,
        } = body;

        if (!name || !description || price === undefined || !category || !image) {
            return NextResponse.json(
                { success: false, message: "Missing required fields" },
                { status: 400 }
            );
        }

        // ✅ Reject base64 images — they must go through /api/upload/image first
        if (typeof image === "string" && image.startsWith("data:")) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Base64 images are not allowed. Upload via /api/upload/image first and pass the returned Cloudinary URL.",
                },
                { status: 400 }
            );
        }

        const parsedPrice = Number(price);
        const parsedStock = Number(stock ?? 0);

        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return NextResponse.json(
                { success: false, message: "Invalid price" },
                { status: 400 }
            );
        }

        if (isNaN(parsedStock) || parsedStock < 0) {
            return NextResponse.json(
                { success: false, message: "Invalid stock" },
                { status: 400 }
            );
        }

        let parsedCompareAtPrice: number | null = null;
        if (compareAtPrice !== undefined && compareAtPrice !== null && compareAtPrice !== "") {
            parsedCompareAtPrice = Number(compareAtPrice);
            if (isNaN(parsedCompareAtPrice) || parsedCompareAtPrice < 0) {
                return NextResponse.json(
                    { success: false, message: "Invalid original price" },
                    { status: 400 }
                );
            }
            if (parsedCompareAtPrice <= parsedPrice) {
                return NextResponse.json(
                    { success: false, message: "Original price must be greater than the selling price" },
                    { status: 400 }
                );
            }
        }

        // ── Slug generation ───────────────────────────────────────────────
        const baseSlug = generateSlug(String(name));
        let slug = baseSlug;
        let suffix = 1;
        while (await Product.findOne({ slug }).select("_id").lean()) {
            slug = `${baseSlug}-${suffix}`;
            suffix++;
        }

        const tagArray =
            typeof tags === "string"
                ? tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                : Array.isArray(tags) ? tags : [];

        const ingredientArray =
            typeof ingredients === "string"
                ? ingredients.split(",").map((i: string) => i.trim()).filter(Boolean)
                : Array.isArray(ingredients) ? ingredients : [];

        const product = await Product.create({
            name:             String(name).trim(),
            slug,
            description:      String(description).trim(),
            shortDescription: String(shortDescription ?? "").trim(),
            price:            parsedPrice,
            compareAtPrice:   parsedCompareAtPrice,
            stock:            parsedStock,
            category:         String(category).trim(),
            image,          // Cloudinary URL stored as-is
            tags:             tagArray,
            ingredients:      ingredientArray,
            isFeatured:       Boolean(isFeatured),
            isAvailable:      isAvailable === undefined ? parsedStock > 0 : Boolean(isAvailable),
        });

        // ✅ No revalidatePath() — pages are force-dynamic, no ISR to bust

        return NextResponse.json({ success: true, product }, { status: 201 });
    } catch (error: any) {
        console.error("CREATE_PRODUCT_ERROR", error);
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, message: "A product with that slug already exists" },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { success: false, message: error.message ?? "Failed to create product" },
            { status: 500 }
        );
    }
}
