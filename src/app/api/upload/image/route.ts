// src/app/api/upload/image/route.ts
// Secure Cloudinary image upload endpoint.
//
// Flow:
//   Admin selects file → browser POSTs multipart/form-data here
//   → we upload to Cloudinary → return secure_url
//   → ProductForm stores the URL (not the binary) in state
//   → On save, the URL is sent to /api/products (POST/PATCH)
//
// This completely eliminates base64 storage in MongoDB:
//   BEFORE: image field = "data:image/jpeg;base64,/9j/4AAQ..." (50–500 KB per doc)
//   AFTER:  image field = "https://res.cloudinary.com/…/product.jpg" (60 chars)
//
// Admin-only: requires valid JWT with role === "admin"

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary }          from "cloudinary";
import { connectDB }                 from "@/lib/db";
import User                          from "@/models/User";
import { verifyToken }               from "@/lib/auth";

export const dynamic = "force-dynamic";

// Configure Cloudinary from env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key:    process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// ─── Auth guard ───────────────────────────────────────────────────────────
async function assertAdmin(req: NextRequest): Promise<string | null> {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    if (!token) return null;

    try {
        const decoded = verifyToken(token) as { userId?: string; role?: string };
        if (!decoded?.userId) return null;

        await connectDB();
        const user = await User.findById(decoded.userId).select("role isActive").lean() as any;
        if (!user || user.isActive === false || user.role !== "admin") return null;

        return decoded.userId;
    } catch {
        return null;
    }
}

// ─── POST /api/upload/image ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
    // 1. Auth check
    const adminId = await assertAdmin(req);
    if (!adminId) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    // 2. Parse multipart form
    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid form data" },
            { status: 400 }
        );
    }

    const file = formData.get("file") as File | null;
    if (!file) {
        return NextResponse.json(
            { success: false, message: "No file provided" },
            { status: 400 }
        );
    }

    // 3. Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
            { success: false, message: "Only JPEG, PNG, WEBP, and GIF images are allowed" },
            { status: 400 }
        );
    }

    // 4. Validate file size (max 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
        return NextResponse.json(
            { success: false, message: "File size must be under 5 MB" },
            { status: 400 }
        );
    }

    // 5. Convert File → Buffer → base64 data URI for Cloudinary SDK
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const dataUri     = `data:${file.type};base64,${buffer.toString("base64")}`;

    // 6. Upload to Cloudinary
    try {
        const result = await cloudinary.uploader.upload(dataUri, {
            folder:         "foodknock/products",
            resource_type:  "image",
            // Auto-optimise: convert to WebP, quality auto
            transformation: [
                { width: 800, height: 800, crop: "limit", quality: "auto", fetch_format: "auto" },
            ],
        });

        return NextResponse.json({
            success:    true,
            url:        result.secure_url,
            public_id:  result.public_id,
            width:      result.width,
            height:     result.height,
        });
    } catch (err: any) {
        console.error("CLOUDINARY_UPLOAD_ERROR", err);
        return NextResponse.json(
            { success: false, message: "Image upload failed. Please try again." },
            { status: 500 }
        );
    }
}
