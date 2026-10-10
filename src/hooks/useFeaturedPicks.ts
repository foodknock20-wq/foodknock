"use client";

// src/hooks/useFeaturedPicks.ts
//
// Empty-state redesign (Cart + My Orders) — a small, reused data source for
// the "discover something real" section on both empty states. Deliberately
// NOT a new backend route: calls the existing, already-public, already
// CDN-cached (`Cache-Control: s-maxage=60`) `GET /api/products?featured=true`
// endpoint — the same one the rest of the app already uses for featured
// listings. One bounded fetch, once per mount, never refetched on
// unrelated re-renders. Maps the response into the exact `RecommendedProduct`
// shape `RecommendationRail` (src/components/products/RecommendationRail.tsx)
// already renders, so both empty states reuse that existing, tested card/
// add-to-cart UI rather than inventing a second product-card component.

import { useEffect, useState } from "react";
import type { RecommendedProduct } from "@/lib/recommendations";

const MAX_PICKS = 6;

export function useFeaturedPicks() {
    const [products, setProducts] = useState<RecommendedProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        fetch("/api/products?featured=true", { signal: controller.signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!data?.success || !Array.isArray(data.products)) return;
                const available = (data.products as RecommendedProduct[])
                    .filter((p) => p.isAvailable && p.stock > 0)
                    .slice(0, MAX_PICKS);
                setProducts(available);
            })
            .catch((err) => { if (err?.name !== "AbortError") setProducts([]); })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, []);

    return { products, loading };
}
