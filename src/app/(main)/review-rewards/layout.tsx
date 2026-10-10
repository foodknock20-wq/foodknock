import type { Metadata } from "next";

// SEO fix: page.tsx is a client component ("use client"), so it cannot
// export `metadata` itself — same situation as src/app/founders/layout.tsx.
// This page was previously inheriting only the generic site-wide default
// title/description despite being a genuine, public, promotable feature
// (Instagram review → reward). Minimal server wrapper, renders nothing but
// children.
export const metadata: Metadata = {
    title: "Review Rewards — Get a Free Item | FoodKnock",
    description: "Post an Instagram review of your FoodKnock order and get a free item on your next order. See how it works and check your submission status.",
    alternates: { canonical: "https://www.foodknock.com/review-rewards" },
};

export default function ReviewRewardsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
