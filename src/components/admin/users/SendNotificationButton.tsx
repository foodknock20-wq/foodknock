"use client";

// src/components/admin/users/SendNotificationButton.tsx
//
// Phase 15F — "Send Notification" action from the Customer Detail page.
// Posts to the EXISTING /api/admin/notifications/broadcast route (mode:
// "user", extended for exactly this case) — no parallel notification API,
// no bypass of the engine's existing per-user preference gate or delivery
// logging.

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Bell, Loader2, X, Send } from "lucide-react";

export default function SendNotificationButton({ userId, userName }: { userId: string; userName: string }) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!title.trim() || !body.trim()) {
            toast.error("Title and message are required");
            return;
        }
        setSending(true);
        try {
            const res = await fetch("/api/admin/notifications/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "user", targetUserId: userId, title: title.trim(), body: body.trim() }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.message ?? "Failed to send notification");
                return;
            }
            if (data.sent > 0) {
                toast.success(`Notification sent to ${userName}`);
            } else {
                toast.error(`Not delivered — ${userName} may have notifications disabled for this category, or no active subscription.`);
            }
            setOpen(false);
            setTitle("");
            setBody("");
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-[13px] font-bold text-amber-300 transition-all hover:bg-amber-500/20"
            >
                <Bell size={14} /> Send Notification
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={() => !sending && setOpen(false)}>
                    <div
                        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#13131c] p-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-black text-white">Notify {userName}</h3>
                            <button onClick={() => !sending && setOpen(false)} className="text-stone-300 hover:text-stone-100">
                                <X size={16} />
                            </button>
                        </div>

                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={80}
                            placeholder="e.g. We miss you!"
                            className="mb-3 w-full rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2.5 text-[13px] text-stone-200 outline-none placeholder:text-stone-600 focus:border-amber-400/40"
                        />

                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">Message</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            maxLength={200}
                            rows={3}
                            placeholder="Here's 10% off your next order..."
                            className="mb-4 w-full resize-none rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2.5 text-[13px] text-stone-200 outline-none placeholder:text-stone-600 focus:border-amber-400/40"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => setOpen(false)}
                                disabled={sending}
                                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-[12px] font-black text-stone-300 transition-all hover:bg-white/[0.06] hover:text-stone-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={sending}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 py-2.5 text-[12px] font-black text-amber-300 transition-all hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                                {sending ? "Sending…" : "Send"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
