// src/app/robots.ts
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow:     "/",
                disallow:  ["/admin/", "/api/", "/order-success/"],
            },
        ],
        sitemap:   "https://www.foodknock.com/sitemap.xml",
        host:      "https://www.foodknock.com",
    };
}
