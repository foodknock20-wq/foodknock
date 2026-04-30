// src/components/founders/FoodknockStory.tsx
const pillars = [
    {
        step: "01",
        color: "#FF5C1A",
        title: "The Problem Was Obvious",
        body: "Great food existed in Danta and Sikar. Ordering it reliably online didn't. No trust, no quality assurance, no experience worth returning to.",
    },
    {
        step: "02",
        color: "#f59e0b",
        title: "Three Skills Aligned",
        body: "Manish read the market and built the brand. Gaurav engineered a platform from scratch. Ajay made every single order operationally sound. Three directions, one outcome.",
    },
    {
        step: "03",
        color: "#10b981",
        title: "Built for Real People",
        body: "No outside funding. No corporate playbook. FoodKnock was built from the same streets it serves — with the standards of a startup that has something to prove.",
    },
    {
        step: "04",
        color: "#818cf8",
        title: "The Work Continues",
        body: "Every update, every new item, every delivery is an iteration. FoodKnock is not finished — it's building toward something bigger in Rajasthan.",
    },
];

export default function FoodknockStory() {
    return (
        <section className="relative px-4 py-20 md:px-8 md:py-28">
            {/* Subtle warm gradient overlay */}
            <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                    background:
                        "linear-gradient(180deg, transparent 0%, rgba(255,247,237,0.5) 50%, transparent 100%)",
                }}
                aria-hidden="true"
            />

            <div className="relative mx-auto max-w-7xl">
                {/* Section header */}
                <div className="mb-16 max-w-2xl">
                    <div className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-orange-200/60 bg-orange-50/80 px-5 py-2 backdrop-blur-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-orange-600">
                            How We Got Here
                        </p>
                    </div>
                    <h2
                        className="mb-4 text-4xl font-black leading-tight tracking-tight text-gray-900 md:text-5xl"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                        The FoodKnock Story
                    </h2>
                    <p className="text-[15px] leading-relaxed text-gray-600">
                        Not a startup fairy tale. Just three people who saw the same gap, from different angles, and decided to close it.
                    </p>
                </div>

                {/* Story pillars grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {pillars.map(({ step, color, title, body }) => (
                        <div
                            key={step}
                            className="group rounded-3xl border bg-white p-7 shadow-sm transition-all duration-300 hover:shadow-xl"
                            style={{
                                borderColor: "rgba(229, 231, 235, 0.6)",
                            }}
                        >
                            {/* Step indicator */}
                            <div
                                className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-black shadow-sm transition-transform duration-300 group-hover:scale-110"
                                style={{
                                    background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                                    color: "#ffffff",
                                }}
                            >
                                {step}
                            </div>

                            <h3 className="mb-3 text-[16px] font-black leading-tight text-gray-900">
                                {title}
                            </h3>
                            <p className="text-[13.5px] leading-[1.75] text-gray-600">
                                {body}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Mission statement block */}
                <div
                    className="mt-12 rounded-3xl border p-8 shadow-lg md:p-10"
                    style={{
                        borderColor: "rgba(255, 92, 26, 0.2)",
                        background: "linear-gradient(135deg, #fff9f0 0%, #ffffff 100%)",
                    }}
                >
                    <div className="grid gap-8 md:grid-cols-3">
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
                                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-orange-600">
                                    {label}
                                </p>
                                <p className="text-[14px] leading-[1.8] text-gray-700">
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