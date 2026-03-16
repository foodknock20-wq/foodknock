// src/app/layout.tsx
// FoodKnock — Root layout with full SEO metadata

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster }        from "react-hot-toast";
import { Suspense }       from "react";
import NotificationPrompt from "@/components/shared/NotificationPrompt";

const BASE_URL = "https://www.foodknock.com";

// ─── Viewport ──────────────────────────────────────────────────────────────
export const viewport: Viewport = {
    themeColor:   "#f59e0b",
    width:        "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit:  "cover",
};

// ─── JSON-LD (defined outside component — no re-creation on each render) ───
const jsonLd = {
    "@context":       "https://schema.org",
    "@type":          "FoodEstablishment",
    name:             "FoodKnock",
    url:              BASE_URL,
    logo:             `${BASE_URL}/icon-512.png`,
    image:            `${BASE_URL}/og-image.png`,
    description:      "Fresh burgers, pizza, momos, shakes, juices & ice cream. Fast online food delivery in Danta, Sikar, Rajasthan.",
    email:            "foodknock20@gmail.com",
    servesCuisine:    ["Fast Food", "Burgers", "Pizza", "Indian", "Desserts"],
    priceRange:       "₹",
    currenciesAccepted: "INR",
    paymentAccepted:  "Credit Card, Debit Card, UPI, Net Banking",
    address: {
        "@type":         "PostalAddress",
        streetAddress:   "Ramgarh Bas Stand Circle",
        addressLocality: "Danta",
        addressRegion:   "Rajasthan",
        postalCode:      "332403",
        addressCountry:  "IN",
    },
    geo: {
        "@type":    "GeoCoordinates",
        latitude:   "27.5",
        longitude:  "75.4",
    },
    openingHoursSpecification: [
        {
            "@type":   "OpeningHoursSpecification",
            dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
            opens:     "09:00",
            closes:    "22:00",
        },
    ],
    hasMap: "https://maps.google.com/?q=Ramgarh+Bas+Stand+Circle+Danta+Sikar+Rajasthan",
};

// ─── Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),

    title: {
        default:  "FoodKnock — Fresh Food Delivery | Burgers, Pizza, Momos & More",
        template: "%s | FoodKnock",
    },
    description:
        "Order fresh burgers, pizza, momos, shakes, juices & ice cream online from FoodKnock. Fast delivery in Danta, Sikar, Rajasthan. Track your order live. Earn loyalty points on every order.",
    applicationName: "FoodKnock",
    authors: [{ name: "FoodKnock", url: BASE_URL }],
    creator: "FoodKnock",
    publisher: "FoodKnock",
    generator: "Next.js",

    manifest: "/manifest.webmanifest",

    appleWebApp: {
        capable:        true,
        statusBarStyle: "default",
        title:          "FoodKnock",
        startupImage:   [{ url: "/icon-512.png" }],
    },

    openGraph: {
        type:        "website",
        locale:      "en_IN",
        url:         BASE_URL,
        siteName:    "FoodKnock",
        title:       "FoodKnock — Fresh Food Delivery in Danta, Sikar",
        description: "Burgers, pizza, momos, shakes, juices & ice cream — delivered fresh & fast. Order online, track live, earn rewards.",
        images: [
            {
                url:    "/og-image.png",
                width:  1200,
                height: 630,
                alt:    "FoodKnock — Fresh Food Delivery",
            },
        ],
    },

    twitter: {
        card:        "summary_large_image",
        title:       "FoodKnock — Fresh Food Delivery",
        description: "Burgers, pizza, momos, shakes & more. Order online, delivered fast.",
        images:      ["/og-image.png"],
    },

    icons: {
        icon: [
            { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple:    [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
        shortcut: "/icon-192.png",
    },

    keywords: [
        "FoodKnock", "food delivery", "online food order", "burger delivery",
        "pizza delivery", "momos", "fast food", "juice", "ice cream",
        "Danta food delivery", "Sikar food delivery", "Rajasthan food",
        "online order Danta", "food near me", "shake", "pasta", "noodles",
        "pav bhaji", "sandwich", "fast delivery food", "loyalty points food",
    ],

    category: "food",

    robots: {
        index:     true,
        follow:    true,
        googleBot: {
            index:               true,
            follow:              true,
            "max-image-preview": "large",
            "max-snippet":       -1,
        },
    },

    verification: {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
    },

    alternates: {
        canonical: BASE_URL,
    },
};

// ─── Root layout ───────────────────────────────────────────────────────────
export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body className="bg-[#FFFBF5] text-stone-800 antialiased">
                {/* JSON-LD structured data — Next.js moves this into <head> automatically */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />

                {children}

                <Suspense fallback={null}>
                    <NotificationPrompt />
                </Suspense>

                <Toaster
                    position="top-center"
                    toastOptions={{
                        style: {
                            background:   "#ffffff",
                            color:        "#292524",
                            border:       "1px solid #fed7aa",
                            borderRadius: "14px",
                            fontSize:     "14px",
                            fontWeight:   "500",
                            boxShadow:    "0 4px 24px rgba(251,146,60,0.15)",
                        },
                        success: { iconTheme: { primary: "#f97316", secondary: "#fff7ed" } },
                        error:   { iconTheme: { primary: "#ef4444", secondary: "#fff1f2" } },
                    }}
                />
            </body>
        </html>
    );
}