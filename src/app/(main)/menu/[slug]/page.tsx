// src/app/(main)/menu/[slug]/page.tsx
// FIXED: removed `revalidate = 60` + `generateStaticParams` → was generating
//        ISR writes for every product on every mutation.  Now fully dynamic SSR.

import { connectDB }       from "@/lib/db";
import Product             from "@/models/Product";
import ProductDetail       from "@/components/products/ProductDetail";
import Navbar              from "@/components/shared/Navbar";
import Footer              from "@/components/shared/Footer";
import { notFound }        from "next/navigation";
import type { Metadata }   from "next";

// ✅ FIX — No ISR. Every request hits the DB directly (still fast via connection pool).
export const dynamic = "force-dynamic";

type PageProps = {
    params: Promise<{ slug: string }>;
};

// ─── Fetch helpers ────────────────────────────────────────────────────────
async function getProduct(slug: string) {
    try {
        await connectDB();
        // ✅ Only select fields needed by ProductDetail — excludes large unused fields
        const product = await Product
            .findOne({ slug })
            .select("name slug description shortDescription price compareAtPrice category image stock isAvailable isFeatured rating tags ingredients")
            .lean();
        if (!product) return null;
        return JSON.parse(JSON.stringify(product));
    } catch (error) {
        console.error("PRODUCT_FETCH_ERROR:", error);
        return null;
    }
}

async function getRelatedProducts(
    category: string,
    excludeId: string,
    limit: number
) {
    try {
        await connectDB();
        const products = await Product.find({
            category: { $regex: new RegExp(`^${category}$`, "i") },
            _id: { $ne: excludeId },
            isAvailable: true,
        })
            .select("name slug shortDescription price compareAtPrice category image rating stock isAvailable") // ✅ stock aur isAvailable add karo
            .limit(limit)
            .lean();
        return JSON.parse(JSON.stringify(products));
    } catch {
        return [];
    }
}

// ─── SEO Metadata ─────────────────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const product = await getProduct(slug);

    if (!product) {
        return {
            title: "Item Not Found | FoodKnock",
            description: "The menu item you're looking for could not be found. Browse our full menu on FoodKnock.",
        };
    }

    const title       = `${product.name} | FoodKnock — Order Fresh Food Online`;
    const description = product.shortDescription
        ?? product.description?.slice(0, 160)
        ?? `Order ${product.name} online from FoodKnock. Fresh ingredients, fast delivery.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: product.image ? [{ url: product.image, alt: product.name }] : [],
            type: "website",
            siteName: "FoodKnock",
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: product.image ? [product.image] : [],
        },
    };
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default async function ProductPage({ params }: PageProps) {
    const { slug } = await params;
    const product = await getProduct(slug);

    if (!product) notFound();

    const [upsellProducts, relatedProducts] = await Promise.all([
        getRelatedProducts(product.category, product._id, 3),
        getRelatedProducts(product.category, product._id, 4),
    ]);

    return (
        <>
            <Navbar />
            <ProductDetail
                product={product}
                upsellProducts={upsellProducts}
                relatedProducts={relatedProducts}
            />
            <Footer />
        </>
    );
}
