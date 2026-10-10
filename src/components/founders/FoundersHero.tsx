// src/components/founders/FoundersHero.tsx
//
// FOUNDERS PAGE REDESIGN — rebuilt compact. The prior version had a large
// standalone ambient glow, a tall eyebrow→headline→subtitle→divider stack,
// and ~9rem of combined top/bottom padding on desktop — all of it dead
// space before the founder cards ever appeared. This version keeps the
// same three content pieces (eyebrow, headline, subtitle) but removes the
// decorative divider entirely (the section boundary below already reads as
// a break) and cuts vertical padding so the cards sit closer to the fold
// without the hero ever needing to fill the viewport.
export default function FoundersHero() {
    return (
        <section className="relative px-4 pb-8 pt-10 text-center sm:px-6 sm:pb-10 sm:pt-14 md:px-8 md:pb-12 md:pt-16">
            {/* Single restrained ambient accent — smaller and quieter than
                before, present only to keep the warm brand tone, not to
                carry visual weight of its own. */}
            <div
                className="pointer-events-none absolute left-1/2 top-0 h-[180px] w-[420px] -translate-x-1/2 rounded-full opacity-[0.08] blur-3xl"
                style={{ background: "radial-gradient(ellipse, #FF5C1A, transparent 70%)" }}
                aria-hidden="true"
            />

            <div className="relative mx-auto max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-white/70 px-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-600">
                        The People Behind the Brand
                    </p>
                </div>

                {/* Fluid, clamp-based headline — wraps naturally at every
                    width instead of relying on a fixed px/breakpoint ladder,
                    and never needs to dominate the full viewport height. */}
                <h1 className="mb-4 text-[clamp(1.9rem,6vw,3.25rem)] font-black leading-[1.08] tracking-[-0.02em] text-gray-900">
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Meet the Minds Behind{" "}
                        <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                            FoodKnock
                        </span>
                    </span>
                </h1>

                <p className="mx-auto max-w-md text-[15px] leading-[1.65] text-gray-500 sm:text-base">
                    Two brothers from Rajasthan. Two very different skills.
                    One refusal to settle for average.
                </p>
            </div>
        </section>
    );
}
