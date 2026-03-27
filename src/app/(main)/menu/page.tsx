// src/app/(main)/menu/page.tsx
// FoodKnock — Menu page (Server Component)
// FIXED: removed `revalidate = 60` (was causing 1.4M ISR writes on Vercel)
//        replaced with `dynamic = "force-dynamic"` → always SSR, zero ISR writes.

import Navbar             from "@/components/shared/Navbar";
import Footer             from "@/components/shared/Footer";
import MenuClient         from "@/components/products/MenuClient";
import { connectDB }      from "@/lib/db";
import Product            from "@/models/Product";
import { getShopStatus }  from "@/models/Shop";
import { AlertTriangle }  from "lucide-react";
import Link               from "next/link";
import { NextResponse }   from "next/server";

// ✅ FIX #1 — No ISR. Force dynamic SSR on every request.
// This completely eliminates ISR write costs on Vercel.
export const dynamic = "force-dynamic";

export const metadata = {
    title:       "Our Menu — Burgers, Pizza, Momos, Shakes & More",
    description: "Browse FoodKnock's full menu. Fresh burgers, pizzas, momos, cold shakes, juices, ice cream & more. Order online for fast delivery in Danta, Sikar.",
    alternates:  { canonical: "https://www.foodknock.com/menu" },
    openGraph: {
        title:       "FoodKnock Menu — Order Fresh Food Online",
        description: "Burgers, pizza, momos, shakes & ice cream — delivered fresh & fast.",
        url:         "https://www.foodknock.com/menu",
    },
};

// ✅ FIX #2 — Lean projection: only fetch fields the UI actually needs.
// Eliminates large `description`, `ingredients`, base64 blobs from payloads.
const MENU_PROJECTION = {
    _id:              1,
    name:             1,
    slug:             1,
    shortDescription: 1,
    price:            1,
    compareAtPrice:   1,
    category:         1,
    image:            1,
    stock:            1,
    isAvailable:      1,
    isFeatured:       1,
    rating:           1,
    tags:             1,
} as const;

async function getProducts() {
    try {
        await connectDB();
        // ✅ FIX #3 — .lean() returns plain JS objects (no Mongoose overhead)
        //             Uses compound index: (isAvailable, stock, isFeatured, createdAt)
        const products = await Product
            .find({ isAvailable: true }, MENU_PROJECTION)
            .sort({ isFeatured: -1, createdAt: -1 })
            .lean();
        return JSON.parse(JSON.stringify(products));
    } catch (error) {
        console.error("PRODUCT_FETCH_ERROR:", error);
        return [];
    }
}

export default async function MenuPage() {
    const [products, { isOpen }] = await Promise.all([
        getProducts(),
        getShopStatus().catch(() => ({ isOpen: true })),
    ]);

    return (
        <>
            <Navbar />

            {/* ── Shop closed banner ── */}
            {!isOpen && (
                <div className="w-full border-b border-red-200 bg-gradient-to-r from-red-50 via-rose-50 to-red-50">
                    <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5 md:px-8">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100">
                            <AlertTriangle size={15} className="text-red-600" strokeWidth={2.5} />
                        </div>
                        <p className="text-[13px] font-bold text-red-700">
                            ⚠️ Shop is currently closed.{" "}
                            <span className="font-black">Orders will resume soon.</span>{" "}
                            <span className="font-medium text-red-500">You can still browse our menu.</span>
                        </p>
                    </div>
                </div>
            )}

            {/* ── Instagram Review Reward marketing banner ── */}
            <Link href="/review-reward"
                  className="group block w-full border-b border-pink-200/70 bg-gradient-to-r from-pink-50 via-rose-50 to-orange-50 transition-colors hover:from-pink-100 hover:via-rose-100 hover:to-orange-100">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">📸</span>
                        <p className="text-[12.5px] font-bold text-stone-700">
                            Post a FoodKnock review on Instagram and get a{" "}
                            <span className="font-black text-pink-600">FREE Burger 🍔</span>
                        </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-pink-200 bg-white px-3 py-1 text-[11px] font-black text-pink-600 shadow-sm transition-all group-hover:border-pink-300 group-hover:bg-pink-50">
                        Learn more →
                    </span>
                </div>
            </Link>

            <MenuClient products={products} shopOpen={isOpen} />
            <Footer />
        </>
    );
}
