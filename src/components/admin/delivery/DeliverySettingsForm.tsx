"use client";

// src/components/admin/delivery/DeliverySettingsForm.tsx
//
// Phase 10 — each section (Kitchen / Serviceability / Order Rules /
// Free Delivery / Distance Pricing) has its own independent "Save" so a
// mistake in one section can't block saving another, and so there's no
// giant cross-section form-state system to build/maintain (spec §31/§32:
// "do not overengineer"). Every PATCH goes to the same
// /api/admin/delivery-settings route — the server validates everything
// (radius > 0, non-overlapping ranges, lat/lng bounds, etc.), this
// component never duplicates that validation, only surfaces the result.

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Save, Plus, Trash2, MapPin, TestTube2 } from "lucide-react";
import type { DeliverySettingsData, DistanceRule } from "@/lib/deliverySettings";

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveButton({ state, onClick, label = "Save" }: { state: SaveState; onClick: () => void; label?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={state === "saving"}
            className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] font-bold text-amber-400 transition-all hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {state === "saving" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : label}
        </button>
    );
}

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

// Phase 10B: confirmed root cause of a reported "1.15km when it should be
// ~0.05km" distance bug — the stored kitchen latitude had only 1 decimal
// place (27.3). At this latitude, 0.01° ≈ 1.11km, so a coordinate rounded
// to too few decimals can be off by more than a km even though nothing in
// the Haversine calculation itself is wrong. 4 decimal places ≈ 11m of
// precision — a reasonable floor for a delivery-radius use case.
function decimalPlaces(n: number): number {
    const s = String(n);
    const i = s.indexOf(".");
    return i === -1 ? 0 : s.length - i - 1;
}
function isLowPrecision(n: number | null): boolean {
    return n !== null && decimalPlaces(n) < 4;
}

const inputClass =
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-stone-100 outline-none transition-colors focus:border-amber-400/50 focus:bg-white/[0.05]";

async function patchSettings(patch: Record<string, unknown>): Promise<DeliverySettingsData> {
    const res = await fetch("/api/admin/delivery-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Failed to save");
    return data.settings as DeliverySettingsData;
}

export default function DeliverySettingsForm({ initialSettings }: { initialSettings: DeliverySettingsData }) {
    const [settings, setSettings] = useState(initialSettings);

    // ── Kitchen ────────────────────────────────────────────────────────────
    const [kitchen, setKitchen] = useState(settings.kitchen);
    const [kitchenSave, setKitchenSave] = useState<SaveState>("idle");

    async function saveKitchen() {
        setKitchenSave("saving");
        try {
            const updated = await patchSettings({ kitchen });
            setSettings(updated);
            setKitchen(updated.kitchen);
            setKitchenSave("saved");
            toast.success("Kitchen settings saved");
        } catch (err) {
            setKitchenSave("error");
            toast.error(err instanceof Error ? err.message : "Couldn't save — try again");
        } finally {
            setTimeout(() => setKitchenSave("idle"), 2000);
        }
    }

    // ── Serviceability ───────────────────────────────────────────────────
    const [radius, setRadius] = useState(settings.serviceability.maxRadiusKm);
    const [radiusSave, setRadiusSave] = useState<SaveState>("idle");

    async function saveRadius() {
        setRadiusSave("saving");
        try {
            const updated = await patchSettings({ serviceability: { maxRadiusKm: radius } });
            setSettings(updated);
            setRadiusSave("saved");
            toast.success("Serviceability radius saved");
        } catch (err) {
            setRadiusSave("error");
            toast.error(err instanceof Error ? err.message : "Couldn't save — try again");
        } finally {
            setTimeout(() => setRadiusSave("idle"), 2000);
        }
    }

    // ── Order Rules ───────────────────────────────────────────────────────
    const [minOrder, setMinOrder] = useState(settings.orderRules.minimumOrderValue);
    const [minOrderSave, setMinOrderSave] = useState<SaveState>("idle");

    async function saveMinOrder() {
        setMinOrderSave("saving");
        try {
            const updated = await patchSettings({ orderRules: { minimumOrderValue: minOrder } });
            setSettings(updated);
            setMinOrderSave("saved");
            toast.success("Minimum order value saved");
        } catch (err) {
            setMinOrderSave("error");
            toast.error(err instanceof Error ? err.message : "Couldn't save — try again");
        } finally {
            setTimeout(() => setMinOrderSave("idle"), 2000);
        }
    }

    // ── Free Delivery ─────────────────────────────────────────────────────
    const [freeDelivery, setFreeDelivery] = useState(settings.freeDelivery);
    const [freeSave, setFreeSave] = useState<SaveState>("idle");

    async function saveFreeDelivery() {
        setFreeSave("saving");
        try {
            const updated = await patchSettings({ freeDelivery });
            setSettings(updated);
            setFreeDelivery(updated.freeDelivery);
            setFreeSave("saved");
            toast.success("Free delivery rules saved");
        } catch (err) {
            setFreeSave("error");
            toast.error(err instanceof Error ? err.message : "Couldn't save — try again");
        } finally {
            setTimeout(() => setFreeSave("idle"), 2000);
        }
    }

    // ── Distance Pricing ──────────────────────────────────────────────────
    const [rules, setRules] = useState<DistanceRule[]>(settings.distanceRules);
    const [rulesSave, setRulesSave] = useState<SaveState>("idle");

    function updateRule(index: number, patch: Partial<DistanceRule>) {
        setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    }
    function addRule() {
        const last = rules[rules.length - 1];
        setRules((prev) => [...prev, { fromKm: last?.toKm ?? 0, toKm: (last?.toKm ?? 0) + 5, fee: 0, active: true }]);
    }
    function removeRule(index: number) {
        setRules((prev) => prev.filter((_, i) => i !== index));
    }

    async function saveRules() {
        setRulesSave("saving");
        try {
            const updated = await patchSettings({ distanceRules: rules });
            setSettings(updated);
            setRules(updated.distanceRules);
            setRulesSave("saved");
            toast.success("Distance pricing saved");
        } catch (err) {
            setRulesSave("error");
            toast.error(err instanceof Error ? err.message : "Couldn't save — try again");
        } finally {
            setTimeout(() => setRulesSave("idle"), 2500);
        }
    }

    // ── Test Serviceability ───────────────────────────────────────────────
    const [testLat, setTestLat] = useState("");
    const [testLng, setTestLng] = useState("");
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        serviceable: boolean;
        distanceKm: number | null;
        deliveryFee: number;
        freeDelivery: boolean;
        reason: string | null;
    } | null>(null);

    async function runTest() {
        const latitude = Number(testLat);
        const longitude = Number(testLng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            toast.error("Enter valid latitude and longitude");
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch("/api/admin/delivery-settings/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ latitude, longitude }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Test failed");
            setTestResult(data.result);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Test failed");
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="space-y-5">
            {/* ── Kitchen ─────────────────────────────────────────────────── */}
            <Card title="Kitchen" sub="FoodKnock's single kitchen location — used as the origin for every distance calculation">
                <Field label="Kitchen Name">
                    <input className={inputClass} value={kitchen.name} onChange={(e) => setKitchen({ ...kitchen, name: e.target.value })} />
                </Field>
                <Field label="Kitchen Address">
                    <input className={inputClass} value={kitchen.address} onChange={(e) => setKitchen({ ...kitchen, address: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Latitude">
                        <input
                            className={inputClass} type="number" step="0.000001" placeholder="Not set"
                            value={kitchen.latitude ?? ""}
                            onChange={(e) => setKitchen({ ...kitchen, latitude: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                    </Field>
                    <Field label="Longitude">
                        <input
                            className={inputClass} type="number" step="0.000001" placeholder="Not set"
                            value={kitchen.longitude ?? ""}
                            onChange={(e) => setKitchen({ ...kitchen, longitude: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                    </Field>
                </div>
                {(kitchen.latitude === null || kitchen.longitude === null) && (
                    <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-300">
                        No kitchen coordinate is set — every checkout currently falls back to the old flat-rate delivery fee
                        and is treated as always serviceable. Enter the real coordinate above to activate distance-based
                        serviceability and pricing.
                    </p>
                )}
                {(isLowPrecision(kitchen.latitude) || isLowPrecision(kitchen.longitude)) && (
                    <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-[12px] text-rose-300">
                        ⚠ This coordinate has very few decimal places — a value like 27.3 can be off from the real
                        location by over a kilometre. Use a precise GPS reading (6 decimal places, e.g. 27.294521)
                        from a maps app or the admin&apos;s own device, not a rounded estimate.
                    </p>
                )}
                <label className="flex items-center gap-2 text-sm text-stone-300">
                    <input type="checkbox" checked={kitchen.active} onChange={(e) => setKitchen({ ...kitchen, active: e.target.checked })} />
                    Kitchen active (uncheck to mark the whole kitchen temporarily non-serviceable)
                </label>
                <SaveButton state={kitchenSave} onClick={saveKitchen} />
            </Card>

            {/* ── Serviceability ─────────────────────────────────────────── */}
            <Card title="Serviceability" sub="Maximum straight-line delivery radius from the kitchen">
                <Field label="Maximum Delivery Radius (KM)">
                    <input className={inputClass} type="number" step="0.1" min="0.1" value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
                </Field>
                <SaveButton state={radiusSave} onClick={saveRadius} />
            </Card>

            {/* ── Order Rules ─────────────────────────────────────────────── */}
            <Card title="Order Rules" sub="Minimum cart value required to place an order">
                <Field label="Minimum Order Value (₹)">
                    <input className={inputClass} type="number" min="0" value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))} />
                </Field>
                <SaveButton state={minOrderSave} onClick={saveMinOrder} />
            </Card>

            {/* ── Free Delivery ───────────────────────────────────────────── */}
            <Card title="Free Delivery" sub="Two independent conditions — either one zeroes the delivery fee">
                <label className="flex items-center gap-2 text-sm text-stone-300">
                    <input
                        type="checkbox" checked={freeDelivery.firstOrderFreeEnabled}
                        onChange={(e) => setFreeDelivery({ ...freeDelivery, firstOrderFreeEnabled: e.target.checked })}
                    />
                    Free delivery on customer&apos;s first order
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-300">
                    <input
                        type="checkbox" checked={freeDelivery.thresholdEnabled}
                        onChange={(e) => setFreeDelivery({ ...freeDelivery, thresholdEnabled: e.target.checked })}
                    />
                    Free delivery above a cart-value threshold
                </label>
                <Field label="Free Delivery Threshold (₹)">
                    <input
                        className={inputClass} type="number" min="0" disabled={!freeDelivery.thresholdEnabled}
                        value={freeDelivery.thresholdAmount}
                        onChange={(e) => setFreeDelivery({ ...freeDelivery, thresholdAmount: Number(e.target.value) })}
                    />
                </Field>
                <SaveButton state={freeSave} onClick={saveFreeDelivery} />
            </Card>

            {/* ── Distance Pricing ────────────────────────────────────────── */}
            <Card title="Distance-Based Delivery Fees" sub="Non-overlapping KM ranges, checked lowest-to-highest. Sample values — not final pricing.">
                <div className="space-y-2">
                    {rules.map((rule, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                            <input
                                className={`${inputClass} w-20`} type="number" step="0.1" min="0" value={rule.fromKm}
                                onChange={(e) => updateRule(i, { fromKm: Number(e.target.value) })} aria-label="From KM"
                            />
                            <span className="text-stone-500">–</span>
                            <input
                                className={`${inputClass} w-20`} type="number" step="0.1" min="0" value={rule.toKm}
                                onChange={(e) => updateRule(i, { toKm: Number(e.target.value) })} aria-label="To KM"
                            />
                            <span className="text-[12px] text-stone-500">km</span>
                            <span className="text-stone-600">·</span>
                            <span className="text-[12px] text-stone-500">₹</span>
                            <input
                                className={`${inputClass} w-20`} type="number" min="0" value={rule.fee}
                                onChange={(e) => updateRule(i, { fee: Number(e.target.value) })} aria-label="Fee"
                            />
                            <label className="ml-auto flex items-center gap-1.5 text-[12px] text-stone-400">
                                <input type="checkbox" checked={rule.active} onChange={(e) => updateRule(i, { active: e.target.checked })} />
                                Active
                            </label>
                            <button type="button" onClick={() => removeRule(i)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10" aria-label="Delete rule">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={addRule} className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2 text-[12px] font-bold text-stone-300 hover:bg-white/[0.05]">
                        <Plus size={13} /> Add Rule
                    </button>
                    <SaveButton state={rulesSave} onClick={saveRules} />
                </div>
            </Card>

            {/* ── Test Serviceability ──────────────────────────────────────── */}
            <Card title="Test Serviceability" sub="Enter any coordinate to preview exactly what a customer there would see">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Latitude">
                        <input className={inputClass} value={testLat} onChange={(e) => setTestLat(e.target.value)} placeholder="27.123456" />
                    </Field>
                    <Field label="Longitude">
                        <input className={inputClass} value={testLng} onChange={(e) => setTestLng(e.target.value)} placeholder="75.123456" />
                    </Field>
                </div>
                <button
                    type="button" onClick={runTest} disabled={testing}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-4 py-2 text-[13px] font-bold text-stone-200 hover:bg-white/[0.05] disabled:opacity-60"
                >
                    {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
                    {testing ? "Checking…" : "Run Test"}
                </button>
                {testResult && (
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-[13px] text-stone-200">
                        <p className="flex items-center gap-1.5 font-bold">
                            <MapPin size={13} className={testResult.serviceable ? "text-emerald-400" : "text-rose-400"} />
                            {testResult.serviceable ? "Serviceable" : "Not serviceable"}
                            {typeof testResult.distanceKm === "number" && ` — ${testResult.distanceKm} km`}
                        </p>
                        <p className="mt-1 text-stone-400">
                            Fee: {testResult.freeDelivery ? "FREE" : `₹${testResult.deliveryFee}`}
                            {testResult.reason ? ` · ${testResult.reason}` : ""}
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
}
