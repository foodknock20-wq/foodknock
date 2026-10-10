"use client";

// src/hooks/useCartRecommendations.ts
//
// Pre-Phase 17 — Phase 3: shared data-fetching hook for cart-aware
// recommendations, used by both the Cart page and Checkout's upsell strip
// so the fetch/debounce logic lives in exactly one place. Debounced on the
// cart's id list (not on every render) — cart composition typically
// changes a few times per session, not per keystroke, so a short debounce
// is enough to avoid a burst of requests when multiple items are added in
// quick succession.

import { useEffect, useRef, useState } from "react";
import type { RecommendedProduct } from "@/lib/recommendations";

export function useCartRecommendations(cartIds: string[]) {
    const [title, setTitle] = useState("");
    const [products, setProducts] = useState<RecommendedProduct[]>([]);
    const [loading, setLoading] = useState(false);

    // Stable key so the effect only re-fires when the SET of ids actually
    // changes, not on every cart quantity tick or unrelated re-render.
    const key = [...cartIds].sort().join(",");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!key) {
            setProducts([]);
            setTitle("");
            return;
        }

        setLoading(true);
        const controller = new AbortController();
        debounceRef.current = setTimeout(() => {
            fetch(`/api/recommendations/cart?ids=${encodeURIComponent(key)}`, { signal: controller.signal })
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                    if (data?.success) {
                        setProducts(data.products);
                        setTitle(data.title);
                    }
                })
                .catch((err) => { if (err?.name !== "AbortError") { setProducts([]); setTitle(""); } })
                .finally(() => setLoading(false));
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            controller.abort();
        };
    }, [key]);

    return { title, products, loading };
}
