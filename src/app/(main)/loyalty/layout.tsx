import type { Metadata } from "next";

export const metadata: Metadata = {
    title:       "Loyalty Rewards — FoodKnock",
    description: "Earn points on every FoodKnock order. Redeem for discounts. 1pt per ₹10 spent. Refer friends, earn more. Join the FoodKnock Rewards program today.",
    alternates:  { canonical: "https://www.foodknock.com/loyalty" },
    openGraph: {
        title:       "FoodKnock Loyalty Rewards",
        description: "Earn points, get discounts. Order more, save more with FoodKnock Rewards.",
        url:         "https://www.foodknock.com/loyalty",
    },
};

export default function LoyaltyLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
