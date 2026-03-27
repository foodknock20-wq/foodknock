// src/app/(main)/loading.tsx

export default function Loading() {
    return (
        <main className="min-h-screen overflow-x-hidden bg-[#FFFBF5]">
            <style>{`
                @keyframes shimmer {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(160%); }
                }
                @keyframes floatDot {
                    0%, 100% { opacity: 0.3; transform: translateY(0px) scale(0.9); }
                    50%       { opacity: 1;   transform: translateY(-5px) scale(1.1); }
                }
                @keyframes glowPulse {
                    0%, 100% { opacity: 0.12; transform: scale(1); }
                    50%       { opacity: 0.22; transform: scale(1.04); }
                }
                @keyframes ringPulse {
                    0%, 100% { opacity: 0.3; transform: scale(0.92); }
                    50%       { opacity: 0.65; transform: scale(1.06); }
                }
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                .sk-shimmer {
                    position: relative;
                    overflow: hidden;
                }
                .sk-shimmer::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        108deg,
                        transparent 28%,
                        rgba(255,255,255,0.78) 50%,
                        transparent 72%
                    );
                    animation: shimmer 1.8s cubic-bezier(0.4,0,0.6,1) infinite;
                }
                .sk-slow::after  { animation-duration: 2.4s; }
                .sk-medium::after { animation-duration: 2.0s; }

                .dot-bounce {
                    display: inline-block;
                    width: 8px; height: 8px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #f97316, #f59e0b);
                    animation: floatDot 1.2s ease-in-out infinite;
                    box-shadow: 0 2px 8px rgba(249,115,22,0.35);
                }
                .dot-bounce:nth-child(2) { animation-delay: 0.2s;  }
                .dot-bounce:nth-child(3) { animation-delay: 0.4s;  }

                .orb-glow {
                    animation: glowPulse 3.5s ease-in-out infinite;
                }
                .ring-pulse {
                    animation: ringPulse 2.2s ease-in-out infinite;
                }
                .fade-up {
                    animation: fadeSlideUp 0.5s ease-out forwards;
                    opacity: 0;
                }
            `}</style>

            {/* ── Ambient background orbs ── */}
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="orb-glow absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-amber-200 blur-3xl" />
                <div className="orb-glow absolute top-1/2 -right-24 h-[320px] w-[320px] rounded-full bg-orange-200 blur-3xl" style={{ animationDelay: "1.6s" }} />
                <div className="orb-glow absolute bottom-10 left-1/4 h-[260px] w-[260px] rounded-full bg-yellow-100 blur-3xl" style={{ animationDelay: "0.9s" }} />
            </div>

            {/* ══════════════════════════════════════════
                NAV SKELETON
            ══════════════════════════════════════════ */}
            <nav className="sticky top-0 z-40 border-b border-amber-100 bg-[#FFFBF5]/92 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 md:px-8">
                    {/* Logo wordmark */}
                    <div className="sk-shimmer h-8 w-32 rounded-xl bg-gradient-to-r from-orange-200 to-amber-200" />

                    {/* Desktop nav links */}
                    <div className="hidden items-center gap-7 md:flex">
                        {[52, 44, 60, 48].map((w, i) => (
                            <div
                                key={i}
                                className="sk-shimmer h-3.5 rounded-full bg-stone-200"
                                style={{ width: w, animationDelay: `${i * 55}ms` }}
                            />
                        ))}
                    </div>

                    {/* Right actions: avatar + cart */}
                    <div className="flex items-center gap-2.5">
                        <div className="sk-shimmer h-9 w-9 rounded-full bg-amber-100" />
                        <div className="sk-shimmer h-9 w-9 rounded-full bg-amber-100 md:hidden" />
                        <div className="sk-shimmer hidden h-9 w-28 rounded-xl bg-gradient-to-r from-orange-200 to-amber-200 md:block" />
                    </div>
                </div>
            </nav>

            <div className="relative mx-auto max-w-7xl px-4 pb-20 md:px-8">

                {/* ══════════════════════════════════════════
                    BRANDED LOADING MESSAGE
                ══════════════════════════════════════════ */}
                <div className="fade-up flex flex-col items-center py-7 md:py-9" style={{ animationDelay: "80ms" }}>
                    <div className="mb-3 flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-1.5">
                        <span className="text-base">🍳</span>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">
                            FoodKnock
                        </p>
                    </div>
                    <p className="text-center text-base font-bold text-stone-600 md:text-lg">
                        Getting your menu ready
                    </p>
                    <p className="mt-1 text-center text-[12px] text-stone-400">
                        Fresh dishes loading — just a moment 🔥
                    </p>
                    <div className="mt-4 flex items-center gap-2.5">
                        <span className="dot-bounce" />
                        <span className="dot-bounce" />
                        <span className="dot-bounce" />
                    </div>
                </div>

                {/* ══════════════════════════════════════════
                    HERO SKELETON
                ══════════════════════════════════════════ */}
                <section className="mb-5 fade-up" style={{ animationDelay: "120ms" }}>
                    <div className="overflow-hidden rounded-[1.75rem] border border-amber-100 bg-white shadow-lg shadow-amber-100/60 md:rounded-[2.25rem]">

                        {/* Hero image zone */}
                        <div className="sk-shimmer sk-slow relative bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50" style={{ height: 340 }}>
                            {/* Decorative concentric rings */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="ring-pulse absolute h-44 w-44 rounded-full border-2 border-amber-200/50 md:h-56 md:w-56" />
                                <div className="ring-pulse absolute h-32 w-32 rounded-full border-2 border-orange-200/60 md:h-40 md:w-40" style={{ animationDelay: "0.6s" }} />
                                <div className="ring-pulse h-20 w-20 rounded-full bg-gradient-to-br from-amber-200/70 to-orange-200/70 md:h-24 md:w-24" style={{ animationDelay: "1.2s" }} />
                            </div>
                            {/* Top-left badge hint */}
                            <div className="absolute left-5 top-5">
                                <div className="sk-shimmer h-8 w-28 rounded-full bg-white/70" />
                            </div>
                        </div>

                        {/* Hero text content */}
                        <div className="p-5 md:p-7">
                            {/* Eyebrow */}
                            <div className="sk-shimmer mb-3.5 h-6 w-36 rounded-full bg-orange-100" style={{ animationDelay: "60ms" }} />

                            {/* Headline lines */}
                            <div className="mb-1.5 space-y-2.5">
                                <div className="sk-shimmer h-10 w-[74%] rounded-xl bg-amber-100 md:h-12" style={{ animationDelay: "100ms" }} />
                                <div className="sk-shimmer h-10 w-[52%] rounded-xl bg-amber-100/70 md:h-12" style={{ animationDelay: "140ms" }} />
                            </div>

                            {/* Supporting text */}
                            <div className="mt-4 space-y-2">
                                <div className="sk-shimmer h-4 w-full max-w-md rounded-lg bg-stone-100" style={{ animationDelay: "175ms" }} />
                                <div className="sk-shimmer h-4 w-[62%] max-w-xs rounded-lg bg-stone-100" style={{ animationDelay: "205ms" }} />
                            </div>

                            {/* CTA buttons */}
                            <div className="mt-6 flex flex-wrap gap-3">
                                <div className="sk-shimmer h-12 w-44 rounded-2xl bg-gradient-to-r from-orange-200 to-amber-200" style={{ animationDelay: "240ms" }} />
                                <div className="sk-shimmer h-12 w-36 rounded-2xl bg-stone-100" style={{ animationDelay: "275ms" }} />
                            </div>

                            {/* Trust chips */}
                            <div className="mt-5 flex flex-wrap gap-2">
                                {[92, 80, 104, 88].map((w, i) => (
                                    <div
                                        key={i}
                                        className="sk-shimmer h-8 rounded-full border border-amber-100 bg-amber-50"
                                        style={{ width: w, animationDelay: `${310 + i * 50}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <SectionDivider />

                {/* ══════════════════════════════════════════
                    STATS / TRUST STRIP
                ══════════════════════════════════════════ */}
                <section className="mb-5 fade-up" style={{ animationDelay: "160ms" }}>
                    <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
                        <div className="grid grid-cols-2 divide-x divide-y divide-amber-100 md:grid-cols-4 md:divide-y-0">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3.5 px-5 py-5"
                                >
                                    <div
                                        className="sk-shimmer h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100"
                                        style={{ animationDelay: `${i * 65}ms` }}
                                    />
                                    <div className="flex-1 space-y-2">
                                        <div
                                            className="sk-shimmer h-5 w-14 rounded-lg bg-orange-200"
                                            style={{ animationDelay: `${i * 65 + 35}ms` }}
                                        />
                                        <div
                                            className="sk-shimmer h-3 w-20 rounded bg-stone-200"
                                            style={{ animationDelay: `${i * 65 + 65}ms` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <SectionDivider />

                {/* ══════════════════════════════════════════
                    FEATURED PRODUCTS
                ══════════════════════════════════════════ */}
                <section className="mb-5 fade-up" style={{ animationDelay: "200ms" }}>
                    {/* Section header */}
                    <div className="mb-5 flex items-end justify-between">
                        <div className="space-y-2">
                            <div className="sk-shimmer h-5 w-20 rounded-full bg-orange-100" style={{ animationDelay: "40ms" }} />
                            <div className="sk-shimmer h-8 w-48 rounded-xl bg-stone-200" style={{ animationDelay: "80ms" }} />
                        </div>
                        <div className="sk-shimmer h-10 w-28 rounded-2xl bg-amber-100" style={{ animationDelay: "110ms" }} />
                    </div>

                    {/* Product card grid — 2 col mobile, 4 col desktop */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <FoodCardSkeleton key={i} delay={i * 65} />
                        ))}
                    </div>
                </section>

                <SectionDivider />

                {/* ══════════════════════════════════════════
                    CATEGORY STRIP
                ══════════════════════════════════════════ */}
                <section className="mb-5 fade-up" style={{ animationDelay: "240ms" }}>
                    <div className="mb-5 flex items-end justify-between">
                        <div className="space-y-2">
                            <div className="sk-shimmer h-4 w-16 rounded-full bg-orange-100" />
                            <div className="sk-shimmer h-7 w-40 rounded-xl bg-stone-200" style={{ animationDelay: "50ms" }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="sk-shimmer flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-amber-100 bg-white py-5 shadow-sm"
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 ring-pulse" />
                                <div className="h-3 w-14 rounded-full bg-stone-200" />
                            </div>
                        ))}
                    </div>
                </section>

                <SectionDivider />

                {/* ══════════════════════════════════════════
                    SECOND PRODUCT ROW (e.g. Popular picks)
                ══════════════════════════════════════════ */}
                <section className="mb-5 fade-up" style={{ animationDelay: "280ms" }}>
                    <div className="mb-5 flex items-end justify-between">
                        <div className="space-y-2">
                            <div className="sk-shimmer h-4 w-24 rounded-full bg-orange-100" />
                            <div className="sk-shimmer h-7 w-52 rounded-xl bg-stone-200" style={{ animationDelay: "50ms" }} />
                        </div>
                        <div className="sk-shimmer h-9 w-24 rounded-2xl bg-amber-100" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <FoodCardSkeleton key={i} delay={i * 60 + 30} />
                        ))}
                    </div>
                </section>

                {/* ══════════════════════════════════════════
                    BOTTOM BRAND PULSE
                ══════════════════════════════════════════ */}
                <div className="mt-12 flex flex-col items-center gap-3 opacity-60">
                    <div className="flex items-center gap-2">
                        {[16, 28, 40, 28, 16].map((w, i) => (
                            <div
                                key={i}
                                className="h-1 rounded-full bg-amber-300"
                                style={{
                                    width: w,
                                    animation: `floatDot 1.4s ease-in-out ${i * 0.15}s infinite`,
                                }}
                            />
                        ))}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                        FoodKnock
                    </p>
                </div>

                {/* Safe-area spacer for phones with home indicator */}
                <div className="h-6" />
            </div>
        </main>
    );
}

/* ══════════════════════════════════════════
   FOOD CARD SKELETON
══════════════════════════════════════════ */
function FoodCardSkeleton({ delay }: { delay: number }) {
    return (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-md shadow-amber-50/80">
            {/* Image zone */}
            <div
                className="sk-shimmer sk-medium relative bg-gradient-to-br from-amber-50 to-orange-50"
                style={{ height: 144 }}
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    <div
                        className="ring-pulse h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-200/60 to-orange-200/60"
                        style={{ animationDelay: `${delay * 0.5}ms` }}
                    />
                </div>
                {/* Top-right tag hint */}
                <div className="absolute right-2.5 top-2.5">
                    <div className="sk-shimmer h-5 w-12 rounded-full bg-white/80" />
                </div>
            </div>

            {/* Card body */}
            <div className="flex flex-1 flex-col p-3 sm:p-3.5">
                {/* Category chip */}
                <div
                    className="sk-shimmer mb-2 h-5 w-16 rounded-full bg-orange-100"
                    style={{ animationDelay: `${delay + 40}ms` }}
                />
                {/* Product name */}
                <div
                    className="sk-shimmer mb-1.5 h-4 w-[84%] rounded-lg bg-stone-200"
                    style={{ animationDelay: `${delay + 70}ms` }}
                />
                <div
                    className="sk-shimmer mb-3 h-4 w-[55%] rounded-lg bg-stone-200/70"
                    style={{ animationDelay: `${delay + 90}ms` }}
                />
                {/* Description lines */}
                <div
                    className="sk-shimmer mb-1 h-3 w-full rounded bg-stone-100"
                    style={{ animationDelay: `${delay + 110}ms` }}
                />
                <div
                    className="sk-shimmer h-3 w-[70%] rounded bg-stone-100/80"
                    style={{ animationDelay: `${delay + 125}ms` }}
                />

                <div className="flex-1" />

                {/* Price + Add to cart */}
                <div className="mt-3.5 flex items-center justify-between gap-2">
                    <div
                        className="sk-shimmer h-6 w-14 rounded-lg bg-amber-200"
                        style={{ animationDelay: `${delay + 145}ms` }}
                    />
                    <div
                        className="sk-shimmer h-9 flex-1 rounded-xl bg-gradient-to-r from-orange-200 to-amber-200"
                        style={{ animationDelay: `${delay + 165}ms` }}
                    />
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════
   SECTION DIVIDER
══════════════════════════════════════════ */
function SectionDivider() {
    return (
        <div className="my-6 flex items-center gap-3 md:my-7">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
            <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-300" style={{ animation: "floatDot 1.6s ease-in-out 0s infinite" }} />
                <div className="h-2 w-2 rounded-full bg-orange-300" style={{ animation: "floatDot 1.6s ease-in-out 0.2s infinite" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-amber-300" style={{ animation: "floatDot 1.6s ease-in-out 0.4s infinite" }} />
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
        </div>
    );
}