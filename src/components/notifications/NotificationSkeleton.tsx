"use client";

// src/components/notifications/NotificationSkeleton.tsx
//
// Luxury skeleton card matching the redesigned NotificationCard's shape —
// used only for the initial-loading illusion pattern (My Orders' own
// SkeletonCard is the reference). No props, no logic — pure presentation.

export default function NotificationSkeleton() {
    return (
        <div className="flex animate-pulse items-start gap-3.5 rounded-[24px] border border-stone-100 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-stone-100" />
            <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="h-3.5 w-2/3 rounded-full bg-stone-100" />
                    <div className="h-3 w-10 shrink-0 rounded-full bg-stone-100" />
                </div>
                <div className="h-3 w-full rounded-full bg-stone-100" />
                <div className="h-3 w-4/5 rounded-full bg-stone-100" />
                <div className="h-5 w-24 rounded-full bg-stone-100" />
            </div>
        </div>
    );
}