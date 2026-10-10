"use client";

// src/components/account/AccountContext.tsx
//
// Carries the user doc fetched once, server-side, by
// src/app/(main)/account/layout.tsx down to every nested account page —
// so account/profile, account/addresses, etc. don't each re-fetch
// "who am I" on top of the layout's own DB-backed auth check.

import { createContext, useContext } from "react";

export type AccountUser = {
    id: string;
    name: string;
    email: string;
    phone: string;
    dob: string | null;
    loyaltyPoints: number;
    // Real account-creation date (Mongoose `timestamps: true` on User) —
    // used for a truthful "customer since" line on the Account hub.
    // Never fabricated when absent (legacy docs predating timestamps).
    createdAt: string | null;
};

const AccountContext = createContext<AccountUser | null>(null);

export function AccountProvider({
    user,
    children,
}: {
    user: AccountUser;
    children: React.ReactNode;
}) {
    return <AccountContext.Provider value={user}>{children}</AccountContext.Provider>;
}

export function useAccountUser(): AccountUser {
    const ctx = useContext(AccountContext);
    if (!ctx) {
        throw new Error("useAccountUser() must be used within the /account route group");
    }
    return ctx;
}
