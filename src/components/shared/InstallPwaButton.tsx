"use client";

// src/components/shared/InstallPwaButton.tsx
// FoodKnock — Premium PWA install prompt
// Subtle, exciting, non-spammy · matches dark/warm brand language

import { useEffect, useRef, useState } from "react";
import { Download, X, Zap, RefreshCw, Bell } from "lucide-react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "fk_pwa_dismissed_v1";

export default function InstallPwaButton() {
    const [prompt,     setPrompt]     = useState<BeforeInstallPromptEvent | null>(null);
    const [visible,    setVisible]    = useState(false);
    const [installing, setInstalling] = useState(false);
    const [installed,  setInstalled]  = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (window.matchMedia("(display-mode: standalone)").matches) return;
        if (sessionStorage.getItem(DISMISS_KEY)) return;

        const handler = (e: Event) => {
            e.preventDefault();
            setPrompt(e as BeforeInstallPromptEvent);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setVisible(true), 3000);
        };

        const installedHandler = () => {
            setInstalled(true);
            setVisible(false);
            try {
                window.dispatchEvent(new CustomEvent("pwa-installed"));
            } catch { /* ignore */ }
        };

        window.addEventListener("beforeinstallprompt", handler);
        window.addEventListener("appinstalled", installedHandler);

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", installedHandler);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleInstall = async () => {
        if (!prompt) return;
        setInstalling(true);
        try {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setInstalled(true);
        } catch { /* ignore */ }
        setInstalling(false);
        setVisible(false);
    };

    const dismiss = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setVisible(false);
        try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    };

    if (!visible || installed) return null;

    return (
        <>
            {/* Backdrop blur on mobile */}
            <div
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
                onClick={dismiss}
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
                        border: "1px solid rgba(255,92,26,0.2)",
                        boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
                    }}
                >
                    {/* Ambient top glow */}
                    <div
                        className="pointer-events-none absolute inset-x-0 -top-px h-[1px]"
                        style={{ background: "linear-gradient(90deg, transparent, rgba(255,140,66,0.6) 50%, transparent)" }}
                        aria-hidden="true"
                    />
                    <div
                        className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full opacity-30 blur-2xl"
                        style={{ background: "radial-gradient(circle, #FF5C1A, transparent 70%)" }}
                        aria-hidden="true"
                    />

                    {/* Close */}
                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label="Dismiss install prompt"
                        className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 text-white/30 transition-all hover:bg-white/10 hover:text-white/60"
                    >
                        <X size={14} />
                    </button>

                    <div className="p-5">
                        {/* Header row */}
                        <div className="flex items-center gap-3.5">
                            <div
                                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl"
                                style={{ boxShadow: "0 4px 20px rgba(255,92,26,0.4)" }}
                            >
                                <Image
                                    src="/logo/logo.jpg"
                                    alt="FoodKnock App"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div>
                                <p className="text-[16px] font-black text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                                    Install FoodKnock
                                </p>
                                <p className="text-[11px] text-white/40">Add to home screen · No app store needed</p>
                            </div>
                        </div>

                        {/* Benefit chips */}
                        <div className="mt-4 flex flex-wrap gap-2">
                            {[
                                { icon: Zap, text: "Instant orders" },
                                { icon: Bell, text: "Order tracking" },
                                { icon: RefreshCw, text: "Works online" },
                            ].map(({ icon: Icon, text }) => (
                                <div
                                    key={text}
                                    className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-3 py-1.5"
                                >
                                    <Icon size={10} className="text-orange-400" strokeWidth={2.5} />
                                    <span className="text-[11px] font-semibold text-white/50">{text}</span>
                                </div>
                            ))}
                        </div>

                        {/* CTA */}
                        <button
                            onClick={handleInstall}
                            disabled={installing}
                            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[14px] font-black text-white transition-all active:scale-[0.98] disabled:opacity-70"
                            style={{
                                background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)",
                                boxShadow: "0 8px 24px rgba(255,92,26,0.4)",
                            }}
                        >
                            {installing ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Installing…
                                </>
                            ) : (
                                <>
                                    <Download size={15} strokeWidth={2.5} />
                                    Add to Home Screen
                                </>
                            )}
                        </button>

                        <button
                            onClick={dismiss}
                            className="mt-2.5 w-full py-1.5 text-center text-[11px] font-medium text-white/20 transition-colors hover:text-white/40"
                        >
                            Maybe later
                        </button>
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