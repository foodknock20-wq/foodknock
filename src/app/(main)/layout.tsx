// src/app/(main)/layout.tsx
//
// FoodKnock UI 2.0 — Phase 1: the customer route group previously had no
// layout.tsx at all — every page manually imported and rendered
// <Navbar/>/<Footer/> itself (~20 call sites across this repo). This adds
// the one shared shell wrapper (header, location, bottom nav, floating
// cart, account sheet) so it renders exactly once per navigation instead
// of being re-mounted by every page. <Footer/> is intentionally NOT
// folded in here — it stays exactly where each page already renders it
// (untouched component, untouched position in the content flow).
//
// CustomerShell itself handles the /auth shell-less exception internally
// (checks usePathname()), matching auth/page.tsx's pre-existing behavior
// of never rendering Navbar/Footer.

import CustomerShell from "@/components/shell/CustomerShell";

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return <CustomerShell>{children}</CustomerShell>;
}
