// src/hooks/useCartValidation.ts
//
// PHASE 4 — CART 2.0
//
// Shared client-side hook for /api/cart/validate, used by both the cart
// page and the checkout page so there is exactly one place that owns:
//   - debouncing rapid cart mutations (no fetch-per-keystroke/+click)
//   - ignoring stale responses when a newer validation request has already
//     started (race condition from Step 30 of the Phase 4 spec)
//   - syncing server-confirmed price/stock back onto the persisted cart
//     store (via updateItem) so displayed totals and the max-quantity
//     stepper stay correct without a second source of truth
//
// This hook does NOT compute or trust any financial total — it only reports
// per-item availability/price status from src/lib/pricing.ts's
// validateCartItems(), the same authoritative Product data Phase 2A already
// uses for order creation.

import { useEffect, useRef, useState, useCallback } from "react";
import { useCartStore, type CartItem } from "@/store/cartStore";
import type { CartValidationItem } from "@/lib/pricing";

export type { CartValidationItem };

interface UseCartValidationResult {
    /** Map of productId -> validation result, for the CURRENT cart items. */
    statusById: Record<string, CartValidationItem>;
    /** False only once the first validation pass has completed. */
    loading: boolean;
    /** True if the validation request itself failed (network/server) — not the same as an invalid cart. */
    checkFailed: boolean;
    /** True only when every current item is orderable (AVAILABLE or PRICE_CHANGED). */
    isCartValid: boolean;
    revalidate: () => void;
}

const DEBOUNCE_MS = 450;

export function useCartValidation(items: CartItem[]): UseCartValidationResult {
    const updateItem = useCartStore((s) => s.updateItem);

    const [statusById, setStatusById] = useState<Record<string, CartValidationItem>>({});
    const [loading, setLoading] = useState(items.length > 0);
    const [checkFailed, setCheckFailed] = useState(false);

    // Identity of "what should be validated right now" — only id+quantity
    // matter (price is sent too, but doesn't belong in the dependency key
    // since the server response is what updates it, not the trigger).
    const signature = items.map((i) => `${i._id}:${i.quantity}`).join("|");

    const requestIdRef = useRef(0);

    const runValidation = useCallback(() => {
        const currentItems = useCartStore.getState().items;

        if (currentItems.length === 0) {
            setStatusById({});
            setLoading(false);
            setCheckFailed(false);
            return;
        }

        const myRequestId = ++requestIdRef.current;
        setLoading(true);

        fetch("/api/cart/validate", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: currentItems.map((i) => ({ _id: i._id, quantity: i.quantity, price: i.price })),
            }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("validate_failed"))))
            .then((data: { success: boolean; items?: CartValidationItem[] }) => {
                // A newer validation request has since started — this
                // response is stale, discard it (Step 30: race protection).
                if (myRequestId !== requestIdRef.current) return;

                if (!data?.success || !Array.isArray(data.items)) {
                    setCheckFailed(true);
                    setLoading(false);
                    return;
                }

                const map: Record<string, CartValidationItem> = {};
                for (const result of data.items) {
                    map[result._id] = result;

                    // Sync confirmed price/stock back onto the persisted
                    // cart line so totals/stepper limits stay correct.
                    if (typeof result.currentPrice === "number" || typeof result.availableStock === "number") {
                        updateItem(result._id, {
                            ...(typeof result.currentPrice === "number" ? { price: result.currentPrice } : {}),
                            ...(typeof result.availableStock === "number" ? { stock: result.availableStock } : {}),
                        });
                    }
                }

                setStatusById(map);
                setCheckFailed(false);
                setLoading(false);
            })
            .catch(() => {
                if (myRequestId !== requestIdRef.current) return;
                setCheckFailed(true);
                setLoading(false);
            });
    }, [updateItem]);

    useEffect(() => {
        const handle = setTimeout(runValidation, items.length > 0 ? DEBOUNCE_MS : 0);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);

    const isCartValid =
        !checkFailed &&
        items.every((i) => {
            const status = statusById[i._id]?.status;
            return status === "AVAILABLE" || status === "PRICE_CHANGED";
        });

    return { statusById, loading, checkFailed, isCartValid, revalidate: runValidation };
}
