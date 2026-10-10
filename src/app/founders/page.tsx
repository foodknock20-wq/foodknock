// src/app/founders/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import CustomerShell from "@/components/shell/CustomerShell";
import Footer from "@/components/shared/Footer";
import FoundersHero from "@/components/founders/FoundersHero";
import FounderCard from "@/components/founders/FounderCard";
import FounderDetailPanel from "@/components/founders/FounderDetailPanel";
import FoodknockStory from "@/components/founders/FoodknockStory";
import { founders } from "@/lib/foundersData";

export default function FoundersPage() {
    const [activeId, setActiveId] = useState<string | null>(null);
    const activeFounder = founders.find((f) => f.id === activeId) ?? null;

    const handleClose = useCallback(() => setActiveId(null), []);

    function handleSelect(id: string) {
        setActiveId(id);
    }

    // Escape key closes modal
    useEffect(() => {
        if (!activeFounder) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") handleClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [activeFounder, handleClose]);

    // Lock body scroll when modal is open. Captures whatever value was
    // already on body.style.overflow BEFORE this effect touches it, and
    // restores exactly that on close/unmount — not a hardcoded "". Without
    // this, closing the founder modal would blindly clear overflow even if
    // some other overlay (e.g. CustomerShell's AccountDialog) had
    // independently locked scroll first, silently re-enabling background
    // scroll underneath that other, still-open overlay.
    useEffect(() => {
        if (!activeFounder) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [activeFounder]);

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#FFFBF5] via-[#FFF9F0] to-[#FFF5E8]">
            {/* DOUBLE-SCROLLBAR FIX — root cause: `overflow-x-hidden` alone
                sets only overflow-x; per the CSS Overflow spec, when one
                axis is non-'visible' and the other is left 'visible', the
                'visible' axis computes to 'auto' instead (a real, documented
                browser behavior, not a bug in this codebase's CSS). That
                silently turned this div into its OWN scroll container. The
                second ambient glow below is `bottom-0 translate-y-1/2` —
                deliberately bled half its height past this div's bottom
                edge for a soft, "faded off the edge" look. Content below a
                box's bottom edge IS reachable scrollable overflow (unlike
                bleed above the top edge, which starts before the scroll
                origin and is simply clipped) — so the promoted
                `overflow-y: auto` had real overflow to act on, and rendered
                a second, nested scrollbar for ~140px of pure decoration,
                completely independent of the document's own normal
                scrollbar. Fixed by using `overflow-hidden` (clips BOTH axes)
                instead of `overflow-x-hidden` alone: neither axis is now
                'visible', so the spec's auto-promotion never triggers, and
                this div can never become its own scroll container again.
                The glows are `pointer-events-none`/`aria-hidden` pure
                decoration fading to transparent at their own edge, so
                clipping the sliver that bled past the box is visually
                inert — this is the correct, permanent fix, not a
                `overflow-hidden`-as-a-bandage hack over unrelated broken
                width/layout (nothing else about this div's sizing changed).
                `position: fixed` descendants (the founder-detail modal,
                rendered as a sibling later in this same returned tree) are
                unaffected — this div has no `transform`/`filter`/`contain`
                property, so it never becomes a containing block for fixed
                elements, which still escape to the viewport exactly as
                before. */}
            <div
                className="pointer-events-none absolute left-[10%] top-0 h-[320px] w-[320px] -translate-y-1/2 rounded-full opacity-[0.07] blur-3xl"
                style={{ background: "radial-gradient(circle, #FF5C1A, transparent 70%)" }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute bottom-0 right-[15%] h-[280px] w-[280px] translate-y-1/2 rounded-full opacity-[0.05] blur-3xl"
                style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }}
                aria-hidden="true"
            />

            <CustomerShell>
            <div className="relative z-10">
                <FoundersHero />
            </div>

            {/* Founder cards grid — 2-column centered layout for two founders */}
            <section className="relative z-10 px-4 pb-14 md:px-8 md:pb-20">
                <div className="mx-auto max-w-7xl">
                    <div className="grid gap-5 sm:grid-cols-2 max-w-3xl mx-auto">
                        {founders.map((founder) => (
                            <FounderCard
                                key={founder.id}
                                founder={founder}
                                isActive={activeId === founder.id}
                                onClick={() => handleSelect(founder.id)}
                            />
                        ))}
                    </div>

                    <p className="mt-6 text-center text-[13px] font-medium text-gray-400">
                        Select a founder to view their full profile
                    </p>
                </div>
            </section>

            <div className="relative z-10">
                <FoodknockStory />
            </div>

            <Footer />
            </CustomerShell>

            {/* Modal overlay */}
            {activeFounder && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40 founder-modal-backdrop"
                        style={{
                            background: "rgba(20, 10, 5, 0.55)",
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                        }}
                        onClick={handleClose}
                        aria-hidden="true"
                    />

                    {/* Modal container */}
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${activeFounder.name} profile`}
                    >
                        <div
                            className="relative w-full max-w-4xl founder-modal-panel"
                            style={{ maxHeight: "calc(100dvh - 2rem)" }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <FounderDetailPanel
                                founder={activeFounder}
                                onClose={handleClose}
                            />
                        </div>
                    </div>

                    <style>{`
                        @keyframes backdropIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes modalIn {
                            from { opacity: 0; transform: translateY(24px) scale(0.96); }
                            to { opacity: 1; transform: translateY(0) scale(1); }
                        }
                        .founder-modal-backdrop { animation: backdropIn 0.3s ease both; }
                        .founder-modal-panel { animation: modalIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) both; }
                        @media (prefers-reduced-motion: reduce) {
                            .founder-modal-backdrop, .founder-modal-panel { animation: none; }
                        }
                    `}</style>
                </>
            )}
        </div>
    );
}
