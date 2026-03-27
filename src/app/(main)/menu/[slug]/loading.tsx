// src/app/(main)/menu/[slug]/loading.tsx

export default function ProductDetailLoading() {
    return (
        <main className="min-h-screen bg-[#FFFBF5]">
            <style>{`
                @keyframes shimmer {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                .shimmer::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        105deg,
                        transparent 35%,
                        rgba(255,255,255,0.75) 50%,
                        transparent 65%
                    );
                    animation: shimmer 1.6s ease-in-out infinite;
                }
                @keyframes pulse-soft {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 1; }
                }
                .pulse-soft {
                    animation: pulse-soft 2s ease-in-out infinite;
                }
            `}</style>

            {/* Top nav skeleton */}
            <div className="border-b border-amber-100 bg-[#FFFBF5]">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
                    <div className="relative h-8 w-28 overflow-hidden rounded-xl bg-amber-100 shimmer" />
                    <div className="h-4 w-px bg-stone-200" />
                    <div className="relative h-3.5 w-56 overflow-hidden rounded bg-stone-200 shimmer" />
                </div>
            </div>

            <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
                <div className="grid gap-8 md:grid-cols-2 md:gap-14">

                    {/* Image skeleton */}
                    <div className="relative">
                        <div className="relative aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 shimmer">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="pulse-soft text-6xl opacity-20">🍽️</span>
                            </div>
                        </div>
                        {/* Category pill */}
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                            <div className="relative h-7 w-32 overflow-hidden rounded-full border border-amber-200 bg-white shadow-md shimmer" />
                        </div>
                    </div>

                    {/* Details skeleton */}
                    <div className="flex flex-col gap-4 pt-6 md:pt-0">

                        {/* Tags */}
                        <div className="flex gap-2">
                            {[64, 76, 52].map((w, i) => (
                                <div key={i} className="relative h-6 overflow-hidden rounded-full bg-amber-100 shimmer" style={{ width: w }} />
                            ))}
                        </div>

                        {/* Name */}
                        <div className="space-y-2.5">
                            <div className="relative h-9 w-[88%] overflow-hidden rounded-xl bg-stone-200 shimmer" />
                            <div className="relative h-9 w-[62%] overflow-hidden rounded-xl bg-stone-200/60 shimmer" />
                        </div>

                        {/* Rating row */}
                        <div className="flex items-center gap-3">
                            <div className="relative h-7 w-14 overflow-hidden rounded-lg bg-green-200 shimmer" />
                            <div className="relative h-4 w-32 overflow-hidden rounded bg-stone-200 shimmer" />
                            <div className="relative h-4 w-24 overflow-hidden rounded bg-stone-100 shimmer" />
                        </div>

                        {/* Price */}
                        <div className="relative h-14 w-36 overflow-hidden rounded-xl bg-orange-200 shimmer" />

                        {/* Short desc */}
                        <div className="relative h-4 w-[70%] overflow-hidden rounded bg-stone-200/60 shimmer" />

                        {/* Description */}
                        <div className="space-y-2">
                            <div className="relative h-4 w-full overflow-hidden rounded bg-stone-200 shimmer" />
                            <div className="relative h-4 w-[92%] overflow-hidden rounded bg-stone-200 shimmer" />
                            <div className="relative h-4 w-[75%] overflow-hidden rounded bg-stone-200/60 shimmer" />
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-amber-100" />

                        {/* Info cards */}
                        <div className="grid grid-cols-3 gap-3">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="relative h-20 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm shimmer" />
                            ))}
                        </div>

                        {/* Ingredients label */}
                        <div className="space-y-2.5">
                            <div className="relative h-4 w-24 overflow-hidden rounded bg-stone-200 shimmer" />
                            <div className="flex flex-wrap gap-2">
                                {[76, 88, 60, 96, 72, 64].map((w, i) => (
                                    <div key={i} className="relative h-7 overflow-hidden rounded-full bg-amber-100 shimmer" style={{ width: w }} />
                                ))}
                            </div>
                        </div>

                        {/* CTA row */}
                        <div className="hidden gap-3 md:flex">
                            <div className="relative h-11 w-28 overflow-hidden rounded-xl border border-amber-200 bg-white shimmer" />
                            <div className="relative h-11 flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-orange-200 to-amber-200 shimmer" />
                        </div>
                    </div>
                </div>

                {/* Upsell skeleton */}
                <div className="mt-16 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative h-6 w-48 overflow-hidden rounded-lg bg-stone-200 shimmer" />
                        <div className="h-px flex-1 bg-amber-100" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="relative h-24 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm shimmer" />
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}