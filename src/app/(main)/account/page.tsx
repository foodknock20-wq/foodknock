// src/app/(main)/account/page.tsx
//
// Account hub — quick links into each section. Auth already enforced by
// account/layout.tsx; this page itself needs no data fetching of its own
// (user comes from AccountContext).

import AccountHub from "@/components/account/AccountHub";

export default function AccountPage() {
    return <AccountHub />;
}
