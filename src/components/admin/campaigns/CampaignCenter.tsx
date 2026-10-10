"use client";

// src/components/admin/campaigns/CampaignCenter.tsx
//
// Phase 12 — admin Campaign Center. Functional-first pass (per the agreed
// scope): four tabs, each independently fetching/mutating — no shared
// giant form state. Visual polish (9-step wizard, preview mode) is an
// explicit follow-up, not attempted here.

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Copy, Pause, Play, Sparkles, Download } from "lucide-react";

const inputClass =
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-stone-100 outline-none transition-colors focus:border-amber-400/50 focus:bg-white/[0.05]";

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111118]">
            <div className="border-b border-white/[0.06] px-5 py-4">
                <h2 className="font-serif text-base font-bold text-white">{title}</h2>
                {sub && <p className="mt-0.5 text-[12px] text-stone-600">{sub}</p>}
            </div>
            <div className="space-y-3 px-5 py-4">{children}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{label}</label>
            {children}
        </div>
    );
}

const TABS = ["Campaigns", "Offers", "Spin Rewards", "Offline Distribution", "Physical Pool"] as const;
type Tab = typeof TABS[number];

export default function CampaignCenter() {
    const [tab, setTab] = useState<Tab>("Campaigns");

    return (
        <div className="space-y-5">
            <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#0c0c12] p-1.5">
                {TABS.map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`shrink-0 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                            tab === t ? "bg-amber-500/15 text-amber-400" : "text-stone-300 hover:text-stone-100"
                        }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === "Campaigns" && <CampaignsTab />}
            {tab === "Offers" && <OffersTab />}
            {tab === "Spin Rewards" && <SpinRewardsTab />}
            {tab === "Offline Distribution" && <OfflineDistributionTab />}
            {tab === "Physical Pool" && <PhysicalPoolTab />}
        </div>
    );
}

// ── Campaigns ────────────────────────────────────────────────────────────
type CampaignRow = {
    _id: string; name: string; slug: string; campaignType: string; status: string;
    startAt: string | null; endAt: string | null; priority: number;
    visibility: { homepage: boolean; loyaltyPage: boolean };
};

const CAMPAIGN_STATUSES = ["draft", "scheduled", "active", "paused", "ended", "archived"] as const;

function CampaignsTab() {
    const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [campaignType, setCampaignType] = useState("custom");
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");
    const [homepage, setHomepage] = useState(false);
    const [loyaltyPage, setLoyaltyPage] = useState(false);
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/campaigns?limit=50", { credentials: "include" });
            const data = await res.json();
            if (data.success) setCampaigns(data.campaigns);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleCreate() {
        if (!name.trim()) { toast.error("Campaign name is required"); return; }
        setCreating(true);
        try {
            const res = await fetch("/api/admin/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name, campaignType, startAt: startAt || null, endAt: endAt || null,
                    visibility: { homepage, loyaltyPage },
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            toast.success(`Created "${data.campaign.name}"`);
            setName("");
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create campaign");
        } finally {
            setCreating(false);
        }
    }

    async function handleStatusChange(id: string, status: string) {
        try {
            const res = await fetch(`/api/admin/campaigns/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            setCampaigns((prev) => prev.map((c) => (c._id === id ? { ...c, status } : c)));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update status");
        }
    }

    async function handleDuplicate(id: string) {
        try {
            const res = await fetch(`/api/admin/campaigns/${id}/duplicate`, { method: "POST", credentials: "include" });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            toast.success(`Duplicated as "${data.campaign.name}"`);
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to duplicate");
        }
    }

    return (
        <div className="space-y-5">
            <Card title="Create Campaign" sub="Starts as a draft — publish by setting status to Active once configured">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="col-span-2 sm:col-span-2">
                        <Field label="Name">
                            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Diwali Dhamaka" />
                        </Field>
                    </div>
                    <Field label="Type">
                        <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)} className={inputClass}>
                            {["festival", "flash_sale", "weekend", "anniversary", "customer_appreciation", "loyalty", "product_promotion", "category_promotion", "free_delivery", "offline", "custom"].map((t) => (
                                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Priority">
                        <input type="number" className={inputClass} disabled value={0} />
                    </Field>
                    <Field label="Starts">
                        <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Ends">
                        <input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={inputClass} />
                    </Field>
                </div>
                <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-[12px] font-bold text-stone-400">
                        <input type="checkbox" checked={homepage} onChange={(e) => setHomepage(e.target.checked)} /> Show on homepage
                    </label>
                    <label className="flex items-center gap-1.5 text-[12px] font-bold text-stone-400">
                        <input type="checkbox" checked={loyaltyPage} onChange={(e) => setLoyaltyPage(e.target.checked)} /> Show on /loyalty
                    </label>
                </div>
                <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
                >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Campaign
                </button>
            </Card>

            <Card title="All Campaigns">
                {loading ? (
                    <Loader2 size={18} className="mx-auto animate-spin text-stone-500" />
                ) : campaigns.length === 0 ? (
                    <p className="text-center text-[12px] text-stone-500">No campaigns yet</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[12px]">
                            <thead>
                                <tr className="border-b border-white/[0.06] text-stone-500">
                                    <th className="py-2 pr-3 font-bold">Name</th>
                                    <th className="py-2 pr-3 font-bold">Type</th>
                                    <th className="py-2 pr-3 font-bold">Status</th>
                                    <th className="py-2 pr-3 font-bold">Window</th>
                                    <th className="py-2 font-bold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map((c) => (
                                    <tr key={c._id} className="border-b border-white/[0.03] text-stone-300">
                                        <td className="py-2.5 pr-3 font-bold text-stone-100">{c.name}</td>
                                        <td className="py-2.5 pr-3">{c.campaignType.replace(/_/g, " ")}</td>
                                        <td className="py-2.5 pr-3">
                                            <select
                                                value={c.status}
                                                onChange={(e) => handleStatusChange(c._id, e.target.value)}
                                                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] font-bold text-stone-200"
                                            >
                                                {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="py-2.5 pr-3 text-stone-500">
                                            {c.startAt ? new Date(c.startAt).toLocaleDateString() : "—"} → {c.endAt ? new Date(c.endAt).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="py-2.5">
                                            <button onClick={() => handleDuplicate(c._id)} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1 text-[11px] font-bold text-stone-300 hover:bg-white/[0.05]">
                                                <Copy size={10} /> Duplicate
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

// ── Offers ───────────────────────────────────────────────────────────────
type OfferRow = {
    _id: string; name: string; discountType: string; discountValue: number;
    minimumOrderValue: number; usageLimit: number | null; usedCount: number; status: string;
};

function OffersTab() {
    const [offers, setOffers] = useState<OfferRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [discountType, setDiscountType] = useState<"FIXED" | "PERCENTAGE" | "FREE_DELIVERY">("FIXED");
    const [discountValue, setDiscountValue] = useState("50");
    const [minimumOrderValue, setMinimumOrderValue] = useState("299");
    const [usageLimit, setUsageLimit] = useState("");
    const [audience, setAudience] = useState<"EVERYONE" | "REGISTERED_USERS" | "FIRST_ORDER" | "REPEAT_CUSTOMERS" | "VIP" | "MIN_LOYALTY_POINTS">("EVERYONE");
    const [audienceMinValue, setAudienceMinValue] = useState("");
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/offers?limit=50", { credentials: "include" });
            const data = await res.json();
            if (data.success) setOffers(data.offers);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleCreate() {
        if (!name.trim()) { toast.error("Offer name is required"); return; }
        setCreating(true);
        try {
            const res = await fetch("/api/admin/offers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name, discountType,
                    discountValue: discountType === "FREE_DELIVERY" ? 0 : Number(discountValue),
                    minimumOrderValue: Number(minimumOrderValue || 0),
                    usageLimit: usageLimit ? Number(usageLimit) : null,
                    audience,
                    audienceMinValue: audienceMinValue ? Number(audienceMinValue) : 0,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            toast.success(`Created "${data.offer.name}"`);
            setName("");
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create offer");
        } finally {
            setCreating(false);
        }
    }

    async function handleToggle(offer: OfferRow) {
        const nextStatus = offer.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
        try {
            const res = await fetch(`/api/admin/offers/${offer._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            setOffers((prev) => prev.map((o) => (o._id === offer._id ? { ...o, status: nextStatus } : o)));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update offer");
        }
    }

    return (
        <div className="space-y-5">
            <Card title="Create Automatic Offer" sub="No code required — applied automatically when a cart is eligible and no coupon is present">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="col-span-2">
                        <Field label="Name">
                            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Weekend 10% Off" />
                        </Field>
                    </div>
                    <Field label="Type">
                        <select value={discountType} onChange={(e) => setDiscountType(e.target.value as typeof discountType)} className={inputClass}>
                            <option value="FIXED">Fixed (₹)</option>
                            <option value="PERCENTAGE">Percentage (%)</option>
                            <option value="FREE_DELIVERY">Free Delivery</option>
                        </select>
                    </Field>
                    {discountType !== "FREE_DELIVERY" && (
                        <Field label="Value">
                            <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className={inputClass} min={1} />
                        </Field>
                    )}
                    <Field label="Min Order (₹)">
                        <input type="number" value={minimumOrderValue} onChange={(e) => setMinimumOrderValue(e.target.value)} className={inputClass} min={0} />
                    </Field>
                    <Field label="Usage Limit">
                        <input type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} className={inputClass} placeholder="Unlimited" min={1} />
                    </Field>
                    <Field label="Audience">
                        <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className={inputClass}>
                            <option value="EVERYONE">Everyone</option>
                            <option value="REGISTERED_USERS">Registered users</option>
                            <option value="FIRST_ORDER">First order only</option>
                            <option value="REPEAT_CUSTOMERS">Repeat customers</option>
                            <option value="VIP">VIP (₹2000+ lifetime)</option>
                            <option value="MIN_LOYALTY_POINTS">Min loyalty points</option>
                        </select>
                    </Field>
                    {audience === "MIN_LOYALTY_POINTS" && (
                        <Field label="Min Points">
                            <input type="number" value={audienceMinValue} onChange={(e) => setAudienceMinValue(e.target.value)} className={inputClass} min={0} />
                        </Field>
                    )}
                </div>
                <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
                >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Offer
                </button>
            </Card>

            <Card title="All Offers">
                {loading ? (
                    <Loader2 size={18} className="mx-auto animate-spin text-stone-500" />
                ) : offers.length === 0 ? (
                    <p className="text-center text-[12px] text-stone-500">No offers yet</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[12px]">
                            <thead>
                                <tr className="border-b border-white/[0.06] text-stone-500">
                                    <th className="py-2 pr-3 font-bold">Name</th>
                                    <th className="py-2 pr-3 font-bold">Discount</th>
                                    <th className="py-2 pr-3 font-bold">Min Order</th>
                                    <th className="py-2 pr-3 font-bold">Usage</th>
                                    <th className="py-2 pr-3 font-bold">Status</th>
                                    <th className="py-2 font-bold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {offers.map((o) => (
                                    <tr key={o._id} className="border-b border-white/[0.03] text-stone-300">
                                        <td className="py-2.5 pr-3 font-bold text-stone-100">{o.name}</td>
                                        <td className="py-2.5 pr-3">{o.discountType === "FREE_DELIVERY" ? "Free Delivery" : o.discountType === "FIXED" ? `₹${o.discountValue}` : `${o.discountValue}%`}</td>
                                        <td className="py-2.5 pr-3">₹{o.minimumOrderValue}</td>
                                        <td className="py-2.5 pr-3">{o.usedCount}/{o.usageLimit ?? "∞"}</td>
                                        <td className="py-2.5 pr-3">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${o.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" : "bg-stone-500/15 text-stone-400"}`}>{o.status}</span>
                                        </td>
                                        <td className="py-2.5">
                                            <button onClick={() => handleToggle(o)} className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1 text-[11px] font-bold text-stone-300 hover:bg-white/[0.05]">
                                                {o.status === "ACTIVE" ? <><Pause size={10} /> Pause</> : <><Play size={10} /> Activate</>}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

// ── Spin Rewards ─────────────────────────────────────────────────────────
type SlotRow = {
    _id: string; slotIndex: number; label: string; rewardType: string; value: number;
    maximumDiscount: number | null; minimumOrderValue: number; weight: number; expiryDays: number; active: boolean;
};

function SpinRewardsTab() {
    const [slots, setSlots] = useState<SlotRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/spin-rewards", { credentials: "include" });
            const data = await res.json();
            if (data.success) setSlots(data.slots);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    function patchLocal(id: string, patch: Partial<SlotRow>) {
        setSlots((prev) => prev.map((s) => (s._id === id ? { ...s, ...patch } : s)));
    }

    async function handleSave(slot: SlotRow) {
        setSavingId(slot._id);
        try {
            const res = await fetch(`/api/admin/spin-rewards/${slot._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    label: slot.label, value: slot.value, maximumDiscount: slot.maximumDiscount,
                    minimumOrderValue: slot.minimumOrderValue, weight: slot.weight,
                    expiryDays: slot.expiryDays, active: slot.active,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            toast.success("Saved");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSavingId(null);
        }
    }

    return (
        <Card title="Digital Spin & Win — 8 Reward Slots" sub="Amounts/weights are read fresh on every spin — never hardcoded. Odds are not shown to customers.">
            {loading ? (
                <Loader2 size={18} className="mx-auto animate-spin text-stone-500" />
            ) : (
                <div className="space-y-2.5">
                    {slots.map((s) => (
                        <div key={s._id} className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] p-3 sm:grid-cols-6">
                            <Field label="Label">
                                <input value={s.label} onChange={(e) => patchLocal(s._id, { label: e.target.value })} className={inputClass} />
                            </Field>
                            <Field label="Type">
                                <input value={s.rewardType.replace(/_/g, " ")} disabled className={`${inputClass} opacity-60`} />
                            </Field>
                            <Field label="Value">
                                <input type="number" value={s.value} onChange={(e) => patchLocal(s._id, { value: Number(e.target.value) })} className={inputClass} />
                            </Field>
                            <Field label="Weight">
                                <input type="number" value={s.weight} onChange={(e) => patchLocal(s._id, { weight: Number(e.target.value) })} className={inputClass} min={1} />
                            </Field>
                            <Field label="Expiry (days)">
                                <input type="number" value={s.expiryDays} onChange={(e) => patchLocal(s._id, { expiryDays: Number(e.target.value) })} className={inputClass} min={1} />
                            </Field>
                            <div className="flex items-end justify-between gap-2">
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-stone-400">
                                    <input type="checkbox" checked={s.active} onChange={(e) => patchLocal(s._id, { active: e.target.checked })} /> Active
                                </label>
                                <button
                                    onClick={() => handleSave(s)}
                                    disabled={savingId === s._id}
                                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
                                >
                                    {savingId === s._id ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

// ── Offline Distribution ──────────────────────────────────────────────────
type DistributionRow = {
    _id: string; locationLabel: string; date: string; distributedCount: number; redeemedCount: number; notes: string;
};

function OfflineDistributionTab() {
    const [entries, setEntries] = useState<DistributionRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [locationLabel, setLocationLabel] = useState("");
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [distributedCount, setDistributedCount] = useState("0");
    const [redeemedCount, setRedeemedCount] = useState("0");
    const [notes, setNotes] = useState("");
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/offline-distribution", { credentials: "include" });
            const data = await res.json();
            if (data.success) setEntries(data.entries);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleCreate() {
        if (!locationLabel.trim()) { toast.error("Location label is required"); return; }
        setCreating(true);
        try {
            const res = await fetch("/api/admin/offline-distribution", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    locationLabel, date,
                    distributedCount: Number(distributedCount || 0),
                    redeemedCount: Number(redeemedCount || 0),
                    notes,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            toast.success("Logged");
            setLocationLabel(""); setNotes(""); setDistributedCount("0"); setRedeemedCount("0");
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to log entry");
        } finally {
            setCreating(false);
        }
    }

    return (
        <div className="space-y-5">
            <Card title="Log Physical Distribution" sub="Manual tally for the 6-slot physical Diwali wheel — not linked to any specific coupon identity">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="col-span-2">
                        <Field label="Location">
                            <input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} className={inputClass} placeholder="e.g. Danta Main Market Stall" />
                        </Field>
                    </div>
                    <Field label="Date">
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Distributed">
                        <input type="number" value={distributedCount} onChange={(e) => setDistributedCount(e.target.value)} className={inputClass} min={0} />
                    </Field>
                    <Field label="Redeemed">
                        <input type="number" value={redeemedCount} onChange={(e) => setRedeemedCount(e.target.value)} className={inputClass} min={0} />
                    </Field>
                    <div className="col-span-2 sm:col-span-3">
                        <Field label="Notes">
                            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} maxLength={500} />
                        </Field>
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
                >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Log Entry
                </button>
            </Card>

            <Card title="Distribution Log">
                {loading ? (
                    <Loader2 size={18} className="mx-auto animate-spin text-stone-500" />
                ) : entries.length === 0 ? (
                    <p className="text-center text-[12px] text-stone-500">No entries logged yet</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[12px]">
                            <thead>
                                <tr className="border-b border-white/[0.06] text-stone-500">
                                    <th className="py-2 pr-3 font-bold">Location</th>
                                    <th className="py-2 pr-3 font-bold">Date</th>
                                    <th className="py-2 pr-3 font-bold">Distributed</th>
                                    <th className="py-2 pr-3 font-bold">Redeemed</th>
                                    <th className="py-2 font-bold">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e) => (
                                    <tr key={e._id} className="border-b border-white/[0.03] text-stone-300">
                                        <td className="py-2.5 pr-3 font-bold text-stone-100">{e.locationLabel}</td>
                                        <td className="py-2.5 pr-3 text-stone-500">{new Date(e.date).toLocaleDateString()}</td>
                                        <td className="py-2.5 pr-3">{e.distributedCount}</td>
                                        <td className="py-2.5 pr-3">{e.redeemedCount}</td>
                                        <td className="py-2.5 text-stone-500">{e.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

// ── Physical Diwali Coupon Pool ───────────────────────────────────────────
// The physical 6-slot wheel itself is 100% offline — this tab is ONLY the
// backend for generating/tracking the reward coupons it hands out. Every
// generated row is a real Phase 11 Coupon (source:"physical"), redeemable
// through the exact same checkout coupon box as any other code.
type CampaignOption = { _id: string; name: string };
type PhysicalCouponRow = {
    _id: string; code: string; physicalRewardLabel: string | null; status: string;
    physicalStatus: string | null; expiresAt: string | null;
};
type PoolSummary = {
    generated: number; distributed: number; redeemed: number; remaining: number;
    byReward: Array<{ label: string; generated: number; distributed: number; redeemed: number }>;
};

function PhysicalPoolTab() {
    const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
    const [campaignId, setCampaignId] = useState("");
    const [expiresInDays, setExpiresInDays] = useState("60");
    type TierDraft = { label: string; discountType: "FIXED" | "PERCENTAGE" | "FREE_DELIVERY"; discountValue: string; quantity: string };
    const [tiers, setTiers] = useState<TierDraft[]>([
        { label: "Reward A", discountType: "FIXED", discountValue: "25", quantity: "10" },
        { label: "Reward B", discountType: "FIXED", discountValue: "50", quantity: "10" },
    ]);
    const [generating, setGenerating] = useState(false);
    const [coupons, setCoupons] = useState<PhysicalCouponRow[]>([]);
    const [summary, setSummary] = useState<PoolSummary | null>(null);
    const [loadingList, setLoadingList] = useState(false);
    const [distributeQty, setDistributeQty] = useState("100");

    useEffect(() => {
        fetch("/api/admin/campaigns?limit=100", { credentials: "include" })
            .then((r) => r.json())
            .then((data) => { if (data.success) setCampaigns(data.campaigns); });
    }, []);

    const load = useCallback(async () => {
        if (!campaignId) { setCoupons([]); setSummary(null); return; }
        setLoadingList(true);
        try {
            const res = await fetch(`/api/admin/physical-coupons?campaignId=${campaignId}&limit=50`, { credentials: "include" });
            const data = await res.json();
            if (data.success) { setCoupons(data.coupons); setSummary(data.summary); }
        } finally {
            setLoadingList(false);
        }
    }, [campaignId]);

    useEffect(() => { load(); }, [load]);

    function updateTier(i: number, patch: Partial<TierDraft>) {
        setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
    }
    function addTier() {
        setTiers((prev) => [...prev, { label: `Reward ${String.fromCharCode(65 + prev.length)}`, discountType: "FIXED", discountValue: "25", quantity: "10" }]);
    }
    function removeTier(i: number) {
        setTiers((prev) => prev.filter((_, idx) => idx !== i));
    }

    async function handleGenerate() {
        if (!campaignId) { toast.error("Select a campaign first"); return; }
        setGenerating(true);
        try {
            const res = await fetch("/api/admin/physical-coupons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    campaignId,
                    expiresInDays: Number(expiresInDays || 60),
                    rewardTiers: tiers.map((t) => ({
                        label: t.label, discountType: t.discountType,
                        discountValue: Number(t.discountValue), quantity: Number(t.quantity),
                    })),
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            toast.success(`Generated ${data.totalGenerated} physical coupons`);
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to generate pool");
        } finally {
            setGenerating(false);
        }
    }

    async function handleMarkDistributed() {
        if (!campaignId) return;
        try {
            const res = await fetch("/api/admin/physical-coupons/distribute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ campaignId, quantity: Number(distributeQty || 0) }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            toast.success(`Marked ${data.updated} as distributed`);
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update");
        }
    }

    return (
        <div className="space-y-5">
            <Card title="Physical Diwali Pool" sub="The physical 6-slot wheel is fully offline — this only generates/tracks the reward coupon codes it hands out">
                <Field label="Campaign">
                    <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={inputClass}>
                        <option value="">Select a campaign…</option>
                        {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                </Field>

                {summary && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                            { label: "Generated", value: summary.generated },
                            { label: "Distributed", value: summary.distributed },
                            { label: "Redeemed", value: summary.redeemed },
                            { label: "Remaining", value: summary.remaining },
                        ].map((s) => (
                            <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-center">
                                <p className="text-lg font-black text-stone-100">{s.value}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card title="Generate Pool" sub="Define the actual six physical-wheel rewards and how many codes to generate for each">
                <div className="space-y-2">
                    {tiers.map((t, i) => (
                        <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            <input value={t.label} onChange={(e) => updateTier(i, { label: e.target.value })} className={inputClass} placeholder="Reward label" />
                            <select value={t.discountType} onChange={(e) => updateTier(i, { discountType: e.target.value as "FIXED" | "PERCENTAGE" | "FREE_DELIVERY" })} className={inputClass}>
                                <option value="FIXED">Fixed (₹)</option>
                                <option value="PERCENTAGE">Percentage (%)</option>
                                <option value="FREE_DELIVERY">Free Delivery</option>
                            </select>
                            <input type="number" value={t.discountValue} onChange={(e) => updateTier(i, { discountValue: e.target.value })} className={inputClass} placeholder="Value" />
                            <input type="number" value={t.quantity} onChange={(e) => updateTier(i, { quantity: e.target.value })} className={inputClass} placeholder="Quantity" />
                            <button onClick={() => removeTier(i)} className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[11px] font-bold text-stone-400 hover:bg-white/[0.05]">Remove</button>
                        </div>
                    ))}
                    <button onClick={addTier} className="text-[12px] font-bold text-amber-400 hover:text-amber-300">+ Add reward tier</button>
                </div>
                <Field label="Expires (days from generation)">
                    <input type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} className={inputClass} min={1} />
                </Field>
                <button
                    onClick={handleGenerate}
                    disabled={generating || !campaignId}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
                >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate Pool
                </button>
            </Card>

            <Card title="Mark Distributed" sub="Flips the oldest N still-GENERATED coupons for this campaign to DISTRIBUTED">
                <div className="flex items-end gap-2">
                    <Field label="Quantity">
                        <input type="number" value={distributeQty} onChange={(e) => setDistributeQty(e.target.value)} className={inputClass} min={1} />
                    </Field>
                    <button onClick={handleMarkDistributed} disabled={!campaignId} className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[13px] font-bold text-stone-300 hover:bg-white/[0.05] disabled:opacity-50">
                        Mark Distributed
                    </button>
                </div>
            </Card>

            <Card title="Pool" sub={campaignId ? "Latest 50 coupons for this campaign" : "Select a campaign to view its pool"}>
                <div className="flex justify-end">
                    {campaignId && (
                        <a href={`/api/admin/physical-coupons/export?campaignId=${campaignId}`} className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300">
                            <Download size={11} /> Export CSV
                        </a>
                    )}
                </div>
                {loadingList ? (
                    <Loader2 size={18} className="mx-auto animate-spin text-stone-500" />
                ) : coupons.length === 0 ? (
                    <p className="text-center text-[12px] text-stone-500">No coupons yet</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[12px]">
                            <thead>
                                <tr className="border-b border-white/[0.06] text-stone-500">
                                    <th className="py-2 pr-3 font-bold">Code</th>
                                    <th className="py-2 pr-3 font-bold">Reward</th>
                                    <th className="py-2 pr-3 font-bold">Distribution</th>
                                    <th className="py-2 font-bold">Expires</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coupons.map((c) => (
                                    <tr key={c._id} className="border-b border-white/[0.03] text-stone-300">
                                        <td className="py-2 pr-3 font-mono font-bold text-stone-100">{c.code}</td>
                                        <td className="py-2 pr-3">{c.physicalRewardLabel}</td>
                                        <td className="py-2 pr-3">{c.physicalStatus}</td>
                                        <td className="py-2 text-stone-500">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
