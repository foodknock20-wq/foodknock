"use client";

// src/components/home/ReferralPill.tsx
//
// Pre-Phase 17 — Home/Search polish: compact "Refer a Friend" utility
// strip, directly below the promo scroller. Reuses the existing
// BottomSheet primitive (no new modal system), the real referral code
// from GET /api/referral/me, and the real /auth?ref=CODE URL structure
// RegisterForm.tsx already consumes — no invented reward, no invented
// route. Renders nothing while logged out rather than exposing/fabricating
// a code; signed-out visitors get a compact sign-in prompt instead.

import { useState } from "react";
import { Gift, Share2, Copy, Check, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/BottomSheet";
import { useAuthStore } from "@/store/authStore";
import { toastSuccess, toastError } from "@/lib/toast";

type ReferralData = { referralCode: string; referrerReward: number; refereeReward: number };

export default function ReferralPill() {
    const router = useRouter();
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<ReferralData | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleOpen = async () => {
        if (isLoggedIn === false) {
            router.push("/auth?mode=login");
            return;
        }
        setOpen(true);
        if (data) return;
        setLoading(true);
        try {
            const res = await fetch("/api/referral/me", { credentials: "include" });
            const json = await res.json();
            if (res.ok && json.success) {
                setData({ referralCode: json.referralCode, referrerReward: json.referrerReward, refereeReward: json.refereeReward });
            }
        } catch {
            // Sheet degrades gracefully — see the "couldn't load" branch below.
        } finally {
            setLoading(false);
        }
    };

    const shareUrl = data ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${data.referralCode}` : "";
    const shareMessage = data
        ? `Order real food from FoodKnock! Use my code ${data.referralCode} when you sign up — you get ${data.refereeReward} bonus points, I get ${data.referrerReward}. ${shareUrl}`
        : "";

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toastSuccess("Link copied!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toastError("Couldn't copy the link.");
        }
    };

    const handleCopyCode = async () => {
        if (!data) return;
        try {
            await navigator.clipboard.writeText(data.referralCode);
            toastSuccess("Code copied!");
        } catch {
            toastError("Couldn't copy the code.");
        }
    };

    const handleNativeShare = async () => {
        if (!data) return;
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            try {
                await navigator.share({ title: "FoodKnock", text: shareMessage, url: shareUrl });
            } catch {
                // User cancelled — no error toast needed.
            }
        } else {
            handleCopyLink();
        }
    };

    return (
        <>
            {/* Premium CTA polish — this button no longer owns its own
                px-4/mx-auto/max-w-7xl wrapper; it sits as a flex child of the
                shared action row in page.tsx (alongside SpinWinCTA), which
                owns that positioning. Visuals refined to a card-style
                rounded-fk-lg treatment (not a full pill) with a solid warm
                icon badge and a trailing open-arrow — everything else here
                (handleOpen, share/copy, BottomSheet) is unchanged. */}
            <button
                onClick={handleOpen}
                aria-label="Refer a friend and earn FoodKnock reward points"
                className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-fk-lg border border-fk-border bg-fk-gold-soft px-3.5 py-3 text-left shadow-fk-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-fk-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fk-accent)]/40 sm:px-4 md:flex-initial"
            >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-fk-md bg-amber-100 text-amber-700">
                    <Gift size={15} strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-bold leading-tight text-fk-text sm:text-[13px]">
                    <span className="sm:hidden">Refer &amp; Earn</span>
                    <span className="hidden sm:inline">Refer a friend, earn reward points</span>
                </span>
                <ArrowUpRight
                    size={15}
                    strokeWidth={2.25}
                    className="hidden shrink-0 text-[var(--fk-accent)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:inline-block"
                />
            </button>

            <BottomSheet open={open} onClose={() => setOpen(false)} title="Refer a Friend" ariaLabel="Refer a friend">
                {loading ? (
                    <div className="space-y-3">
                        <div className="h-16 animate-pulse rounded-fk-md bg-fk-surface-interactive" />
                        <div className="h-11 animate-pulse rounded-fk-md bg-fk-surface-interactive" />
                    </div>
                ) : data ? (
                    <div className="space-y-4">
                        <p className="text-[13px] leading-relaxed text-fk-text-secondary">
                            Share your code — your friend gets <strong className="text-fk-text">{data.refereeReward} bonus points</strong> on
                            signup, and you get <strong className="text-fk-text">{data.referrerReward} points</strong> once their first order is delivered.
                        </p>

                        <div className="flex items-center justify-between gap-3 rounded-fk-md border border-fk-border bg-fk-surface-selected px-4 py-3">
                            <span className="font-mono text-lg font-black tracking-widest text-fk-text">{data.referralCode}</span>
                            <button
                                onClick={handleCopyCode}
                                aria-label="Copy referral code"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-surface-elevated text-fk-text-secondary transition-colors hover:text-[var(--fk-accent)]"
                            >
                                <Copy size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            <button
                                onClick={handleNativeShare}
                                className="flex items-center justify-center gap-2 rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] py-3 text-[13px] font-black text-white"
                            >
                                <Share2 size={14} /> Share
                            </button>
                            <button
                                onClick={handleCopyLink}
                                className="flex items-center justify-center gap-2 rounded-fk-md border border-fk-border bg-fk-surface-elevated py-3 text-[13px] font-black text-fk-text transition-colors hover:bg-fk-surface-interactive"
                            >
                                {copied ? <Check size={14} className="text-fk-success" /> : <Copy size={14} />} Copy Link
                            </button>
                        </div>

                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-2 rounded-fk-md border border-fk-border bg-fk-surface-elevated py-3 text-[13px] font-black text-fk-text transition-colors hover:bg-fk-surface-interactive"
                        >
                            Share via WhatsApp
                        </a>
                    </div>
                ) : (
                    <p className="py-6 text-center text-[13px] text-fk-text-secondary">
                        Couldn&apos;t load your referral code right now — please try again in a moment.
                    </p>
                )}
            </BottomSheet>
        </>
    );
}
