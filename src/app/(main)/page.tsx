// src/app/(main)/page.tsx
// FIXED:
//   1. Removed full product table scan — now fetches only 6 products with limit()
//   2. Removed JS-level filter after full fetch — DB does the work
//   3. Review query limited and field-projected
//   4. Added force-dynamic

export const dynamic = "force-dynamic";

import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import HeroSection from "@/components/home/HeroSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import OfferBanner from "@/components/home/OfferBanner";
import { ArrowRight, Star, ChevronRight } from "lucide-react";
import FeaturedProductCard from "@/components/home/FeaturedProductCard";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import Review from "@/models/Review";

export type HomeProduct = {
    _id: string;
    name: string;
    description?: string;
    shortDescription?: string;
    price: number;
    compareAtPrice?: number | null;
    category: string;
    image: string;
    isFeatured: boolean;
};

export type HomeReview = {
    _id: string;
    userName: string;
    rating: number;
    comment: string;
    createdAt: string;
};

export type SiteStats = {
    avgRating: string;
    totalReviews: number;
    happyCustomers: number;
};

// ─── Data fetcher ──────────────────────────────────────────────────────────
async function getHomeData(): Promise<{
    featuredProducts: HomeProduct[];
    recentReviews: HomeReview[];
    stats: SiteStats;
}> {
    try {
        await connectDB();

        const [rawProducts, approvedReviews] = await Promise.all([
            // ✅ FIXED: DB-level sort + limit instead of fetching ALL then slicing in JS
            //    Uses compound index: { isAvailable:1, stock:1, isFeatured:-1, createdAt:-1 }
            Product.find({ isAvailable: true, stock: { $gt: 0 } })
                .sort({ isFeatured: -1, createdAt: -1 })
                .limit(6)                         // ✅ Only 6 docs — not entire collection
                .select("_id name shortDescription price compareAtPrice category image isFeatured")
                .lean(),

            // ✅ FIXED: limit + projection — don't pull full review docs
            Review.find({ isApproved: true })
                .sort({ createdAt: -1 })
                .limit(10)
                .select("userName rating comment createdAt")
                .lean(),
        ]);

        const featuredProducts = (rawProducts as any[]).map((p) => ({
            _id:              String(p._id),
            name:             p.name,
            shortDescription: p.shortDescription,
            price:            p.price,
            compareAtPrice:   p.compareAtPrice ?? null,
            category:         p.category,
            image:            p.image,
            isFeatured:       p.isFeatured,
        }));

        const totalReviews = (approvedReviews as any[]).length;
        const avgNum =
            totalReviews > 0
                ? (approvedReviews as any[]).reduce((s: number, r: any) => s + (r.rating || 0), 0) / totalReviews
                : 4.9;
        const happyCustomers = totalReviews > 0 ? Math.max(totalReviews * 6, 500) : 2400;

        const recentReviews = (approvedReviews as any[])
            .filter((r: any) => r.comment && r.comment.trim().length >= 10)
            .slice(0, 3)
            .map((r: any) => ({
                _id:       String(r._id),
                userName:  r.userName ?? "Customer",
                rating:    r.rating ?? 5,
                comment:   r.comment ?? "",
                createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
            }));

        return {
            featuredProducts,
            recentReviews,
            stats: {
                avgRating:      avgNum.toFixed(1),
                totalReviews,
                happyCustomers: Math.round(happyCustomers / 100) * 100,
            },
        };
    } catch {
        return {
            featuredProducts: [],
            recentReviews:    [],
            stats:            { avgRating: "4.9", totalReviews: 0, happyCustomers: 2400 },
        };
    }
}

// ─── Categories strip ──────────────────────────────────────────────────────
const categories = [
    { emoji: "🍔", label: "Burgers",   href: "/menu" },
    { emoji: "🍕", label: "Pizza",     href: "/menu" },
    { emoji: "🥤", label: "Shakes",    href: "/menu" },
    { emoji: "🧃", label: "Juice",     href: "/menu" },
    { emoji: "🍟", label: "Snacks",    href: "/menu" },
    { emoji: "🥟", label: "Momos",     href: "/menu" },
    { emoji: "☕", label: "Coffee",    href: "/menu" },
    { emoji: "🍦", label: "Ice Cream", href: "/menu" },
];

function CategoriesStrip() {
    return (
        <section className="border-b border-amber-100/80 bg-white py-14">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
                <div className="mb-8 flex items-end justify-between">
                    <div>
                        <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-500">Explore</p>
                        <h2 className="text-2xl font-black text-stone-900 md:text-3xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                            What are you craving?
                        </h2>
                    </div>
                    <Link href="/menu" className="group hidden items-center gap-1.5 text-sm font-bold text-amber-700 transition-colors hover:text-orange-600 md:inline-flex">
                        Full Menu <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>
                <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 lg:grid-cols-8">
                    {categories.map(({ emoji, label, href }) => (
                        <Link key={label} href={href}
                            className="group flex shrink-0 flex-col items-center gap-2.5 rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-center transition-all duration-200 hover:border-orange-300 hover:bg-orange-50 hover:shadow-md hover:shadow-orange-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                            style={{ minWidth: "80px" }}
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-100 bg-white text-2xl shadow-sm transition-transform duration-200 group-hover:scale-110">
                                {emoji}
                            </div>
                            <p className="text-xs font-bold text-stone-700 group-hover:text-orange-600">{label}</p>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}

function FeaturedProducts({ products }: { products: HomeProduct[] }) {
    if (products.length === 0) {
        return (
            <section className="bg-[#FFFBF5] py-16">
                <div className="mx-auto max-w-7xl px-4 text-center md:px-8">
                    <p className="text-stone-400">Menu items loading soon — check back shortly!</p>
                    <Link href="/menu" className="mt-4 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black text-white" style={{ background: "linear-gradient(135deg, #FF5C1A, #FF8C42)" }}>
                        View Full Menu <ArrowRight size={14} />
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-[#FFFBF5] py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
                <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5">
                            <span className="flex h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(255,92,26,0.7)]" />
                            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-600">Today&apos;s Picks</span>
                        </div>
                        <h2 className="text-2xl font-black text-stone-900 md:text-3xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                            Fresh &amp; Ready to Order
                        </h2>
                        <p className="mt-1.5 text-sm text-stone-500">Hot favourites made fresh — pick your craving and order in seconds.</p>
                    </div>
                    <Link href="/menu" className="group flex shrink-0 items-center gap-2 self-start rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 sm:self-auto">
                        View Full Menu <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                    {products.map((product) => (
                        <FeaturedProductCard key={product._id} product={product} />
                    ))}
                </div>
                <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-amber-100/80 p-6 text-center md:flex-row md:justify-between md:text-left" style={{ background: "linear-gradient(135deg, #fffbf5 0%, #fff7ed 100%)" }}>
                    <div>
                        <p className="font-black text-stone-900">Hungry for more?</p>
                        <p className="text-sm text-stone-500">Browse our full menu of 100+ items across all categories.</p>
                    </div>
                    <Link href="/menu" className="inline-flex shrink-0 items-center gap-2 rounded-full px-7 py-3 text-sm font-black text-white shadow-md transition-all hover:brightness-105 active:scale-95" style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)", boxShadow: "0 6px 20px rgba(255,92,26,0.3)" }}>
                        See All Items <ArrowRight size={14} />
                    </Link>
                </div>
            </div>
        </section>
    );
}

const WORD_LIMIT = 12;

function truncateWords(text: string): { preview: string; isTruncated: boolean } {
    const words = text.trim().split(/\s+/);
    if (words.length <= WORD_LIMIT) return { preview: text, isTruncated: false };
    return { preview: words.slice(0, WORD_LIMIT).join(" ") + "…", isTruncated: true };
}

const AVATAR_GRADS = [
    ["#FF5C1A", "#FF8C42"], ["#fbbf24", "#f97316"], ["#34d399", "#059669"],
    ["#fb923c", "#fcd34d"], ["#f472b6", "#ec4899"], ["#60a5fa", "#3b82f6"],
];

function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function TestimonialsStrip({ reviews }: { reviews: HomeReview[] }) {
    const displayReviews: HomeReview[] = reviews.length > 0 ? reviews : [
        { _id: "f1", userName: "Priya S.", rating: 5, comment: "Best cold coffee I've had in ages. Ordering online was incredibly smooth!", createdAt: new Date().toISOString() },
        { _id: "f2", userName: "Rahul M.", rating: 5, comment: "Smash burger is absolutely fire. Delivery was hot and arrived in under 30 minutes.", createdAt: new Date().toISOString() },
        { _id: "f3", userName: "Ananya K.", rating: 5, comment: "Love the combo deals and ice creams. The site is so smooth — premium feel!", createdAt: new Date().toISOString() },
    ];

    return (
        <section className="border-t border-amber-100 bg-white py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
                <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-500">Customer Love</p>
                        <h2 className="text-2xl font-black text-stone-900 md:text-3xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                            Don&apos;t just take our word for it
                        </h2>
                        <p className="mt-1.5 text-sm text-stone-500">Real words from real customers — unedited and genuine.</p>
                    </div>
                    <Link href="/reviews" className="group hidden items-center gap-2 text-sm font-bold text-stone-500 transition-colors hover:text-orange-600 md:inline-flex">
                        All Reviews <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    {displayReviews.map(({ _id, userName, rating, comment }, i) => {
                        const { preview, isTruncated } = truncateWords(comment);
                        const [from, to] = AVATAR_GRADS[i % AVATAR_GRADS.length];
                        return (
                            <div key={_id} className="flex flex-col rounded-3xl border border-stone-100 bg-[#FFFBF5] p-5 shadow-sm transition-all hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/50">
                                <div className="mb-3 flex gap-0.5">
                                    {Array.from({ length: rating }).map((_, si) => (
                                        <Star key={si} size={13} className="fill-amber-400 text-amber-400" />
                                    ))}
                                </div>
                                <p className="flex-1 text-sm leading-7 text-stone-600">&ldquo;{preview}&rdquo;</p>
                                {isTruncated && (
                                    <Link href="/reviews" className="mt-1.5 flex w-fit items-center gap-0.5 text-[12px] font-bold text-orange-500 transition-colors hover:text-orange-600">
                                        Read more <ChevronRight size={12} strokeWidth={2.5} />
                                    </Link>
                                )}
                                <div className="mt-4 flex items-center gap-2.5 border-t border-stone-100 pt-4">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white shadow-sm" style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}>
                                        {initials(userName)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-stone-900">{userName}</p>
                                        <p className="text-[11px] text-stone-400">Verified customer</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-6 flex justify-center md:hidden">
                    <Link href="/reviews" className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600">
                        All Reviews <ArrowRight size={13} />
                    </Link>
                </div>
            </div>
        </section>
    );
}

function FinalCTA() {
    return (
        <section className="bg-[#FFFBF5] pb-20 pt-4">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
                <div className="relative overflow-hidden rounded-3xl p-8 md:p-12" style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 55%, #FFB347 100%)" }}>
                    <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
                    <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full border border-white/15" aria-hidden="true" />
                    <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full border border-white/10" aria-hidden="true" />
                    <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-black/10 blur-2xl" aria-hidden="true" />
                    <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-lg">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5">
                                <span className="text-base">🍽️</span>
                                <span className="text-[11px] font-black uppercase tracking-widest text-white">Freshly Prepared</span>
                            </div>
                            <h2 className="text-2xl font-black text-white md:text-3xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                                Ready to order something <span className="text-white/85">amazing?</span>
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-white/80">
                                Fresh food, fast delivery, smooth online ordering — the FoodKnock experience starts the moment you tap.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-3">
                            <Link href="/menu" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-black text-orange-600 shadow-lg transition-all hover:bg-orange-50 active:scale-95">
                                Start Your Order <ArrowRight size={14} />
                            </Link>
                            <Link href="/contact" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 bg-white/10 px-8 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20">
                                Get in Touch
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default async function HomePage() {
    const { featuredProducts, recentReviews, stats } = await getHomeData();

    return (
        <>
            <Navbar />
            <main className="bg-[#FFFBF5]">
                <HeroSection stats={stats} />
                <FeaturedProducts products={featuredProducts} />
                <CategoriesStrip />
                <FeaturesSection />
                <OfferBanner />
                <TestimonialsStrip reviews={recentReviews} />
                <FinalCTA />
            </main>
            <Footer />
        </>
    );
}
