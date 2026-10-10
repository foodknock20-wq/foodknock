// src/components/founders/FoodknockStory.tsx
//
// FOUNDERS PAGE REDESIGN — rebuilt as a connected timeline narrative rather
// than four identical white cards followed by a separate large rounded
// panel. Desktop keeps the four steps in one row, now joined by a single
// connecting line that actually reads as "a sequence," not just a grid.
// Mobile drops to a vertical timeline (left rail + dot) instead of forcing
// four narrow columns. The previous version's `onMouseEnter`/`onMouseLeave`
// handlers imperatively wrote inline `boxShadow` on hover — removed; the
// step marker's own `group-hover:scale-105` (plain CSS) is enough feedback
// without re-introducing a JS-driven inline style on hover.
const pillars = [
    {
        step: "01",
        color: "#FF5C1A",
        title: "A Local Problem",
        body: "Great food existed in Danta and Sikar. Ordering it reliably online didn't. No trust, no quality assurance, no experience worth returning to.",
    },
    {
        step: "02",
        color: "#f59e0b",
        title: "Two Brothers",
        body: "Manish and Gaurav Kumawat — real brothers — saw the same gap from two different angles and decided to close it together, as co-founders.",
    },
    {
        step: "03",
        color: "#10b981",
        title: "Business + Technology",
        body: "Manish built the brand, the vendor relationships, and the growth strategy. Gaurav architected and built the entire platform, end to end. Two disciplines, one company.",
    },
    {
        step: "04",
        color: "#818cf8",
        title: "Building Rajasthan's Future",
        body: "No outside funding. No corporate playbook. FoodKnock was built from the same streets it serves — with the standards of a startup that has something to prove.",
    },
];

const missionPillars = [
    {
        label: "Our Mission",
        text: "Make premium food ordering accessible to every household in Rajasthan — with quality that doesn't compromise.",
    },
    {
        label: "Our Standard",
        text: "Every order is prepared fresh. No shortcuts on ingredients. No excuses on packaging. Every time.",
    },
    {
        label: "Our Promise",
        text: "Fast, honest, and worth coming back to. That's the bar we set ourselves — and the one our customers hold us to.",
    },
];

export default function FoodknockStory() {
    return (
        <section className="relative px-4 py-14 sm:px-6 sm:py-20 md:px-8 md:py-24">
            <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                    background:
                        "linear-gradient(180deg, transparent 0%, rgba(255,247,237,0.5) 50%, transparent 100%)",
                }}
                aria-hidden="true"
            />

            <div className="relative mx-auto max-w-6xl">
                {/* Section header */}
                <div className="mb-10 max-w-xl md:mb-14">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-white/70 px-3.5 py-1.5 backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-600">
                            How We Got Here
                        </p>
                    </div>
                    <h2
                        className="mb-3 text-[clamp(1.6rem,4vw,2.75rem)] font-black leading-[1.12] tracking-[-0.015em] text-gray-900"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                        The FoodKnock Story
                    </h2>
                    <p className="max-w-[46ch] text-[15px] leading-[1.7] text-gray-500">
                        Not a startup fairy tale. Just two brothers who saw the same gap,
                        from different angles, and decided to close it.
                    </p>
                </div>

                {/* ── Desktop: connected horizontal timeline ── */}
                <div className="hidden md:block">
                    <div className="relative grid grid-cols-4 gap-6">
                        {/* Connecting rail, behind the step markers */}
                        <div
                            className="absolute left-[12.5%] right-[12.5%] top-[18px] h-px bg-gradient-to-r from-orange-200 via-amber-200 to-indigo-200"
                            aria-hidden="true"
                        />
                        {pillars.map(({ step, color, title, body }) => (
                            <div key={step} className="group relative pt-0">
                                <div
                                    className="relative z-10 mb-5 inline-flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-black text-white ring-4 ring-[#FFFBF5] transition-transform duration-300 ease-out group-hover:scale-105"
                                    style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
                                >
                                    {step}
                                </div>
                                <h3 className="mb-2 text-[15px] font-black leading-snug text-gray-900">
                                    {title}
                                </h3>
                                <p className="text-[13.5px] leading-[1.7] text-gray-500">
                                    {body}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Mobile: vertical timeline ── */}
                <div className="space-y-7 md:hidden">
                    {pillars.map(({ step, color, title, body }, i) => (
                        <div key={step} className="relative flex gap-4 pl-0">
                            <div className="flex flex-col items-center">
                                <div
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                                    style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
                                >
                                    {step}
                                </div>
                                {i < pillars.length - 1 && (
                                    <div className="mt-1 w-px flex-1 bg-gradient-to-b from-orange-200 to-transparent" aria-hidden="true" />
                                )}
                            </div>
                            <div className="pb-1">
                                <h3 className="mb-1.5 text-[14.5px] font-black leading-snug text-gray-900">
                                    {title}
                                </h3>
                                <p className="text-[13px] leading-[1.65] text-gray-500">
                                    {body}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Mission / Standard / Promise ── */}
                <div className="mt-12 border-t border-orange-100 pt-10 md:mt-16 md:pt-12">
                    <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
                        {missionPillars.map(({ label, text }, i) => (
                            <div
                                key={label}
                                className={
                                    i > 0
                                        ? "sm:border-l sm:border-orange-100 sm:pl-6"
                                        : undefined
                                }
                            >
                                <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.24em] text-orange-600">
                                    {label}
                                </p>
                                <p className="max-w-[32ch] text-[14px] leading-[1.7] text-gray-600">
                                    {text}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
