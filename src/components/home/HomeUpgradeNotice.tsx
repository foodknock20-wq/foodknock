"use client";

// src/components/home/HomeUpgradeNotice.tsx
//
// TEMPORARY — FoodKnock 2.0 migration notice. Tells existing customers the
// system has upgraded and their old account no longer works, so they need
// to sign up again. Homepage-only, directly above the search bar. Intended
// to be removed entirely after ~1 month (around mid-November 2026) once
// the migration has run its course — no countdown/expiry logic by design,
// just delete this file and its one import/usage in page.tsx when done.
//
// Self-contained: copy + language toggle state live here, no new
// dependency, no API/DB/feature-flag involved.
//
// Mobile fix: the full desktop copy doesn't fit on one line below ~400px
// without either an ellipsis swallowing the "sign up again" instruction
// (the whole point of the notice) or shrinking text past readable size.
// Below the `sm` breakpoint a shorter, complete copy is shown instead
// (same meaning, no information lost); `line-clamp-2` is kept only as a
// safety net so an unexpectedly narrow viewport wraps to a second line
// rather than overflowing, never silently truncating the actual message.

import { useState } from "react";
import { Sparkle } from "lucide-react";

const COPY: Record<"en" | "hi", { full: string; short: string }> = {
    en: {
        full: "FoodKnock 2.0 is here ✦ Old account? Please sign up again.",
        short: "FoodKnock 2.0 ✦ Old account? Sign up again.",
    },
    hi: {
        full: "FoodKnock 2.0 आ गया है ✦ पुराना अकाउंट है? कृपया नया अकाउंट बनाएँ।",
        short: "FoodKnock 2.0 ✦ पुराना अकाउंट? नया साइन अप करें।",
    },
};

type Lang = keyof typeof COPY;

export default function HomeUpgradeNotice() {
    const [lang, setLang] = useState<Lang>("en");

    return (
        <div className="border-b border-[var(--fk-gold)]/20 bg-[var(--fk-gold-soft)] px-3 py-1.5 sm:px-4 md:px-8">
            <div className="mx-auto flex max-w-5xl items-center gap-2">
                <Sparkle size={12} strokeWidth={2.25} className="mt-px shrink-0 text-[var(--fk-gold)]" />
                <p className="min-w-0 flex-1 line-clamp-2 text-[11px] font-medium leading-snug tracking-tight text-fk-text sm:line-clamp-1 sm:text-[12px] md:text-[13px]">
                    <span className="sm:hidden">{COPY[lang].short}</span>
                    <span className="hidden sm:inline">{COPY[lang].full}</span>
                </p>
                <button
                    type="button"
                    onClick={() => setLang((l) => (l === "en" ? "hi" : "en"))}
                    aria-label={lang === "en" ? "Switch to Hindi" : "Switch to English"}
                    className="shrink-0 rounded-fk-sm border-l border-[var(--fk-gold)]/20 pl-2.5 pr-0.5 py-0.5 text-[11px] font-semibold text-[var(--fk-gold)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fk-gold)]"
                >
                    {lang === "en" ? "हिंदी" : "EN"}
                </button>
            </div>
        </div>
    );
}
