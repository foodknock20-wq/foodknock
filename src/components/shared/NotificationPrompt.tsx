"use client";

// src/components/shared/NotificationPrompt.tsx
// FoodKnock — Premium notification opt-in prompt
// Dark warm card · persuasive copy · non-annoying UX
// Fixed: early return during SSR/hydration to prevent Suspense crash.

import { useEffect, useState } from "react";
import { Bell, BellOff, X, Tag, Clock, ShoppingBag } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISMISS_KEY   = "fk_notif_dismissed_v1";
const SHOW_DELAY_MS = 4500;
const ENGAGE_SCROLL = 500;

export default function NotificationPrompt() {
    const { state, subscribing, subscribe } = usePushNotifications();
    const [mounted,   setMounted]   = useState(false);
    const [visible,   setVisible]   = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [success,   setSuccess]   = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!mounted) return;
        if (state !== "prompt") return;
        try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch { return; }

        let timer: ReturnType<typeof setTimeout>;

        const show = () => {
            if (!visible) {
                timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
            }
        };

        // Also show after PWA install
        const onPwaInstalled = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => setVisible(true), 2000);
        };

        const onScroll = () => {
            if (window.scrollY > ENGAGE_SCROLL) {
                window.removeEventListener("scroll", onScroll);
                show();
            }
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("pwa-installed", onPwaInstalled);

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("pwa-installed", onPwaInstalled);
            if (timer) clearTimeout(timer);
        };
    }, [mounted, state, visible]);

    const handleDismiss = () => {
        setVisible(false);
        setDismissed(true);
        try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    };

    const handleAllow = async () => {
        const ok = await subscribe();
        if (ok) {
            setSuccess(true);
            setTimeout(() => { setVisible(false); }, 2800);
        } else {
            handleDismiss();
        }
    };

    if (!mounted)    return null;
    if (dismissed)   return null;
    if (!visible)    return null;
    if (state === "unsupported" || state === "denied" ||
        state === "granted"     || state === "loading") return null;

    const benefits = [
        { icon: ShoppingBag, text: "Live order status updates", sub: "Know exactly when your food is ready" },
        { icon: Tag,         text: "Exclusive deals & combos",   sub: "First to hear about limited offers" },
        { icon: Clock,       text: "Max 2 pings per day",        sub: "We respect your attention — no spam" },
    ];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[3px] md:hidden"
                onClick={handleDismiss}
                aria-hidden="true"
            />

            <div
                className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 md:bottom-5 md:left-auto md:right-5 md:max-w-[340px]"
                style={{ animation: "fkSlideUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
            >
                <div
                    className="relative overflow-hidden rounded-3xl"
                    style={{
                        background: "linear-gradient(160deg, #161210 0%, #1c1410 100%)",
                        border: "1px solid rgba(255,92,26,0.18)",
                        boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
                    }}
                >
                    {/* Top accent line */}
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
                        style={{ background: "linear-gradient(90deg, transparent, rgba(255,140,66,0.5) 50%, transparent)" }}
                        aria-hidden="true"
                    />
                    {/* Warm glow */}
                    <div
                        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-3xl"
                        style={{ background: "radial-gradient(circle, #FF5C1A, transparent 70%)" }}
                        aria-hidden="true"
                    />

                    {/* Close */}
                    <button
                        onClick={handleDismiss}
                        aria-label="Dismiss"
                        className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 text-white/30 transition-all hover:bg-white/10 hover:text-white/60"
                    >
                        <X size={14} />
                    </button>

                    <div className="p-5">
                        {success ? (
                            /* ── Success state ── */
                            <div className="flex flex-col items-center py-4 text-center">
                                <div
                                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                                    style={{
                                        background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
                                        boxShadow: "0 8px 24px rgba(16,185,129,0.4)",
                                    }}
                                >
                                    <Bell size={26} className="text-white" />
                                </div>
                                <p
                                    className="text-[18px] font-black text-white"
                                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                                >
                                    You&apos;re all set! 🎉
                                </p>
                                <p className="mt-1.5 text-[12px] text-white/40">
                                    We&apos;ll notify you about your orders and the best deals.
                                </p>
                            </div>
                        ) : (
                            /* ── Default state ── */
                            <>
                                {/* Header */}
                                <div className="flex items-center gap-3.5">
                                    <div
                                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                                        style={{
                                            background: "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)",
                                            boxShadow: "0 6px 20px rgba(255,92,26,0.4)",
                                        }}
                                    >
                                        <Bell size={22} className="text-white" strokeWidth={2} />
                                    </div>
                                    <div>
                                        <p
                                            className="text-[16px] font-black leading-tight text-white"
                                            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                                        >
                                            Stay in the loop
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-white/40">
                                            Order updates · Deals · No spam
                                        </p>
                                    </div>
                                </div>

                                {/* Benefits */}
                                <div className="mt-5 space-y-3">
                                    {benefits.map(({ icon: Icon, text, sub }, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/6 border border-white/8">
                                                <Icon size={13} className="text-orange-400" strokeWidth={2} />
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-semibold text-white/70">{text}</p>
                                                <p className="text-[11px] text-white/25">{sub}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={handleAllow}
                                    disabled={subscribing}
                                    className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[14px] font-black text-white transition-all active:scale-[0.98] disabled:opacity-70"
                                    style={{
                                        background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)",
                                        boxShadow: "0 8px 24px rgba(255,92,26,0.35)",
                                    }}
                                >
                                    {subscribing ? (
                                        <>
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            Setting up…
                                        </>
                                    ) : (
                                        <>
                                            <Bell size={15} strokeWidth={2.5} />
                                            Enable Notifications
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleDismiss}
                                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-white/20 transition-colors hover:text-white/40"
                                >
                                    <BellOff size={10} />
                                    Not right now
                                </button>

                                <p className="mt-3 text-center text-[10px] text-white/15">
                                    You can turn notifications off anytime in your browser settings.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fkSlideUp {
                    from { transform: translateY(110%); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>
        </>
    );
}