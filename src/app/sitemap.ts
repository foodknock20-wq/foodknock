// src/app/sitemap.ts
// Auto-generated sitemap for foodknock.com

import { MetadataRoute } from "next";
import { connectDB }     from "@/lib/db";
import Product           from "@/models/Product";

const BASE_URL = "https://www.foodknock.com";

// Static pages with priority
const STATIC_ROUTES: MetadataRoute.Sitemap = [
    { url: BASE_URL,                   lastModified: new Date(), changeFrequency: "daily",   priority: 1.0  },
    { url: `${BASE_URL}/menu`,         lastModified: new Date(), changeFrequency: "daily",   priority: 0.9  },
    // SEO fix: /founders existed with real metadata (src/app/founders/layout.tsx)
    // but was never listed here — a real, indexable, brand-authority page
    // search engines had no sitemap-based way to discover.
    { url: `${BASE_URL}/founders`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.6  },
    { url: `${BASE_URL}/contact`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.7  },
    // SEO fix: new FAQ page (see src/app/(main)/faq/page.tsx).
    { url: `${BASE_URL}/faq`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.6  },
    { url: `${BASE_URL}/loyalty`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8  },
    { url: `${BASE_URL}/reviews`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7  },
    // SEO fix: a genuinely public page (no auth gate) with no custom
    // metadata and no sitemap entry — see src/app/(main)/review-rewards/layout.tsx.
    { url: `${BASE_URL}/review-rewards`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`,      lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3  },
    { url: `${BASE_URL}/terms`,        lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3  },
    { url: `${BASE_URL}/auth`,         lastModified: new Date(), changeFrequency: "monthly", priority: 0.4  },
    // Phase 17.2 (F18): /cart is removed from here — its own layout sets
    // `robots: { index: false, follow: false }` (see cart/layout.tsx), so
    // listing it in the sitemap as an indexable URL directly contradicted
    // that noindex directive.
    //
    // SEO Phase 3: /track-order was removed for the exact same reason —
    // src/app/(main)/track-order/layout.tsx ALSO sets
    // `robots: {index:false, follow:false}` (it cascades to the nested
    // /track-order/[orderId] route too), so this entry had been silently
    // contradicting that noindex directive since whichever phase first
    // added it. A real, previously-undetected inconsistency, caught by
    // structuredDataInvariants.test.ts's sitemap-vs-noindex check.
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    let productRoutes: MetadataRoute.Sitemap = [];

    try {
        await connectDB();
        const products = await Product.find({ isAvailable: true })
            .select("slug updatedAt")
            .lean();

        productRoutes = products.map((p) => ({
            url:             `${BASE_URL}/menu/${p.slug}`,
            lastModified:    p.updatedAt ? new Date(p.updatedAt as Date) : new Date(),
            changeFrequency: "weekly" as const,
            priority:        0.8,
        }));
    } catch {
        // DB unavailable during build — skip dynamic routes
    }

    return [...STATIC_ROUTES, ...productRoutes];
}
