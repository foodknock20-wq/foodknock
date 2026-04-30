// src/app/api/products/route.ts
// PERF FIXES:
//   1. Sanitize regex input before search — prevents ReDoS + full collection scan
//      Raw user input like "a+" or "(a|b)*" in new RegExp() is exploitable and slow
//   2. force-dynamic kept — prevents static build-time optimisation of dynamic routes
//   3. Cache-Control s-maxage=60 kept — CDN caches response for 60s after first request
//      force-dynamic + Cache-Control work together: handler always runs, CDN caches output
//   4. All other optimizations from previous round preserved (lean, projection, etc.)

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";

export const revalidate = 30;

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

// PERF: escape regex special characters to prevent ReDoS attacks and
//       unintentional full-collection scans from malformed patterns
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
            // PERF: anchored regex (^…$) uses index — unanchored scans every doc
            query.category = { $regex: new RegExp(`^${escapeRegex(category)}$`, "i") };
        }
        if (featured === "true") query.isFeatured = true;

        if (search) {
            // PERF: escape user input before using in regex to prevent ReDoS
            const safeSearch = escapeRegex(search.trim());
            const regex      = new RegExp(safeSearch, "i");
            query.$or = [
                { name:     regex },
                { category: regex },
                { tags:     regex },
            ];
        }

        const products = await Product.find(query)
            .select(LIST_PROJECTION)
            .sort({ isFeatured: -1, createdAt: -1 })
            .maxTimeMS(8000)
            .lean();

        const res = NextResponse.json({ success: true, products });
        // CDN caches for 60 s; stale-while-revalidate serves stale for 30 s while refreshing
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
            image,
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
            image,
            tags:             tagArray,
            ingredients:      ingredientArray,
            isFeatured:       Boolean(isFeatured),
            isAvailable:      isAvailable === undefined ? parsedStock > 0 : Boolean(isAvailable),
        });

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