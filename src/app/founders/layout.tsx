// src/app/founders/layout.tsx
import type { Metadata } from "next";
import { founderJsonLd } from "@/lib/founderSchema";

const BASE_URL = "https://www.foodknock.com";

export const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),
    title: "Our Founders — Meet the Team Behind FoodKnock",
    description:
        "Meet Manish Kumar, Gaurav Kumawat, and Ajay Sharma — the three co-founders of FoodKnock. Learn how their expertise in strategy, technology, and operations built premium online food ordering platform built in Danta, Sikar, Rajasthan.",
    alternates: {
        canonical: `${BASE_URL}/founders`,
    },
    openGraph: {
        type: "website",
        url: `${BASE_URL}/founders`,
        siteName: "FoodKnock",
        title: "Our Founders — Meet the People Building FoodKnock",
        description:
            "Three founders. One shared vision. Meet Manish Kumar, Gaurav Kumawat, and Ajay Sharma — the people who built FoodKnock from the ground up in Danta, Rajasthan.",
        images: [
            {
                url: `${BASE_URL}/og-image.png`,
                width: 1200,
                height: 630,
                alt: "FoodKnock Founders - Manish Kumar, Gaurav Kumawat, Ajay Sharma",
            },
        ],
        locale: "en_IN",
    },
    twitter: {
        card: "summary_large_image",
        title: "Our Founders — FoodKnock",
        description:
            "Meet Manish Kumar, Gaurav Kumawat, and Ajay Sharma — the team behind FoodKnock.",
        images: [`${BASE_URL}/og-image.png`],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    keywords: [
        "FoodKnock founders",
        "Manish Kumar FoodKnock",
        "Gaurav Kumawat FoodKnock",
        "Ajay Sharma FoodKnock",
        "FoodKnock co-founders",
        "FoodKnock team",
        "food delivery startup founders Rajasthan",
        "FoodKnock Danta",
        "Manish Kumar founder",
        "Gaurav Kumawat founder",
        "Ajay Sharma founder",
    ],
};

export default function FoundersLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(founderJsonLd) }}
            />
            {children}
        </>
    );
}