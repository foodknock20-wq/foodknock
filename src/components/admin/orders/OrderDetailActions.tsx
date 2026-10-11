"use client";

// src/components/admin/orders/OrderDetailActions.tsx
// Quick actions for the admin order detail page — mirrors OrderTable.tsx's
// card actions exactly (same routes, same modal), just rendered in the
// detail-page header instead of a grid card.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { STATUS_CONFIG, nextStatus, isCancellable } from "./OrderStatusBadge";
import CancelOrderModal from "./CancelOrderModal";
import DeleteOrderModal from "./DeleteOrderModal";

export default function OrderDetailActions({
    orderId,
    orderMongoId,
    status,
}: {
    /** Human-readable order ID (e.g. "FK-XXXX") — needed for the delete-confirmation modal. */
    orderId: string;
    orderMongoId: string;
    status: string;
}) {
    const router = useRouter();
    const [updating, setUpdating] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const next = nextStatus(status);
    const cancellable = isCancellable(status);
    // Deletion is only ever offered for an already-cancelled order — see
    // src/lib/orderDeletion.ts's own server-side precondition (never
    // allows deleting/archiving a live/active order either way, but the
    // UI shouldn't even suggest the option for one).
    const deletable = status === "cancelled";

    const handleAdvance = async () => {
        if (!next) return;
        setUpdating(true);
        try {
            const res = await fetch(`/api/orders/${orderMongoId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: next }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Order marked as ${STATUS_CONFIG[next]?.label}`);
                router.refresh();
            } else {
                toast.error(data.message || "Failed to update status");
            }
        } catch {
            toast.error("Network error — try again");
        } finally {
            setUpdating(false);
        }
    };

    const handleConfirmCancel = async (id: string, reason: string, note: string) => {
        try {
            const res = await fetch(`/api/admin/orders/${id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason, note }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Order cancelled");
                setShowCancel(false);
                router.refresh();
            } else {
                toast.error(data.message || "Failed to cancel order");
            }
        } catch {
            toast.error("Network error — try again");
        }
    };

    if (!next && !cancellable && !deletable) {
        return null; // terminal state (delivered) — nothing actionable left
    }

    return (
        <div className="flex items-center gap-2">
            {cancellable && (
                <button
                    onClick={() => setShowCancel(true)}
                    disabled={updating}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2 text-[11px] font-black text-rose-400 transition-all duration-200 hover:border-rose-400/40 hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Cancel Order
                </button>
            )}
            {next && (
                <button
                    onClick={handleAdvance}
                    disabled={updating}
                    className="flex items-center gap-1.5 rounded-xl border border-orange-500/25 bg-orange-500/10 px-3.5 py-2 text-[11px] font-black text-orange-400 transition-all duration-200 hover:border-orange-400/40 hover:bg-orange-500/18 disabled:cursor-wait disabled:opacity-50"
                >
                    {updating ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                    ) : (
                        STATUS_CONFIG[next]?.icon
                    )}
                    Mark as {STATUS_CONFIG[next]?.label}
                </button>
            )}
            {deletable && (
                <button
                    onClick={() => setShowDelete(true)}
                    title="Delete order"
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-black text-stone-300 transition-all duration-200 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
                >
                    <Trash2 size={12} />
                </button>
            )}

            {showCancel && (
                <CancelOrderModal
                    orderId={orderMongoId}
                    onClose={() => setShowCancel(false)}
                    onConfirm={handleConfirmCancel}
                />
            )}

            {showDelete && (
                <DeleteOrderModal
                    orderId={orderId}
                    orderMongoId={orderMongoId}
                    onClose={() => setShowDelete(false)}
                />
            )}
        </div>
    );
}
