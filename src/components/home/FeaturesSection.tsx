// src/components/home/FeaturesSection.tsx — "How It Works"
//
// FoodKnock UI 2.0 — Phase 2: restyled to dark tokens and converted from an
// unnecessary "use client" to a server component (spec section 41/34) —
// confirmed zero real interactivity: the old onMouseEnter/onMouseLeave JS
// only toggled a box-shadow/translate that Tailwind's own `hover:` classes
// already replicate, so it's dropped rather than ported. Content/links
// unchanged.

import Link from "next/link";
import { Search, ChefHat, Bike, Repeat2, ArrowRight, CheckCircle2 } from "lucide-react";

const steps = [
    {
        step: "01", icon: Search, title: "Browse & Pick",
        description: "Explore our full menu of freshly prepared meals — burgers, pizzas, shakes, momos and more. Filter by category, see prices, and add to cart in one tap.",
        highlight: "100+ menu items",
        perks: ["Easy category navigation", "Clear pricing", "Instant add-to-cart"],
    },
    {
        step: "02", icon: ChefHat, title: "We Prepare Fresh",
        description: "The moment your order is confirmed, our kitchen gets to work. Everything is made fresh — no pre-packaged, no reheated. Real food, made for you.",
        highlight: "Freshly made every time",
        perks: ["Prepared after ordering", "No pre-made batches", "Consistent quality"],
    },
    {
        step: "03", icon: Bike, title: "Fast Local Delivery",
        description: "Hot food leaves our kitchen in minutes and reaches your door fast. Local delivery that's genuinely quick — typically 30–45 minutes from order to doorstep.",
        highlight: "~30–45 min avg.",
        perks: ["Hot & fresh on arrival", "Real-time tracking", "Pickup available too"],
    },
    {
        step: "04", icon: Repeat2, title: "Reorder in One Tap",
        description: "Install FoodKnock on your home screen for a native app-like experience. Repeat your favourite order in seconds — no app store, no friction.",
        highlight: "One-tap reorders",
        perks: ["Works like a native app", "No App Store needed", "Faster every time"],
    },
];

export default function FeaturesSection() {
    return (
        <section className="px-4 py-12 md:px-8 md:py-16">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="max-w-lg">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--fk-accent)]">
                        How FoodKnock Works
                    </p>
                    <h2 className="font-display text-2xl font-black leading-tight text-fk-text md:text-3xl">
                        From craving to doorstep — made simple.
                    </h2>
                </div>
                <Link href="/menu" className="hidden shrink-0 items-center gap-2 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-5 py-2.5 text-sm font-bold text-fk-text-secondary md:inline-flex">
                    Browse Menu <ArrowRight size={13} />
                </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {steps.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <div
                            key={s.step}
                            className="group relative flex flex-col overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                        >
                            <span className="pointer-events-none absolute -right-2 -top-4 select-none text-[6rem] font-black leading-none text-[var(--fk-accent)] opacity-[0.06]" aria-hidden="true">
                                {s.step}
                            </span>
                            <div className="relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-fk-md bg-fk-surface-selected text-[var(--fk-accent)]">
                                <Icon size={22} />
                            </div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--fk-accent)]">
                                Step {i + 1}
                            </p>
                            <h3 className="font-display text-[16px] font-black leading-snug text-fk-text">{s.title}</h3>
                            <p className="mt-2 text-[12.5px] leading-relaxed text-fk-text-secondary">{s.description}</p>
                            <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-fk-pill bg-fk-surface-selected px-3 py-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-[var(--fk-accent)]" />
                                <span className="text-[10.5px] font-bold text-[var(--fk-accent)]">{s.highlight}</span>
                            </div>
                            <ul className="mt-4 space-y-2 border-t border-fk-border pt-4">
                                {s.perks.map((perk) => (
                                    <li key={perk} className="flex items-center gap-2 text-[11.5px] text-fk-text-secondary">
                                        <CheckCircle2 size={12} className="shrink-0 text-[var(--fk-accent)]" strokeWidth={2.5} />
                                        {perk}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
