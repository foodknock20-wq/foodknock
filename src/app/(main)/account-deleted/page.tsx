// src/app/(main)/account-deleted/page.tsx
//
// Calm, accessible completion screen shown after an account is deleted.
// Public (NOT under the auth-gated /account group) because the session
// cookie has just been cleared — the user is now logged out. Exposes no
// account data and makes no promise of total erasure beyond what actually
// happened (anonymized financial records may remain — see Privacy Policy).

import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
    title: "Account deleted",
    robots: { index: false, follow: false },
};

export default function AccountDeletedPage() {
    return (
        <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-fk-gold-soft text-fk-gold">
                <CheckCircle2 size={30} strokeWidth={2} />
            </span>
            <h1 className="font-display text-2xl font-black text-fk-text">Your account has been deleted</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-fk-text-secondary">
                You&apos;ve been signed out and your FoodKnock profile has been removed. Some order and payment
                records may be kept in anonymized form where we&apos;re required to for legal and accounting
                reasons — you can read the details any time in our{" "}
                <Link href="/privacy" className="font-semibold text-[var(--fk-accent)] underline">
                    Privacy Policy
                </Link>
                .
            </p>
            <p className="mt-3 text-[13.5px] text-fk-text-tertiary">
                FoodKnock par aapka swagat hamesha rahega — you&apos;re always welcome back.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                <Link
                    href="/"
                    className="rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-6 py-3 text-[14px] font-bold text-white shadow-fk-sm transition-transform hover:scale-[1.01]"
                >
                    Back to home
                </Link>
                <Link
                    href="/auth?mode=register"
                    className="rounded-fk-md border border-fk-border px-6 py-3 text-[14px] font-semibold text-fk-text-secondary transition-colors hover:bg-fk-surface-interactive"
                >
                    Create a new account
                </Link>
            </div>
        </div>
    );
}
