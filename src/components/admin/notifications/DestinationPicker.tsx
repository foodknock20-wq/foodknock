"use client";

// src/components/admin/notifications/DestinationPicker.tsx
//
// Notification System 2.0 — Phase 14. Replaces free-text URL entry with a
// structured set of destination types, each resolving to an internally
// generated, already-safe path (never a hand-typed string). Search-backed
// types (Product/Order/Campaign) reuse EXISTING, already-admin-safe/bounded
// endpoints — no new search engine. The resulting `url` is still re-validated
// server-side (resolveSafeDestination in the broadcast route) as defense in
// depth, but the admin never has a free-text field that could produce an
// unsafe value in the first place.

import { useEffect, useRef, useState } from "react";
import { Home, UtensilsCrossed, Gift, Package, Megaphone, UserCircle, Search, Loader2 } from "lucide-react";

type DestinationType = "home" | "menu" | "rewards" | "account" | "orders" | "product" | "order" | "campaign";

const FIXED_DESTINATIONS: Record<"home" | "menu" | "rewards" | "account" | "orders", { label: string; icon: React.ElementType; url: string }> = {
    home:    { label: "Home",      icon: Home,           url: "/" },
    menu:    { label: "Menu",      icon: UtensilsCrossed, url: "/menu" },
    rewards: { label: "Rewards",   icon: Gift,           url: "/loyalty" },
    account: { label: "Account",   icon: UserCircle,     url: "/account" },
    orders:  { label: "My Orders", icon: Package,        url: "/my-orders" },
};

const SEARCH_TYPES: Record<"product" | "order" | "campaign", { label: string; icon: React.ElementType; placeholder: string }> = {
    product:  { label: "Product",  icon: UtensilsCrossed, placeholder: "Search products…" },
    order:    { label: "Order",    icon: Package,         placeholder: "Search by order ID, name, or phone…" },
    campaign: { label: "Campaign", icon: Megaphone,        placeholder: "" },
};

type SearchItem = { key: string; label: string; sub?: string; url: string };

export default function DestinationPicker({ url, onChange }: { url: string; onChange: (url: string) => void }) {
    // Derive the active type from the current url so this stays a pure,
    // controlled component — no separate "selected type" state to desync
    // from the actual url prop.
    const fixedMatch = (Object.entries(FIXED_DESTINATIONS) as [keyof typeof FIXED_DESTINATIONS, typeof FIXED_DESTINATIONS[keyof typeof FIXED_DESTINATIONS]][])
        .find(([, d]) => d.url === url)?.[0];
    const [manualType, setManualType] = useState<DestinationType | null>(null);
    const activeType: DestinationType = manualType ?? fixedMatch ?? "menu";

    const [query, setQuery] = useState("");
    const [items, setItems] = useState<SearchItem[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Campaigns: a short, bounded, status=active list — fetched once when
    // this type is selected, not on every keystroke (there's no search box
    // for it). Phase 22 — `status: "active"` alone is NOT sufficient (per
    // the Campaign model's own header comment: status is admin-set and can
    // drift from real time-window validity). Mirrors isCampaignLiveNow()
    // (src/lib/campaignPublic.ts) client-side on the already-fetched docs —
    // same rule the public campaign pages use — so an admin can never pick
    // a campaign that's scheduled-but-not-started or already ended, even if
    // its stored status still says "active".
    useEffect(() => {
        if (activeType !== "campaign") return;
        let cancelled = false;

        // Wrapped in an async IIFE (nested function, not the effect body's
        // own top level) so the loading-state update happens as part of
        // this callback, not as a bare synchronous effect-body statement.
        (async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/admin/campaigns?status=active&limit=20");
                const data = res.ok ? await res.json() : null;
                if (cancelled || !data?.success) return;

                const now = Date.now();
                const live = (data.campaigns ?? []).filter((c: { startAt?: string | null; endAt?: string | null }) => {
                    const start = c.startAt ? new Date(c.startAt).getTime() : null;
                    const end = c.endAt ? new Date(c.endAt).getTime() : null;
                    if (start && start > now) return false;
                    if (end && end < now) return false;
                    return true;
                });
                setItems(live.map((c: { _id: string; name: string; slug: string }) => ({
                    key: c._id,
                    label: c.name,
                    url: `/campaigns/${c.slug}`,
                })));
            } catch {
                if (!cancelled) setItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [activeType]);

    // Product/Order: debounced search against existing endpoints.
    useEffect(() => {
        if (activeType !== "product" && activeType !== "order") return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const trimmed = query.trim();
        // No setState here — the render below already gates the results
        // list on the trimmed query length, so a too-short query simply
        // never shows whatever's left in `items` from a previous longer
        // query; nothing to clear, nothing to fetch.
        if (trimmed.length < 2) return;

        const controller = new AbortController();
        debounceRef.current = setTimeout(() => {
            setLoading(true);
            const endpoint = activeType === "product"
                ? `/api/products?search=${encodeURIComponent(trimmed)}`
                : `/api/orders?search=${encodeURIComponent(trimmed)}&limit=10`;

            fetch(endpoint, { signal: controller.signal, credentials: "include" })
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                    if (!data?.success) { setItems([]); return; }
                    if (activeType === "product") {
                        setItems((data.products ?? []).slice(0, 10).map((p: { _id: string; name: string; slug: string; price: number }) => ({
                            key: p._id, label: p.name, sub: `₹${p.price}`, url: `/menu/${p.slug}`,
                        })));
                    } else {
                        setItems((data.orders ?? []).map((o: { orderId: string; customerName: string; status: string }) => ({
                            key: o.orderId, label: `#${o.orderId.slice(-10)}`, sub: `${o.customerName} · ${o.status}`, url: `/my-orders/${o.orderId}`,
                        })));
                    }
                })
                .catch((err) => { if (err?.name !== "AbortError") setItems([]); })
                .finally(() => setLoading(false));
        }, 300);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); controller.abort(); };
    }, [activeType, query]);

    function selectType(type: DestinationType) {
        setManualType(type);
        setQuery("");
        setItems([]);
        if (type in FIXED_DESTINATIONS) {
            onChange(FIXED_DESTINATIONS[type as keyof typeof FIXED_DESTINATIONS].url);
        }
    }

    const isSearchType = activeType === "product" || activeType === "order" || activeType === "campaign";

    return (
        <div>
            <div className="flex flex-wrap gap-1.5">
                {Object.entries(FIXED_DESTINATIONS).map(([key, d]) => (
                    <button
                        key={key}
                        onClick={() => selectType(key as DestinationType)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                            activeType === key
                                ? "border border-amber-500/35 bg-amber-500/15 text-amber-400"
                                : "border border-white/[0.06] bg-white/[0.02] text-stone-300 hover:border-white/10 hover:text-stone-100"
                        }`}
                    >
                        <d.icon size={11} /> {d.label}
                    </button>
                ))}
                {Object.entries(SEARCH_TYPES).map(([key, d]) => (
                    <button
                        key={key}
                        onClick={() => selectType(key as DestinationType)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                            activeType === key
                                ? "border border-amber-500/35 bg-amber-500/15 text-amber-400"
                                : "border border-white/[0.06] bg-white/[0.02] text-stone-300 hover:border-white/10 hover:text-stone-100"
                        }`}
                    >
                        <d.icon size={11} /> {d.label}
                    </button>
                ))}
            </div>

            {isSearchType && (
                <div className="mt-2.5">
                    {activeType !== "campaign" && (
                        <div className="relative">
                            <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={SEARCH_TYPES[activeType as "product" | "order"].placeholder}
                                className="w-full rounded-xl border border-white/[0.08] bg-[#151520] py-2.5 pl-8 pr-8 text-[13px] text-stone-200 outline-none placeholder:text-stone-700 focus:border-amber-500/40"
                            />
                            {loading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-stone-600" />}
                        </div>
                    )}

                    {items.length > 0 && (activeType === "campaign" || query.trim().length >= 2) && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#111117]">
                            {items.map((item) => (
                                <button
                                    key={item.key}
                                    onClick={() => onChange(item.url)}
                                    className={`flex w-full flex-col items-start border-b border-white/[0.04] px-3.5 py-2.5 text-left last:border-b-0 hover:bg-white/[0.04] ${
                                        url === item.url ? "bg-amber-500/10" : ""
                                    }`}
                                >
                                    <span className="text-[12.5px] font-bold text-stone-200">{item.label}</span>
                                    {item.sub && <span className="text-[11px] text-stone-500">{item.sub}</span>}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeType === "campaign" && loading && (
                        <p className="mt-2 text-[11px] text-stone-600">Loading active campaigns…</p>
                    )}
                    {activeType === "campaign" && !loading && items.length === 0 && (
                        <p className="mt-2 text-[11px] text-stone-600">No currently active campaigns.</p>
                    )}
                </div>
            )}

            <p className="mt-2 text-[11px] text-stone-600">
                Will open: <span className="font-mono text-stone-400">{url}</span>
            </p>
        </div>
    );
}
