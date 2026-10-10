"use client";

// src/components/campaigns/CampaignCountdown.tsx
//
// Phase 12 completion — visual-only countdown. The server already decided
// this campaign is live (src/lib/campaignPublic.ts) before this component
// ever renders; this just ticks a presentation clock toward `endAt`. It
// NEVER re-derives eligibility — if it hits zero, it shows "Ending now"
// and stops, nothing more. No polling, no API calls, one setInterval(1s).

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
    if (ms <= 0) return "Ending now";
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function CampaignCountdown({ endAt }: { endAt: string | null }) {
    const [label, setLabel] = useState<string | null>(null);

    useEffect(() => {
        if (!endAt) return;
        const target = new Date(endAt).getTime();

        const tick = () => setLabel(formatRemaining(target - Date.now()));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [endAt]);

    if (!endAt || label === null) return null;

    return (
        <div
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 backdrop-blur-sm"
            role="timer"
            aria-live="off"
            aria-label={`Campaign ends in ${label}`}
        >
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/70">Ends in</span>
            <span className="font-mono text-sm font-black text-white">{label}</span>
        </div>
    );
}
