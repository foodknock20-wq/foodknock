// src/components/founders/FoodknockStory.tsx
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

export default function FoodknockStory() {
    return (
        <section className="relative px-4 py-24 sm:px-6 md:px-8 md:py-32">
            {/* Ambient gradient — quieter */}
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
                <div className="mb-16 max-w-xl md:mb-20">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-white/70 px-4 py-1.5 backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-orange-600">
                            How We Got Here
                        </p>
                    </div>
                    <h2
                        className="mb-4 text-[2.25rem] font-black leading-[1.12] tracking-[-0.015em] text-gray-900 sm:text-4xl md:text-[2.75rem]"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                        The FoodKnock Story
                    </h2>
                    <p className="max-w-[46ch] text-[15px] leading-[1.7] text-gray-500">
                        Not a startup fairy tale. Just two brothers who saw the same gap,
                        from different angles, and decided to close it.
                    </p>
                </div>

                {/* Story pillars — timeline feel via connecting rhythm, subtle depth on hover */}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {pillars.map(({ step, color, title, body }) => (
                        <div
                            key={step}
                            className="group relative rounded-2xl border border-black/[0.06] bg-white p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-black/[0.08] sm:p-7"
                            style={{
                                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = `0 16px 32px -12px ${color}30`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
                            }}
                        >
                            {/* Step indicator */}
                            <div
                                className="mb-6 inline-flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-black text-white transition-transform duration-300 ease-out group-hover:scale-105"
                                style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
                            >
                                {step}
                            </div>

                            <h3 className="mb-2.5 text-[15.5px] font-black leading-snug text-gray-900">
                                {title}
                            </h3>
                            <p className="text-[13.5px] leading-[1.7] text-gray-500">
                                {body}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Mission statement block — cleaner, calmer surface */}
                <div
                    className="mt-10 rounded-3xl border p-8 sm:p-10 md:p-12"
                    style={{
                        borderColor: "rgba(255, 92, 26, 0.16)",
                        background: "linear-gradient(135deg, #fffaf3 0%, #ffffff 100%)",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                >
                    <div className="grid gap-9 sm:grid-cols-3 sm:gap-8">
                        {[
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
                        ].map(({ label, text }) => (
                            <div key={label}>
                                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.26em] text-orange-600">
                                    {label}
                                </p>
                                <p className="max-w-[32ch] text-[14px] leading-[1.75] text-gray-600">
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