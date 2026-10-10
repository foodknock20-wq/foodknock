"use client";

// src/components/home/HomeSearchEntry.tsx
//
// FoodKnock UI 2.0 — Phase 2: Home's prominent search entry point.
// Pre-Phase 17 — Phase 3: upgraded from a plain text input that navigated
// straight to /menu?search=... into the real discovery entry point — tapping
// it opens SearchOverlay (instant suggestions, recent searches, typo
// tolerance); submitting from inside the overlay still lands on the exact
// same /menu?search=<value> experience as before, unchanged.

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import SearchOverlay from "@/components/search/SearchOverlay";

// Animated-placeholder-only addition — this button has no real <input>
// (it just opens SearchOverlay, which owns the actual search input/value/
// debounce/navigation, all untouched here). So this is purely the closed-
// state label text; there is no user-typed value this could ever clobber.
const PLACEHOLDER_PHRASES = [
    "What are you craving today?",
    "Pizza?",
    "Burger?",
    "Something cheesy?",
    "Craving a cold drink?",
    "How about some momos?",
    "Looking for something under ₹99?",
    "Treat yourself today!",
    "What's your craving?",
];

const TYPE_MS = 80;
const DELETE_MS = 40;
const HOLD_MS = 1500;
const NEXT_PAUSE_MS = 350;

/** Cycles PLACEHOLDER_PHRASES with a type/hold/delete/pause loop. Pauses
 *  entirely while `active` is false (e.g. SearchOverlay is open, or the
 *  user prefers reduced motion) — no timer runs, no re-renders happen. */
function useTypingPlaceholder(active: boolean): string {
    // Read once at mount (lazy initializer, not an effect) so the
    // reduced-motion case never needs a setState call inside the effect
    // body below — it's already reflected in the initial render.
    const [reduceMotion] = useState(
        () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    );
    const [text, setText] = useState(() => (reduceMotion ? PLACEHOLDER_PHRASES[0] : ""));

    useEffect(() => {
        if (!active || reduceMotion) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        let phraseIndex = 0;

        function type(phrase: string, charIndex: number) {
            if (cancelled) return;
            setText(phrase.slice(0, charIndex));
            if (charIndex < phrase.length) {
                timer = setTimeout(() => type(phrase, charIndex + 1), TYPE_MS);
            } else {
                timer = setTimeout(() => erase(phrase, phrase.length), HOLD_MS);
            }
        }

        function erase(phrase: string, charIndex: number) {
            if (cancelled) return;
            setText(phrase.slice(0, charIndex));
            if (charIndex > 0) {
                timer = setTimeout(() => erase(phrase, charIndex - 1), DELETE_MS);
            } else {
                phraseIndex = (phraseIndex + 1) % PLACEHOLDER_PHRASES.length;
                timer = setTimeout(() => type(PLACEHOLDER_PHRASES[phraseIndex], 1), NEXT_PAUSE_MS);
            }
        }

        // Starts from empty, pauses briefly, then types phrase 0 from scratch.
        timer = setTimeout(() => type(PLACEHOLDER_PHRASES[0], 1), NEXT_PAUSE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [active, reduceMotion]);

    return text;
}

export default function HomeSearchEntry() {
    const [open, setOpen] = useState(false);
    // Paused while the overlay is open — no point animating a label that's
    // covered by the full-screen search overlay, and it avoids running a
    // timer/re-render loop for a button that isn't visible anyway.
    const animatedPlaceholder = useTypingPlaceholder(!open);

    return (
        <div className="px-4 pt-4 md:px-8">
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Search FoodKnock"
                // Desktop size/alignment polish — mirrors the SAME container
                // language HeroCarousel/ReferralPill already use on Home
                // (mx-auto + a max-width inside the shared px-4 md:px-8
                // wrapper below), just a narrower cap than the hero's
                // max-w-7xl so the search entry reads as a compact, centered
                // element rather than a full-bleed bar. Below the 1024px
                // breakpoint max-w-5xl never engages, so mobile/tablet keep
                // their existing full-width-within-padding behavior exactly
                // as before.
                className="mx-auto flex h-12 w-full max-w-5xl items-center gap-2.5 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-3.5 text-left shadow-sm transition-all hover:border-[var(--fk-accent)]/40"
            >
                <Search size={16} strokeWidth={2.5} className="shrink-0 text-fk-text-tertiary" />
                <span aria-hidden="true" className="truncate text-[14px] text-fk-text-tertiary">
                    {animatedPlaceholder}
                </span>
            </button>
            <SearchOverlay open={open} onClose={() => setOpen(false)} />
        </div>
    );
}
