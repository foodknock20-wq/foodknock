// src/components/founders/FoundersHero.tsx
export default function FoundersHero() {
    return (
        <section className="relative px-4 pb-20 pt-28 text-center sm:px-6 md:px-8 md:pb-24 md:pt-36">
            {/* Ambient glow — softened, single warm source */}
            <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.10] blur-3xl"
                style={{ background: "radial-gradient(ellipse, #FF5C1A, transparent 70%)" }}
                aria-hidden="true"
            />

            <div className="relative mx-auto max-w-2xl">
                {/* Eyebrow — tighter, calmer, no pulse (subtle > flashy) */}
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-white/70 px-4 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-orange-600">
                        The People Behind the Brand
                    </p>
                </div>

                {/* Headline — tighter line-height, better weight contrast between lines */}
                <h1 className="mb-6 text-[2.75rem] font-black leading-[1.08] tracking-[-0.02em] text-gray-900 sm:text-[3.25rem] md:text-[3.75rem]">
                    <span
                        className="block"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                        Meet the Minds
                    </span>
                    <span
                        className="mt-1 block bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                        Behind FoodKnock
                    </span>
                </h1>

                {/* Subtitle — narrower measure for readability, calmer weight */}
                <p className="mx-auto max-w-md text-[15.5px] leading-[1.7] text-gray-500 sm:text-base">
                    Two brothers from Rajasthan. Two very different skills.
                    One refusal to settle for average.
                </p>

                {/* Divider — thinner, more restrained */}
                <div className="mx-auto mt-14 flex items-center justify-center gap-2.5">
                    <div className="h-px w-16 bg-gradient-to-r from-transparent to-orange-200" />
                    <div className="h-1 w-1 rounded-full bg-orange-400" />
                    <div className="h-px w-16 bg-gradient-to-l from-transparent to-orange-200" />
                </div>
            </div>
        </section>
    );
}