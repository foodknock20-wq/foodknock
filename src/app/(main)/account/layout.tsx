// src/app/(main)/account/layout.tsx
//
// Phase 9 — Customer Account 2.0. Server-component auth gate for every
// /account/* page — same proven pattern as src/app/admin/layout.tsx and
// src/app/notifications/settings/page.tsx (cookie → verifyToken → DB-backed
// isActive check → redirect). This is also the hard server-side
// enforcement that guests ("browse only") cannot reach any account page —
// unlike my-orders/checkout's client-side useEffect redirect, this cannot
// be bypassed by disabling JS or racing the redirect.
//
// Fetches the user doc exactly once per navigation and hands it to every
// nested page via AccountProvider, so account/profile, account/addresses,
// etc. never need their own "who am I" fetch.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import Footer from "@/components/shared/Footer";
import { AccountProvider, type AccountUser } from "@/components/account/AccountContext";
import AccountShell from "@/components/account/AccountShell";

// SEO/indexing-boundary fix: /account/* is already hard server-side
// auth-gated above (a crawler with no session cookie is redirected to
// /auth before any content renders, unlike checkout's client-side-only
// redirect) — so there was never actually indexable content for Google to
// see here. This explicit noindex is defense-in-depth for consistency
// with cart/checkout/my-orders/track-order, not a fix for an actual leak.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

async function getAccountUser(): Promise<AccountUser> {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
        redirect("/auth?mode=login&redirect=/account");
    }

    let decoded: { userId?: string };
    try {
        decoded = verifyToken(token) as { userId?: string };
    } catch {
        redirect("/auth?mode=login&redirect=/account");
    }
    if (!decoded?.userId) {
        redirect("/auth?mode=login&redirect=/account");
    }

    await connectDB();
    const user = await User.findById(decoded.userId)
        .select("name email phone dob isActive loyaltyPoints createdAt")
        .lean<{
            _id: unknown;
            name: string;
            email: string;
            phone?: string;
            dob?: Date;
            isActive?: boolean;
            loyaltyPoints?: number;
            createdAt?: Date;
        } | null>();

    if (!user) {
        redirect("/auth?mode=login&redirect=/account");
    }
    if (user.isActive === false) {
        redirect("/auth?mode=login&error=blocked");
    }

    return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone ?? "",
        dob: user.dob ? new Date(user.dob).toISOString() : null,
        loyaltyPoints: user.loyaltyPoints ?? 0,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
    };
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
    const user = await getAccountUser();

    return (
        <>
            <AccountProvider user={user}>
                <AccountShell>{children}</AccountShell>
            </AccountProvider>
            <Footer />
        </>
    );
}
