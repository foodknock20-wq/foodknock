// src/app/(main)/menu/loading.tsx
// FoodKnock — Premium skeleton loader
// Pixel-matches real card shapes · ember shimmer · cream bg · mobile-first

export default function Loading() {
    return (
        <main className="min-h-screen overflow-x-hidden bg-[#FFFBF5]">
            <style>{`
                @keyframes fk-sweep {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(220%); }
                }
                @keyframes fk-breathe {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.45; }
                }
                @keyframes fk-bar {
                    0%, 80%, 100% { transform: scaleY(1);   opacity: 0.45; }
                    40%           { transform: scaleY(1.7); opacity: 1; }
                }
                .fk-s {
                    position: relative;
                    overflow: hidden;
                    border-radius: inherit;
                }
                .fk-s::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        100deg,
                        transparent 20%,
                        rgba(255,255,255,0.74) 50%,
                        transparent 80%
                    );
                    animation: fk-sweep 1.75s cubic-bezier(0.4,0,0.6,1) infinite;
                }
            `}</style>

            {/* ── Ambient glows ── */}
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full opacity-[0.17] blur-3xl"
                    style={{ background: "radial-gradient(circle, #FF5C1A, transparent 70%)" }} />
                <div className="absolute -right-20 top-40 h-64 w-64 rounded-full opacity-[0.11] blur-3xl"
                    style={{ background: "radial-gradient(circle, #FFB347, transparent 70%)" }} />
            </div>

            <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">

                {/* ════ HERO SKELETON ════ */}
                <section className="mb-10 md:mb-12">
                    <div className="fk-s mb-4 h-7 w-44 rounded-full"
                        style={{ background: "rgba(255,92,26,0.13)" }} />
                    <div className="space-y-2.5">
                        <div className="fk-s h-10 rounded-2xl md:h-12"
                            style={{ width: "62%", background: "rgba(255,92,26,0.11)", animationDelay: "0.06s" }} />
                        <div className="fk-s h-10 rounded-2xl md:h-12"
                            style={{ width: "46%", background: "rgba(255,92,26,0.08)", animationDelay: "0.12s" }} />
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="fk-s h-4 w-full max-w-md rounded-lg bg-stone-200" style={{ animationDelay: "0.16s" }} />
                        <div className="fk-s h-4 rounded-lg bg-stone-200" style={{ width: "56%", animationDelay: "0.20s" }} />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                        {[88, 102, 110, 90].map((w, i) => (
                            <div key={i} className="fk-s h-8 rounded-full"
                                style={{ width: w, background: "rgba(255,92,26,0.10)", animationDelay: `${0.24 + i * 0.05}s` }} />
                        ))}
                    </div>
                </section>

                {/* ════ CONTROLS SKELETON ════ */}
                <section className="mb-6 space-y-3">
                    <div className="flex gap-2.5">
                        <div className="relative flex-1 overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm" style={{ height: 46 }}>
                            <div className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-stone-200"
                                style={{ animation: "fk-breathe 1.6s ease-in-out infinite" }} />
                            <div className="absolute left-11 top-1/2 h-3 w-40 -translate-y-1/2 rounded-md bg-stone-100"
                                style={{ animation: "fk-breathe 1.6s ease-in-out 0.2s infinite" }} />
                        </div>
                        <div className="fk-s h-[46px] w-24 rounded-2xl border border-stone-100 bg-white shadow-sm" />
                        <div className="fk-s hidden h-[46px] w-20 rounded-2xl border border-stone-100 bg-white shadow-sm sm:block" />
                    </div>
                    <div className="flex gap-1.5 overflow-hidden">
                        {[62, 80, 72, 90, 64, 78, 70, 84].map((w, i) => (
                            <div key={i} className="fk-s h-9 shrink-0 rounded-full bg-stone-100"
                                style={{ width: w, border: "1px solid rgba(0,0,0,0.06)", animationDelay: `${i * 0.04}s` }} />
                        ))}
                    </div>
                </section>

                {/* ════ COMBO STRIP SKELETON ════ */}
                <section className="mb-8 overflow-hidden rounded-3xl"
                    style={{ background: "linear-gradient(160deg,#161210,#1e1612)" }}>
                    <div className="p-5 md:p-8">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="fk-s h-11 w-11 rounded-2xl"
                                style={{ background: "rgba(255,92,26,0.28)" }} />
                            <div className="space-y-2">
                                <div className="fk-s h-3 w-24 rounded bg-white/10" />
                                <div className="fk-s h-5 w-52 rounded-lg bg-white/14" style={{ animationDelay: "0.07s" }} />
                            </div>
                        </div>
                        <div className="fk-s mb-5 h-10 w-72 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
                        <div className="flex gap-4 overflow-hidden">
                            {[0, 1, 2, 3].map(i => <ComboSkel key={i} delay={i * 0.07} />)}
                        </div>
                    </div>
                </section>

                {/* ════ PRODUCT GRID SKELETON ════ */}
                <section>
                    <div className="mb-6 flex items-center justify-between">
                        <div className="space-y-1.5">
                            <div className="fk-s h-3 w-16 rounded bg-stone-200" />
                            <div className="fk-s h-6 w-28 rounded-lg bg-stone-200" style={{ animationDelay: "0.05s" }} />
                        </div>
                        <div className="fk-s h-9 w-20 rounded-2xl border border-stone-100 bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, i) => <CardSkel key={i} delay={i * 0.05} />)}
                    </div>
                </section>

                {/* ── Loading bars ── */}
                <div className="mt-14 flex items-center justify-center gap-1.5">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 rounded-full"
                            style={{
                                height: 22, background: "#FF5C1A", opacity: 0.35,
                                animation: `fk-bar 1.2s ease-in-out ${i * 0.16}s infinite`
                            }} />
                    ))}
                </div>
            </div>
        </main>
    );
}

function ComboSkel({ delay }: { delay: number }) {
    return (
        <div className="fk-s shrink-0 overflow-hidden rounded-2xl"
            style={{
                minWidth: 230, maxWidth: 264, animationDelay: `${delay}s`,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)"
            }}>
            <div className="h-[3px] w-full" style={{ background: "rgba(255,92,26,0.45)" }} />
            <div className="relative" style={{ height: 148, background: "rgba(255,255,255,0.04)" }}>
                <div className="absolute inset-0 flex items-center justify-center"
                    style={{ animation: `fk-breathe 1.6s ease-in-out ${delay + 0.1}s infinite` }}>
                    <div className="h-14 w-14 rounded-2xl bg-white/10" />
                </div>
                <div className="absolute left-2.5 top-2.5 h-6 w-24 rounded-full bg-white/10" />
                <div className="absolute bottom-2.5 right-2.5 h-7 w-16 rounded-xl bg-white/15" />
            </div>
            <div className="space-y-2.5 p-3.5">
                <div className="flex items-center justify-between">
                    <div className="fk-s h-4 w-20 rounded-full bg-white/12" style={{ animationDelay: `${delay + 0.05}s` }} />
                    <div className="h-3 w-14 rounded bg-white/8" />
                </div>
                <div className="fk-s h-4 rounded-lg bg-white/14" style={{ width: "88%", animationDelay: `${delay + 0.09}s` }} />
                <div className="h-4 rounded-lg bg-white/8" style={{ width: "64%" }} />
                <div className="border-t border-white/8" />
                <div className="fk-s h-9 w-full rounded-xl bg-white/10" style={{ animationDelay: `${delay + 0.14}s` }} />
            </div>
        </div>
    );
}

function CardSkel({ delay }: { delay: number }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm sm:rounded-3xl">
            <div className="fk-s relative bg-stone-100" style={{ height: 144, animationDelay: `${delay}s` }}>
                <div className="absolute inset-0 flex items-center justify-center"
                    style={{ animation: `fk-breathe 1.55s ease-in-out ${delay + 0.1}s infinite` }}>
                    <div className="h-14 w-14 rounded-2xl bg-stone-200/70" />
                </div>
                <div className="absolute left-2.5 top-2.5 h-5 w-20 rounded-full bg-stone-200/80" />
                <div className="absolute right-2.5 top-2.5 h-5 w-14 rounded-full bg-stone-200/60" />
                <div className="absolute bottom-2 right-2 h-6 w-12 rounded-xl bg-white/90 sm:hidden" />
            </div>
            <div className="flex flex-1 flex-col p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="fk-s h-4 w-16 rounded-full bg-stone-100" style={{ animationDelay: `${delay + 0.04}s` }} />
                    <div className="fk-s h-3 w-12 rounded bg-stone-100" style={{ animationDelay: `${delay + 0.06}s` }} />
                </div>
                <div className="fk-s mb-1.5 h-[15px] rounded-lg bg-stone-200" style={{ width: "85%", animationDelay: `${delay + 0.08}s` }} />
                <div className="fk-s mb-3 h-[15px] rounded-lg bg-stone-200/70" style={{ width: "58%", animationDelay: `${delay + 0.10}s` }} />
                <div className="fk-s hidden h-3 w-full rounded bg-stone-100 sm:block" style={{ animationDelay: `${delay + 0.12}s` }} />
                <div className="mt-3 flex items-center justify-between gap-2 pt-2">
                    <div className="hidden space-y-1 sm:block">
                        <div className="fk-s h-5 w-14 rounded-lg bg-stone-200" style={{ animationDelay: `${delay + 0.14}s` }} />
                        <div className="fk-s h-3 w-10 rounded bg-stone-100" style={{ animationDelay: `${delay + 0.16}s` }} />
                    </div>
                    <div className="fk-s h-9 flex-1 rounded-xl sm:w-24 sm:flex-none"
                        style={{
                            background: "linear-gradient(135deg,rgba(255,92,26,0.14),rgba(255,140,66,0.14))",
                            animationDelay: `${delay + 0.18}s`
                        }} />
                </div>
            </div>
        </div>
    );
}