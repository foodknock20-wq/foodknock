import type { Metadata } from "next";

export const metadata: Metadata = {
    title:       "Track Your Order — FoodKnock",
    description: "Track your FoodKnock order in real time. Enter your order ID to see live status updates.",
    robots:      { index: false, follow: false },
};

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
