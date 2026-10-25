"use client";

// src/components/account/DeleteAccountFlow.tsx
//
// Premium, warm, multi-step account-deletion experience — never a one-click
// action, never window.confirm(). Three distinct steps:
//
//   1. "Before you go…"  — warm retention moment + ACCURATE consequences.
//   2. Re-authenticate    — current password (the app's only auth method).
//   3. Final confirmation — separate screen, explicit acknowledge + action.
//
// The server enforces every step independently (session + fresh password
// re-auth + short-lived session-bound intent token + acknowledge:true).
// This component is the respectful UI on top — no dark patterns, no shame
// copy, "Keep my account" is always a calm, equal exit. Light theme only,
// FoodKnock white/orange/charcoal, reduced-motion friendly (transitions are
// subtle and non-essential).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, ShieldCheck, Loader2, ArrowLeft, Trash2, Lock } from "lucide-react";

type Step = "intro" | "reauth" | "confirm";

const CONSEQUENCES = [
    "Your FoodKnock profile, saved addresses and notification settings are removed.",
    "Past orders, invoices and payment records may be kept in anonymized form where we need them for legal, accounting and fraud-prevention reasons.",
    "Deleting your account does not cancel an active order or trigger a refund — contact us first if you have one in progress.",
    "After the final step this cannot be undone. You can always sign up again later.",
];

export default function DeleteAccountFlow() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("intro");
    const [password, setPassword] = useState("");
    const [acknowledge, setAcknowledge] = useState(false);
    const [deletionToken, setDeletionToken] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleReauth(e: React.FormEvent) {
        e.preventDefault();
        if (busy) return;
        setError(null);
        setBusy(true);
        try {
            const res = await fetch("/api/account/delete/initiate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.deletionToken) {
                setError(data?.message || "Could not verify your password.");
                return;
            }
            setDeletionToken(data.deletionToken);
            setPassword("");
            setError(null);
            setStep("confirm");
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    function clearLocalCaches() {
        try {
            localStorage.removeItem("foodknock-cart-v1");
            localStorage.removeItem("foodknock-location-v1");
        } catch {
            /* ignore storage access errors */
        }
    }

    async function handleConfirm() {
        if (busy || !acknowledge || !deletionToken) return;
        setError(null);
        setBusy(true);
        try {
            const res = await fetch("/api/account/delete/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ deletionToken, acknowledge: true }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                // Expired/invalid intent → send them back to re-authenticate.
                if (res.status === 401) {
                    setDeletionToken(null);
                    setError(data?.message || "Your confirmation expired. Please re-enter your password.");
                    setStep("reauth");
                    return;
                }
                setError(data?.message || "We couldn't complete the deletion. Please try again.");
                return;
            }
            clearLocalCaches();
            router.replace("/account-deleted");
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-5">
            {/* Step indicator */}
            <div className="flex items-center gap-2" aria-hidden="true">
                {(["intro", "reauth", "confirm"] as Step[]).map((s, i) => {
                    const order = { intro: 0, reauth: 1, confirm: 2 } as const;
                    const done = order[step] >= i;
                    return (
                        <span
                            key={s}
                            className={[
                                "h-1.5 flex-1 rounded-full transition-colors",
                                done ? "bg-[var(--fk-accent)]" : "bg-fk-border",
                            ].join(" ")}
                        />
                    );
                })}
            </div>

            {error && (
                <div
                    role="alert"
                    aria-live="assertive"
                    className="flex items-start gap-2 rounded-fk-md border border-fk-danger/30 bg-fk-danger/5 px-4 py-3 text-[13px] font-medium text-fk-danger"
                >
                    {error}
                </div>
            )}

            {/* ── Step 1: Before you go ── */}
            {step === "intro" && (
                <section className="space-y-5 rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-fk-gold-soft text-fk-gold">
                            <Heart size={20} strokeWidth={2} />
                        </span>
                        <div>
                            <h2 className="font-display text-xl font-black text-fk-text">Before you go…</h2>
                            <p className="text-[13px] text-fk-text-secondary">
                                FoodKnock par aapka swagat hamesha rahega — you&apos;re welcome back any time.
                            </p>
                        </div>
                    </div>

                    <p className="text-[13.5px] leading-relaxed text-fk-text-secondary">
                        If you&apos;d still like to delete your account, here&apos;s exactly what happens so you can
                        decide with full information:
                    </p>

                    <ul className="space-y-2.5">
                        {CONSEQUENCES.map((c) => (
                            <li key={c} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-fk-text">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fk-accent)]" />
                                {c}
                            </li>
                        ))}
                    </ul>

                    <p className="text-[12.5px] text-fk-text-tertiary">
                        Read how we handle your data in our{" "}
                        <Link href="/privacy" className="font-semibold text-[var(--fk-accent)] underline">
                            Privacy Policy
                        </Link>
                        .
                    </p>

                    <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
                        <button
                            onClick={() => {
                                setError(null);
                                setStep("reauth");
                            }}
                            className="rounded-fk-md border border-fk-danger/40 px-5 py-3 text-[14px] font-bold text-fk-danger transition-colors hover:bg-fk-danger/5"
                        >
                            Continue to delete
                        </button>
                        <Link
                            href="/account"
                            className="rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-5 py-3 text-center text-[14px] font-bold text-white shadow-fk-sm transition-transform hover:scale-[1.01]"
                        >
                            Keep my account
                        </Link>
                    </div>
                </section>
            )}

            {/* ── Step 2: Re-authenticate ── */}
            {step === "reauth" && (
                <section className="space-y-5 rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-fk-surface-selected text-[var(--fk-accent)]">
                            <Lock size={20} strokeWidth={2} />
                        </span>
                        <div>
                            <h2 className="font-display text-xl font-black text-fk-text">Confirm it&apos;s you</h2>
                            <p className="text-[13px] text-fk-text-secondary">
                                For your security, enter your current password to continue.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleReauth} className="space-y-4">
                        <div>
                            <label htmlFor="delete-password" className="mb-1.5 block text-[13px] font-semibold text-fk-text">
                                Current password
                            </label>
                            <input
                                id="delete-password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full rounded-fk-md border border-fk-border bg-fk-bg px-4 py-3 text-[14px] text-fk-text outline-none transition-colors focus:border-[var(--fk-accent)]"
                                placeholder="Enter your password"
                            />
                        </div>

                        <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
                            <button
                                type="submit"
                                disabled={busy || !password}
                                className="flex items-center justify-center gap-2 rounded-fk-md border border-fk-danger/40 px-5 py-3 text-[14px] font-bold text-fk-danger transition-colors hover:bg-fk-danger/5 disabled:opacity-50"
                            >
                                {busy && <Loader2 size={16} className="animate-spin" />}
                                Continue
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setError(null);
                                    setPassword("");
                                    setStep("intro");
                                }}
                                className="flex items-center justify-center gap-1.5 rounded-fk-md border border-fk-border px-5 py-3 text-[14px] font-semibold text-fk-text-secondary transition-colors hover:bg-fk-surface-interactive"
                            >
                                <ArrowLeft size={15} /> Back
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* ── Step 3: Final confirmation ── */}
            {step === "confirm" && (
                <section className="space-y-5 rounded-fk-lg border border-fk-danger/30 bg-fk-surface-elevated p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-fk-danger/10 text-fk-danger">
                            <Trash2 size={20} strokeWidth={2} />
                        </span>
                        <div>
                            <h2 className="font-display text-xl font-black text-fk-text">Permanently delete account</h2>
                            <p className="text-[13px] text-fk-text-secondary">This is the final step and cannot be undone.</p>
                        </div>
                    </div>

                    <div className="rounded-fk-md border border-fk-border bg-fk-bg p-4">
                        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                            <ShieldCheck size={13} className="text-[var(--fk-accent)]" /> What we&apos;ll do
                        </p>
                        <ul className="mt-2.5 space-y-2">
                            {CONSEQUENCES.map((c) => (
                                <li key={c} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-fk-text-secondary">
                                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fk-text-tertiary" />
                                    {c}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-fk-md border border-fk-border p-3.5">
                        <input
                            type="checkbox"
                            checked={acknowledge}
                            onChange={(e) => setAcknowledge(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--fk-danger)]"
                        />
                        <span className="text-[13px] leading-relaxed text-fk-text">
                            I understand this permanently deletes my FoodKnock account and that it can&apos;t be undone.
                        </span>
                    </label>

                    <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
                        <button
                            onClick={handleConfirm}
                            disabled={busy || !acknowledge}
                            className="flex items-center justify-center gap-2 rounded-fk-md bg-fk-danger px-5 py-3 text-[14px] font-bold text-white shadow-fk-sm transition-colors hover:bg-fk-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {busy && <Loader2 size={16} className="animate-spin" />}
                            Permanently delete my account
                        </button>
                        <Link
                            href="/account"
                            className="rounded-fk-md border border-fk-border px-5 py-3 text-center text-[14px] font-semibold text-fk-text-secondary transition-colors hover:bg-fk-surface-interactive"
                        >
                            Keep my account
                        </Link>
                    </div>
                </section>
            )}
        </div>
    );
}
