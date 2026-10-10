// src/components/home/FinalCta.tsx
//
// FoodKnock UI 2.0 — Phase 2: extracted from the inline `FinalCTA` function
// that used to live directly in src/app/(main)/page.tsx. Same static
// content/links, restyled to dark tokens. Server component.

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function FinalCta() {
    return (
        <section className="px-4 py-10 md:px-8">
            <div className="relative overflow-hidden rounded-fk-lg bg-gradient-to-br from-[var(--fk-accent)] via-[var(--fk-accent)] to-[var(--fk-gold)] p-8 md:p-12">
                <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="max-w-lg">
                        <h2 className="font-display text-2xl font-black text-white md:text-3xl">
                            Ready to order something <span className="text-white/85">amazing?</span>
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-white/80">
                            Fresh food, fast delivery, smooth online ordering — the FoodKnock experience starts the moment you tap.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-3">
                        <Link href="/menu" className="inline-flex items-center justify-center gap-2 rounded-fk-pill bg-white px-8 py-3.5 text-sm font-black text-fk-text shadow-fk-lg transition-all active:scale-95">
                            Start Your Order <ArrowRight size={14} />
                        </Link>
                        <Link href="/contact" className="inline-flex items-center justify-center gap-2 rounded-fk-pill border-2 border-white/30 bg-white/10 px-8 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all">
                            Get in Touch
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
