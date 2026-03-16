import type { Metadata } from "next";

export const metadata: Metadata = {
    title:       "My Orders — FoodKnock",
    description: "View your complete FoodKnock order history. Track active orders and see past orders.",
    robots:      { index: false, follow: false },
};

export default function MyOrdersLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
