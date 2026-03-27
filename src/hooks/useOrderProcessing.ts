"use client";

// src/hooks/useOrderProcessing.ts
//
// Manages the "order in flight" state:
//   • processingOrder  — boolean: true while order is being placed/verified
//   • startProcessing  — call before the API call begins
//   • stopProcessing   — call on error (re-enables retry)
//   • finishProcessing — call on success: clears cart, redirects, stops overlay
//
// Back-button protection:
//   While processingOrder is true, we push a dummy history entry so the browser
//   "back" gesture pops it rather than leaving the checkout page, and we
//   immediately re-push so the user stays put with a toast warning.
//
// Cart safety:
//   clearCart is called ONLY inside finishProcessing (on success).
//   On error, cart is untouched so the user can retry.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter }    from "next/navigation";
import { toast }        from "react-hot-toast";

type Options = {
    clearCart: () => void;
};

export type ProcessingVariant = "cod" | "razorpay";

export function useOrderProcessing({ clearCart }: Options) {
    const router = useRouter();

    const [processingOrder, setProcessingOrder] = useState(false);
    const [variant,         setVariant]         = useState<ProcessingVariant>("cod");

    // We keep a ref so event listeners always see the latest value
    const processingRef = useRef(false);

    const setProcessing = (val: boolean) => {
        processingRef.current = val;
        setProcessingOrder(val);
    };

    // ── Back-button guard ─────────────────────────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;

        function handlePopState() {
            if (!processingRef.current) return;

            // Re-push so the user ends up on checkout again
            window.history.pushState(null, "", window.location.href);

            toast("⚠️ Please wait — your order is being placed!", {
                duration: 3000,
                style: {
                    background:   "#fff7ed",
                    color:        "#9a3412",
                    border:       "1px solid #fed7aa",
                    borderRadius: "12px",
                    fontWeight:   700,
                    fontSize:     "13px",
                },
            });
        }

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // ── Beforeunload guard ────────────────────────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;

        function handleBeforeUnload(e: BeforeUnloadEvent) {
            if (!processingRef.current) return;
            e.preventDefault();
            // Modern browsers show their own message; returnValue triggers the dialog
            e.returnValue = "";
        }

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    // ── Public API ────────────────────────────────────────────────────────────

    /** Call this before starting any API call */
    const startProcessing = useCallback((v: ProcessingVariant = "cod") => {
        setVariant(v);
        setProcessing(true);

        // Push a dummy history entry so "back" hits it first
        if (typeof window !== "undefined") {
            window.history.pushState(null, "", window.location.href);
        }
    }, []);

    /** Call this on API/network error — hides overlay, lets user retry */
    const stopProcessing = useCallback(() => {
        setProcessing(false);
    }, []);

    /**
     * Call this on SUCCESS:
     *  1. Clears cart
     *  2. Redirects to success page
     *  3. Hides overlay (unmounted by navigation anyway)
     */
    const finishProcessing = useCallback((orderId: string) => {
        clearCart();
        setProcessing(false);
        router.push(`/order-success?orderId=${orderId}`);
    }, [clearCart, router]);

    return {
        processingOrder,
        variant,
        startProcessing,
        stopProcessing,
        finishProcessing,
    };
}