// src/components/founders/FoundersHero.tsx
export default function FoundersHero() {
    return (
        <section className="relative px-4 pb-16 pt-24 text-center md:px-8 md:pt-32">
            {/* Subtle warm glow accent */}
            <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-3xl"
                style={{ background: "radial-gradient(ellipse, #FF5C1A, transparent 70%)" }}
                aria-hidden="true"
            />

            <div className="relative mx-auto max-w-3xl">
                {/* Premium eyebrow */}
                <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-orange-200/60 bg-orange-50/80 px-5 py-2 backdrop-blur-sm">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-orange-600">
                        The People Behind the Brand
                    </p>
                </div>

                {/* Elegant headline */}
                <h1
                    className="mb-6 text-5xl font-black leading-[1.1] tracking-tight text-gray-900 md:text-6xl"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                    Meet the Minds
                    <br />
                    <span
                        className="inline-block bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent"
                    >
                        Behind FoodKnock
                    </span>
                </h1>

                <p className="mx-auto max-w-xl text-[16px] leading-relaxed text-gray-600">
                    Three people from Rajasthan. Three very different skills. One refusal to settle for average.
                </p>

                {/* Premium decorative divider */}
                <div className="mx-auto mt-12 flex items-center justify-center gap-3">
                    <div className="h-px w-20 bg-gradient-to-r from-transparent via-orange-300 to-transparent opacity-60" />
                    <div className="flex gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-400 opacity-80" />
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500 opacity-90" />
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-400 opacity-80" />
                    </div>
                    <div className="h-px w-20 bg-gradient-to-r from-transparent via-orange-300 to-transparent opacity-60" />
                </div>
            </div>
        </section>
    );
}