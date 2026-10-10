import type { Metadata } from "next";

// SEO/indexing-boundary fix: checkout had no layout.tsx at all, so it had
// no explicit robots directive — unlike cart/layout.tsx (noindex) and
// my-orders/track-order's layouts (noindex), which already correctly mark
// their personalized/transactional pages. Checkout's own auth gate is a
// client-side redirect (see that page's own effect), so the initial
// server-rendered HTML is not auth-walled the way /account is — adding an
// explicit noindex here is the same defense-in-depth pattern already used
// for cart, not a new mechanism.
export const metadata: Metadata = {
    title:       "Checkout — FoodKnock",
    description: "Complete your FoodKnock order.",
    robots:      { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
