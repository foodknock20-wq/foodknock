// src/components/home/SpinWinCTA.tsx
//
// Homepage "Spin & Win" CTA — discovery/navigation only. Does NOT import or
// render the existing Spin wheel (SpinWheelSection), fetch reward config, or
// touch loyalty-points logic in any way; it's a plain link to the existing
// /loyalty page's URL-synced tab state (src/app/(main)/loyalty/page.tsx
// already reads `?tab=spin` directly into activeTab on load, and now also
// auto-scrolls to the Spin section on that exact deep-link entry — see that
// file). The Spin system itself only loads once that page actually renders
// the Spin tab.
//
// Premium CTA polish — deliberately does NOT paint a saturated gradient
// across the whole button (that reads as a "cheap promo button"/casino UI
// per the design brief). The warm orange/gold accent is CONTAINED to the
// small icon badge instead; the button surface itself stays a soft cream
// wash with an amber border, just a shade stronger than ReferralPill's to
// read as "slightly more emphasis," not "flashy."
//
// No "use client" needed — this is a static link with CSS-only hover/active
// states, so it costs zero extra client JS on the homepage.
//
// scroll={false}: Next.js's <Link> scrolls the window to the top of the new
// page by default on navigation — this was found (via real browser QA) to
// race the Loyalty page's own deep-link auto-scroll effect and win,
// silently resetting the scroll position back to 0 after the effect ran.
// Disabling Next's default here (scoped to ONLY this one link, not
// globally) removes that competing scroll authority — the destination
// page's own effect is now the single source of truth for scroll position
// on this specific navigation.

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export default function SpinWinCTA() {
    return (
        <Link
            href="/loyalty?tab=spin"
            scroll={false}
            aria-label="Spin and Eat — spin the FoodKnock wheel for a tasty reward"
            className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-fk-lg border border-amber-300/70 bg-gradient-to-br from-amber-50 to-orange-50 px-3.5 py-3 text-left shadow-fk-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-fk-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fk-accent)]/40 sm:px-4 md:flex-initial"
        >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-fk-md bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] text-white shadow-fk-sm">
                <Sparkles size={15} strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-black leading-tight text-fk-text sm:text-[13px]">
                Spin &amp; Eat
            </span>
            <ArrowRight
                size={15}
                strokeWidth={2.25}
                className="hidden shrink-0 text-[var(--fk-accent)] transition-transform duration-200 group-hover:translate-x-0.5 sm:inline-block"
            />
        </Link>
    );
}
