// src/app/(main)/delete-account/page.tsx
//
// PUBLIC account-deletion resource (no login required) — the stable page
// linked from the Google Play Console "Account deletion" data-safety
// requirement. It explains how a FoodKnock customer requests deletion, what
// is removed vs. retained, and how ownership is verified.
//
// SECURITY / DESIGN NOTE
//   FoodKnock has exactly one authentication method: email + password
//   (email is verified by OTP at signup). The only secure, non-enumerating
//   way to prove ownership is therefore for the customer to SIGN IN and run
//   the in-app, re-authenticated deletion flow. This page deliberately does
//   NOT expose an unauthenticated "type your email to delete" endpoint —
//   that would allow account enumeration and deletion-by-guessing. Customers
//   who cannot access their account are directed to verified support
//   channels, which confirm identity before acting. All contact details
//   below are the real, configured FoodKnock support channels (shared with
//   /contact) — nothing is invented.

import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, LogIn, Mail, MessageCircle, Trash2, Archive } from "lucide-react";

const CONTACT_EMAIL = "foodknock20@gmail.com";
const WHATSAPP_NUMBER = "918764821399";

export const metadata: Metadata = {
    title: "Delete your FoodKnock account",
    description:
        "How to request deletion of your FoodKnock account and data, what is removed, and what may be retained.",
    alternates: { canonical: "https://www.foodknock.com/delete-account" },
    robots: { index: true, follow: true },
};

const REMOVED = [
    "Your profile (name, date of birth, contact details)",
    "Saved delivery addresses",
    "Notification preferences and push-notification subscriptions",
    "Game/spin records and personalised marketing state",
];

const RETAINED = [
    "Past orders, invoices and payment records — kept in anonymized form (your name, phone and address are scrubbed) where required for legal, accounting and fraud-prevention reasons",
    "A minimal, pseudonymous record used only to prevent repeat first-order promotions being claimed by deleting and recreating an account",
];

export default function PublicDeleteAccountPage() {
    return (
        <div className="min-h-screen bg-fk-bg">
            <div className="mx-auto max-w-2xl px-4 py-10">
                <div className="mb-2 inline-flex items-center gap-2 rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3 py-1">
                    <ShieldCheck size={11} className="text-[var(--fk-accent)]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--fk-accent)]">
                        FoodKnock
                    </span>
                </div>
                <h1 className="font-display text-3xl font-black text-fk-text">Delete your account</h1>
                <p className="mt-2 text-[14px] leading-relaxed text-fk-text-secondary">
                    You can permanently delete your FoodKnock account and associated data at any time. Here&apos;s
                    how, and exactly what happens to your information.
                </p>

                {/* Primary path: in-app, re-authenticated deletion */}
                <section className="mt-7 rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-fk-surface-selected text-[var(--fk-accent)]">
                            <LogIn size={20} strokeWidth={2} />
                        </span>
                        <h2 className="font-display text-xl font-black text-fk-text">Delete it yourself (recommended)</h2>
                    </div>
                    <ol className="mt-4 space-y-2.5 text-[13.5px] leading-relaxed text-fk-text">
                        <li className="flex gap-2.5">
                            <span className="font-black text-[var(--fk-accent)]">1.</span>
                            Sign in to your FoodKnock account.
                        </li>
                        <li className="flex gap-2.5">
                            <span className="font-black text-[var(--fk-accent)]">2.</span>
                            Go to <span className="font-semibold">Account → Delete Account</span>.
                        </li>
                        <li className="flex gap-2.5">
                            <span className="font-black text-[var(--fk-accent)]">3.</span>
                            Re-enter your password and confirm on the final step. Your account is then deleted and
                            you&apos;re signed out.
                        </li>
                    </ol>
                    <Link
                        href="/account/delete"
                        className="mt-5 inline-flex rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-5 py-3 text-[14px] font-bold text-white shadow-fk-sm transition-transform hover:scale-[1.01]"
                    >
                        Go to account deletion
                    </Link>
                    <p className="mt-2 text-[12px] text-fk-text-tertiary">
                        You&apos;ll be asked to sign in first if you aren&apos;t already.
                    </p>
                </section>

                {/* Fallback: can't access the account */}
                <section className="mt-5 rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-6 shadow-sm">
                    <h2 className="font-display text-lg font-black text-fk-text">Can&apos;t sign in?</h2>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-fk-text-secondary">
                        If you&apos;ve lost access, first try <span className="font-semibold">Forgot password</span> on
                        the sign-in screen. If you still can&apos;t get in, contact us from the email address on your
                        account so we can verify it&apos;s you before deleting anything. We never delete an account on
                        an unverified request.
                    </p>
                    <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                        <a
                            href={`mailto:${CONTACT_EMAIL}?subject=Account%20deletion%20request%20—%20FoodKnock`}
                            className="inline-flex items-center justify-center gap-2 rounded-fk-md border border-fk-border px-5 py-3 text-[13.5px] font-semibold text-fk-text transition-colors hover:bg-fk-surface-interactive"
                        >
                            <Mail size={15} /> {CONTACT_EMAIL}
                        </a>
                        <a
                            href={`https://wa.me/${WHATSAPP_NUMBER}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-fk-md border border-fk-border px-5 py-3 text-[13.5px] font-semibold text-fk-text transition-colors hover:bg-fk-surface-interactive"
                        >
                            <MessageCircle size={15} /> WhatsApp support
                        </a>
                    </div>
                </section>

                {/* What's removed / retained */}
                <section className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-5 shadow-sm">
                        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                            <Trash2 size={13} className="text-fk-danger" /> Deleted
                        </p>
                        <ul className="mt-3 space-y-2">
                            {REMOVED.map((r) => (
                                <li key={r} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-fk-text">
                                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fk-danger" />
                                    {r}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-5 shadow-sm">
                        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                            <Archive size={13} className="text-[var(--fk-accent)]" /> Retained (anonymized where applicable)
                        </p>
                        <ul className="mt-3 space-y-2">
                            {RETAINED.map((r) => (
                                <li key={r} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-fk-text">
                                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--fk-accent)]" />
                                    {r}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <p className="mt-6 text-[12.5px] text-fk-text-tertiary">
                    Deleting your account does not automatically cancel an active order or issue a refund. For full
                    details on how we handle your data, see our{" "}
                    <Link href="/privacy" className="font-semibold text-[var(--fk-accent)] underline">
                        Privacy Policy
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
