// src/components/home/OfferBanner.tsx — "Our Promise" trust section
//
// FoodKnock UI 2.0 — Phase 2: restyled to dark tokens, converted from
// unnecessary "use client" to a server component (same rationale as
// FeaturesSection.tsx — the old onMouseEnter/onMouseLeave JS is dropped in
// favor of Tailwind's own `hover:` classes). The anchor stats panel reads
// the REAL `stats` already computed in getHomeData() (avgRating/
// totalReviews) — no fake numbers.
//
// FoodKnock Phase 6 — found (and fixed) two numbers that were still
// fabricated despite the Phase 2 comment above claiming otherwise:
//   1. This component's own `stats.totalReviews > 0 ? stats.avgRating :
//      "4.9"` fallback — a second layer of the exact fake-rating pattern
//      already fixed in getHomeData() itself. Removed: the rating stat
//      (and the "Top Rated" badge under it, which implied the same
//      unearned claim) now only renders when a real rating exists.
//   2. A flat "🛵 30 min / Average delivery time" stat with zero backing
//      data anywhere in the system (no ETA/delivery-time tracking exists
//      on Order or Product) — removed outright, not replaced with
//      anything invented.
// When there are no real reviews yet, the panel falls back to a single
// always-true local-identity statement instead of an empty "numbers"
// panel with nothing real to show.
//
// Final customer-pages polish — found a third fabricated claim this card
// array had been carrying: "Open until 11 PM" / "a 10 PM craving — we're
// here", stated as a flat permanent guarantee. No extended-hours
// configuration exists anywhere in the system (src/models/Shop.ts is a
// manual isOpen boolean only — no scheduled hours of any kind); reworded to
// a real, always-true hours claim and aligned the delivery-time card to the
// site-wide standard "30–45 min" wording instead of this file's own "25–35"
// figure.
//
// FINAL UI/UX MASTER PROMPT — Phase 3: that "always-true hours claim" was
// itself wrong. It stated "9 AM – 9 PM" as the KITCHEN's open hours, but
// 9–9 is actually the WhatsApp *support* window (src/app/(main)/contact
// /page.tsx) — a different thing from when the kitchen cooks and dispatches
// orders, which Contact's own Phone/Call row states explicitly ("During
// kitchen hours") as 10 AM–8 PM. Now sourced from the single shared
// src/lib/businessHours.ts so Footer/OfferBanner/Contact can never drift
// against each other again.

import Link from "next/link";
import { ArrowRight, Flame, Leaf, Zap, Heart, Clock, ShieldCheck, MapPin } from "lucide-react";
import type { SiteStats } from "@/app/(main)/page";
import { KITCHEN_HOURS, DELIVERY_TIME_ESTIMATE } from "@/lib/businessHours";

const promises = [
    { icon: Flame, title: "Made After You Order", description: "No pre-cooked batches sitting around. Every dish is prepared the moment your order hits our kitchen — fresh, hot, and made exactly for you.", highlight: "Zero reheating · ever" },
    { icon: Leaf, title: "Fresh Ingredients Daily", description: "We source ingredients every morning. Crisp vegetables, quality proteins, fresh bread — the kind of sourcing that actually shows up in the taste.", highlight: "Sourced every morning" },
    { icon: Zap, title: `${DELIVERY_TIME_ESTIMATE.label} Delivery`, description: `Our kitchen is optimised for speed without shortcuts. Food leaves hot, travels fast, and arrives at your door still steaming — usually ${DELIVERY_TIME_ESTIMATE.full.replace("typically ", "in ")}.`, highlight: "Estimate · varies by distance" },
    { icon: Heart, title: "Cooked With Real Care", description: "We treat every order like it's for family. That's not a slogan — it's why our regulars keep coming back. The care genuinely shows up in every bite.", highlight: "Family kitchen standards" },
    { icon: Clock, title: `Open ${KITCHEN_HOURS.label}, ${KITCHEN_HOURS.days}`, description: "Whether it's an early lunch or a late-evening craving — our kitchen takes orders daily, no odd closures, no surprises.", highlight: `${KITCHEN_HOURS.label} daily` },
    { icon: ShieldCheck, title: "Secure Online Ordering", description: "Your data and payments are handled with care. Smooth, secure, frictionless checkout — so you can focus on what matters: the food.", highlight: "Safe · private · smooth" },
];

export default function OfferBanner({ stats }: { stats: SiteStats }) {
    const hasRealRating = stats.totalReviews > 0 && stats.avgRating !== null;

    return (
        <section className="px-4 py-12 md:px-8 md:py-16">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="max-w-lg">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-fk-success">Our Promise</p>
                    <h2 className="font-display text-2xl font-black leading-tight text-fk-text md:text-3xl">
                        Why FoodKnock regulars never switch.
                    </h2>
                </div>
                <Link href="/reviews" className="hidden shrink-0 items-center gap-2 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-5 py-2.5 text-sm font-bold text-fk-text-secondary md:inline-flex">
                    Read Real Reviews <ArrowRight size={13} />
                </Link>
            </div>

            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                <div className="relative overflow-hidden rounded-fk-lg bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] p-6 lg:p-8">
                    {hasRealRating ? (
                        <>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">Numbers that matter</p>
                            <h3 className="font-display mt-2 text-xl font-black leading-snug text-white">
                                Our track record speaks for itself.
                            </h3>
                            <div className="mt-6 space-y-4">
                                <div className="flex items-center gap-4 rounded-fk-md border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-sm">
                                    <span className="text-2xl">⭐</span>
                                    <div>
                                        <p className="text-2xl font-black leading-none text-white">
                                            {stats.avgRating}<span className="text-lg text-white/70">/5</span>
                                        </p>
                                        {/* CRITICAL FINAL FIX: stats.totalReviews is now an exact
                                            `countDocuments` result (see getHomeData() in
                                            src/app/(main)/page.tsx), not a 10-row-capped array
                                            length — the "+" implied "at least this many," which
                                            only made sense for the old under-counted figure. */}
                                        <p className="mt-0.5 text-[11px] text-white/60">From {stats.totalReviews} review{stats.totalReviews === 1 ? "" : "s"}</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">FoodKnock</p>
                            <h3 className="font-display mt-2 text-xl font-black leading-snug text-white">
                                A local kitchen, made for this neighbourhood.
                            </h3>
                        </>
                    )}
                    <div className="mt-5 flex items-center gap-2.5 rounded-fk-md border border-white/20 bg-white/10 px-4 py-3">
                        <MapPin size={18} className="shrink-0 text-white" />
                        <div>
                            <p className="text-[13px] font-black text-white">Made fresh in Danta, Sikar</p>
                            <p className="text-[11px] text-white/55">Cooked to order, every time</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    {promises.map((p) => {
                        const Icon = p.icon;
                        return (
                            <div
                                key={p.title}
                                className="flex flex-col rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                            >
                                <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-fk-md bg-fk-surface-selected text-[var(--fk-accent)]">
                                    <Icon size={20} />
                                </div>
                                <h3 className="font-display text-[14.5px] font-black leading-snug text-fk-text">{p.title}</h3>
                                <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-fk-text-secondary">{p.description}</p>
                                <div className="mt-3.5 inline-flex w-fit items-center gap-1.5 rounded-fk-pill bg-fk-surface-selected px-3 py-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--fk-accent)]" />
                                    <span className="text-[10.5px] font-bold text-[var(--fk-accent)]">{p.highlight}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
