import type { Metadata } from "next";

export const metadata: Metadata = {
    title:       "Your Cart — FoodKnock",
    description: "Review your cart and place your order on FoodKnock.",
    robots:      { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
