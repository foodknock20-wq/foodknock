"use client";

// src/components/checkout/DonationCard.tsx
//
// Pre-Phase 17 — Phase 2: Street Animal Support. A fully self-contained
// checkout widget — its own state, its own API calls, its own Razorpay
// instance — completely decoupled from the main checkout form/handleSubmit.
// Placing or not placing the food order never depends on anything here,
// and nothing here ever touches cart/order/coupon/loyalty state.
//
// Success is never assumed from a client callback alone — the Razorpay
// `handler` only kicks off a server-side /api/donations/verify call, and
// only THAT response flips the UI to the appreciation state. No donation
// "success" route/URL is used anywhere, so there is nothing for a crafted
// query string to spoof (see master-prompt §27/§28).

import { useState, useCallback } from "react";
import { PawPrint, Heart, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import { MIN_DONATION_AMOUNT, DONATION_PRESET_AMOUNTS } from "@/lib/constants";

declare global {
    interface Window {
        Razorpay: new (opts: Record<string, unknown>) => {
            open: () => void;
            on: (event: string, cb: (r: unknown) => void) => void;
        };
    }
}

function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window !== "undefined" && window.Razorpay) { resolve(true); return; }
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.body.appendChild(s);
    });
}

type Stage = "idle" | "creating" | "awaiting" | "verifying" | "success" | "failed";

export default function DonationCard() {
    const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
    const [customMode, setCustomMode] = useState(false);
    const [customValue, setCustomValue] = useState("");
    const [stage, setStage] = useState<Stage>("idle");
    const [error, setError] = useState<string | null>(null);
    const [successAmount, setSuccessAmount] = useState<number | null>(null);

    const customAmount = customValue.trim() === "" ? null : Number(customValue);
    const customValid = customAmount !== null && Number.isInteger(customAmount) && customAmount >= MIN_DONATION_AMOUNT;
    const customError = customMode && customValue.trim() !== "" && !customValid
        ? `Minimum contribution is ₹${MIN_DONATION_AMOUNT}.`
        : null;

    const selectedAmount = customMode ? (customValid ? customAmount : null) : selectedPreset;

    const handlePickPreset = (amount: number) => {
        setError(null);
        setCustomMode(false);
        setCustomValue("");
        setSelectedPreset((prev) => (prev === amount ? null : amount));
    };

    const handlePickCustom = () => {
        setError(null);
        setSelectedPreset(null);
        setCustomMode((prev) => !prev);
    };

    const handleSkip = () => {
        setSelectedPreset(null);
        setCustomMode(false);
        setCustomValue("");
        setError(null);
    };

    const handleSupport = useCallback(async () => {
        if (!selectedAmount) return;
        setError(null);
        setStage("creating");

        try {
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                setError("Payment gateway unavailable. Please try again.");
                setStage("failed");
                return;
            }

            const cr = await fetch("/api/donations/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: selectedAmount }),
            });
            const cd = await cr.json();
            if (!cr.ok || !cd.success) {
                setError(cd.message || "Could not start your contribution.");
                setStage("failed");
                return;
            }

            setStage("awaiting");

            const rzp = new window.Razorpay({
                key: cd.keyId,
                amount: cd.amount * 100,
                currency: "INR",
                name: "FoodKnock",
                description: "Street Animal Support",
                image: "/logo.png",
                order_id: cd.razorpayOrderId,
                theme: { color: "#ff5c1a" },
                handler: async (response: unknown) => {
                    setStage("verifying");
                    const rp = response as {
                        razorpay_order_id: string;
                        razorpay_payment_id: string;
                        razorpay_signature: string;
                    };

                    try {
                        const vr = await fetch("/api/donations/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpayOrderId: rp.razorpay_order_id,
                                razorpayPaymentId: rp.razorpay_payment_id,
                                razorpaySignature: rp.razorpay_signature,
                            }),
                        });
                        const vd = await vr.json();
                        if (!vr.ok || !vd.success) {
                            setError(vd.message || "We couldn't confirm your contribution.");
                            setStage("failed");
                            return;
                        }
                        setSuccessAmount(vd.amount);
                        setStage("success");
                    } catch {
                        setError("Network error while confirming your contribution.");
                        setStage("failed");
                    }
                },
                modal: {
                    ondismiss: () => {
                        toast("Contribution cancelled — no charge was made.", { icon: "🐾" });
                        setStage("idle");
                    },
                },
            });

            rzp.on("payment.failed", () => {
                setError("Payment wasn't completed.");
                setStage("failed");
            });

            rzp.open();
        } catch {
            setError("Something went wrong. Please try again.");
            setStage("failed");
        }
    }, [selectedAmount]);

    // ── Success — compact appreciation state, replaces the form entirely ──
    if (stage === "success") {
        return (
            <div className="overflow-hidden rounded-fk-lg border border-fk-gold/30 bg-fk-gold-soft shadow-sm">
                <div className="flex items-center gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] shadow-fk-sm">
                        <Heart size={20} className="fill-white text-white" strokeWidth={2} />
                    </div>
                    <div>
                        <p className="text-[13.5px] font-black text-fk-text">Thank You for Your Kindness 🐾</p>
                        <p className="mt-0.5 text-[12px] text-fk-text-secondary">
                            Your ₹{successAmount} contribution has been received. Every small act of kindness matters.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const busy = stage === "creating" || stage === "awaiting" || stage === "verifying";

    return (
        <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
            <div className="border-b border-fk-border bg-fk-gold-soft px-5 py-4">
                <div className="flex items-center gap-3">
                    <PawPrint size={18} className="text-fk-gold" strokeWidth={2} />
                    <div>
                        <p className="text-[13px] font-black tracking-tight text-fk-text">Support Street Animals</p>
                        <p className="text-[11px] text-fk-text-secondary">Small contribution, real kindness.</p>
                    </div>
                </div>
            </div>

            <div className="space-y-3.5 p-5">
                <p className="text-[12px] text-fk-text-secondary">Want to add a little kindness to your order?</p>

                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Preset contribution amounts">
                    {DONATION_PRESET_AMOUNTS.map((amount) => {
                        const active = !customMode && selectedPreset === amount;
                        return (
                            <button
                                key={amount}
                                type="button"
                                aria-pressed={active}
                                disabled={busy}
                                onClick={() => handlePickPreset(amount)}
                                className={`rounded-fk-md border-2 py-2.5 text-[13px] font-black transition-all disabled:cursor-not-allowed disabled:opacity-60 ${active
                                    ? "border-[var(--fk-accent)] bg-fk-surface-selected text-[var(--fk-accent)]"
                                    : "border-fk-border bg-fk-surface-interactive text-fk-text-secondary hover:border-[var(--fk-accent)]/40"
                                    }`}
                            >
                                ₹{amount}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    aria-pressed={customMode}
                    disabled={busy}
                    onClick={handlePickCustom}
                    className={`w-full rounded-fk-md border-2 py-2.5 text-[12.5px] font-black transition-all disabled:cursor-not-allowed disabled:opacity-60 ${customMode
                        ? "border-[var(--fk-accent)] bg-fk-surface-selected text-[var(--fk-accent)]"
                        : "border-fk-border bg-fk-surface-interactive text-fk-text-secondary hover:border-[var(--fk-accent)]/40"
                        }`}
                >
                    Custom Amount
                </button>

                {customMode && (
                    <div>
                        <label htmlFor="donation-custom-amount" className="sr-only">Custom contribution amount in rupees</label>
                        <div className="relative flex items-center">
                            <span className="pointer-events-none absolute left-3.5 text-sm font-black text-fk-text-tertiary">₹</span>
                            <input
                                id="donation-custom-amount"
                                type="number"
                                inputMode="numeric"
                                min={MIN_DONATION_AMOUNT}
                                step={1}
                                value={customValue}
                                disabled={busy}
                                onChange={(e) => setCustomValue(e.target.value)}
                                placeholder={`${MIN_DONATION_AMOUNT} or more`}
                                className="w-full rounded-fk-md border border-fk-border bg-fk-surface-interactive py-3 pl-7 pr-4 text-sm font-bold text-fk-text placeholder:text-fk-text-tertiary focus:border-[var(--fk-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--fk-accent)]/15"
                            />
                        </div>
                        {customError && (
                            <p role="alert" className="mt-1.5 text-[11px] font-semibold text-fk-danger">{customError}</p>
                        )}
                    </div>
                )}

                {error && stage === "failed" && (
                    <div className="flex items-start gap-2 rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-3 py-2.5">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-fk-danger" strokeWidth={2.5} />
                        <p className="text-[11.5px] font-bold text-fk-danger">{error}</p>
                    </div>
                )}

                {selectedAmount && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={handleSupport}
                        className="flex w-full items-center justify-center gap-2 rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] py-3 text-[13px] font-black text-white shadow-fk-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {stage === "creating" ? (
                            <><Loader2 size={14} className="animate-spin" /> Preparing secure payment…</>
                        ) : stage === "verifying" ? (
                            <><Loader2 size={14} className="animate-spin" /> Confirming your contribution…</>
                        ) : stage === "failed" ? (
                            <>Try Again · ₹{selectedAmount}</>
                        ) : (
                            <><CheckCircle2 size={14} /> Support with ₹{selectedAmount}</>
                        )}
                    </button>
                )}

                <div className="flex items-center justify-between">
                    <p className="text-[10.5px] text-fk-text-tertiary">Optional · separate from your food order payment</p>
                    {(selectedPreset !== null || customMode) && !busy && (
                        <button type="button" onClick={handleSkip} className="text-[10.5px] font-bold text-fk-text-tertiary underline hover:text-fk-text-secondary">
                            No, thanks
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
