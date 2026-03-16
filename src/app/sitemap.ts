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
    { url: `${BASE_URL}/contact`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.7  },
    { url: `${BASE_URL}/loyalty`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8  },
    { url: `${BASE_URL}/reviews`,      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7  },
    { url: `${BASE_URL}/track-order`,  lastModified: new Date(), changeFrequency: "monthly", priority: 0.5  },
    { url: `${BASE_URL}/privacy`,      lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3  },
    { url: `${BASE_URL}/terms`,        lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3  },
    { url: `${BASE_URL}/auth`,         lastModified: new Date(), changeFrequency: "monthly", priority: 0.4  },
    { url: `${BASE_URL}/cart`,         lastModified: new Date(), changeFrequency: "monthly", priority: 0.5  },
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
