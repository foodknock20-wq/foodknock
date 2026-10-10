// src/app/founders/layout.tsx
//
// src/app/founders/page.tsx is a client component (interactive founder-
// profile modal), so it cannot export `metadata` itself — Next.js only
// reads `metadata`/`generateMetadata` from server components. This layout
// is a minimal server wrapper that exists solely to carry real SEO
// metadata for the route; it renders nothing but `{children}`.

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Our Founders — FoodKnock",
    description: "Meet the people behind FoodKnock — the story, the mission, and who's building it.",
    alternates: { canonical: "https://www.foodknock.com/founders" },
};

export default function FoundersLayout({ children }: { children: React.ReactNode }) {
    return children;
}
