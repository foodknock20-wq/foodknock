"use client";

// src/components/products/ProductShareButton.tsx
//
// Pre-Phase 17 — Phase 1: Product Sharing. Native Web Share API first,
// clipboard-copy fallback always available. Uses `window.location.href` —
// this component only ever renders on the canonical /menu/[slug] product
// page, so the current URL IS the canonical share URL (no hardcoded/second
// route). Works logged-out: no auth check anywhere in this component.

import { Share2 } from "lucide-react";
import { toastSuccess, toastError } from "@/lib/toast";

export default function ProductShareButton({ productName }: { productName: string }) {
    const handleShare = async () => {
        const url = window.location.href;
        const shareData = {
            title: `${productName} — FoodKnock`,
            text: `Try ${productName} from FoodKnock 🍴`,
            url,
        };

        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
            try {
                await navigator.share(shareData);
            } catch (err) {
                // AbortError = user cancelled the native share sheet — not an error.
                if ((err as Error)?.name !== "AbortError") {
                    toastError("Couldn't share right now.");
                }
            }
            return;
        }

        try {
            await navigator.clipboard.writeText(url);
            toastSuccess("Product link copied!");
        } catch {
            toastError("Couldn't copy the link. Please copy it from the address bar.");
        }
    };

    return (
        <button
            onClick={handleShare}
            aria-label={`Share ${productName}`}
            className="flex items-center gap-1.5 rounded-fk-sm border border-fk-border bg-fk-surface-elevated px-2.5 py-1 text-xs font-bold text-fk-text-secondary transition-colors hover:border-[var(--fk-accent)] hover:text-[var(--fk-accent)] active:scale-95"
        >
            <Share2 size={12} strokeWidth={2.5} />
            Share
        </button>
    );
}
