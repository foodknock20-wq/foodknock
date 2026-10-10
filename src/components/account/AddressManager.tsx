"use client";

// src/components/account/AddressManager.tsx
//
// Add/edit/delete/set-default for the caller's own saved addresses.
// Talks to /api/users/me/addresses (+ /[addressId]) — the server enforces
// the max-10 cap and the single-default invariant; this component just
// reflects whatever the server returns after each mutation rather than
// computing those invariants itself.
//
// PHASE 10B FIX: this form previously had no way to attach lat/lng to an
// address at all — confirmed by inspecting production data, every address
// created through this form has lat:null, lng:null, making it unusable for
// Phase 10 serviceability. Added a "Use current location" capture (GPS +
// free reverse-geocoding for address-text assistance only — coordinates
// remain authoritative regardless of whether the lookup succeeds) and a
// visible "no location set" warning on existing addresses so a customer
// can self-correct an old address like the one found in production.

import { useState } from "react";
import { toast } from "react-hot-toast";
import { MapPin, Plus, Pencil, Trash2, Star, X, Check, Navigation, Loader2, AlertTriangle } from "lucide-react";
import type { ShapedAddress } from "@/lib/addresses";
import MapPinPicker from "@/components/shared/MapPinPicker";

type FormState = {
    label: string;
    flatNo: string;
    addressLine: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    landmark: string;
    deliveryInstructions: string;
    lat: number | null;
    lng: number | null;
};

const EMPTY_FORM: FormState = {
    label: "", flatNo: "", addressLine: "", locality: "",
    city: "", state: "", pincode: "", landmark: "", deliveryInstructions: "",
    lat: null, lng: null,
};

const fieldClass = "w-full rounded-fk-md border border-fk-border bg-fk-surface-interactive px-3 py-2.5 text-[13px] text-fk-text outline-none transition-colors focus:border-[var(--fk-accent)] focus:bg-fk-surface-elevated";

export default function AddressManager({ initialAddresses }: { initialAddresses: ShapedAddress[] }) {
    const [addresses, setAddresses] = useState<ShapedAddress[]>(initialAddresses);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [locating, setLocating] = useState(false);
    const [pinPickerOpen, setPinPickerOpen] = useState(false);

    function startAdd() {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setAdding(true);
    }

    function startEdit(a: ShapedAddress) {
        setForm({
            label: a.label, flatNo: a.flatNo, addressLine: a.addressLine,
            locality: a.locality, city: a.city, state: a.state, pincode: a.pincode,
            landmark: a.landmark, deliveryInstructions: a.deliveryInstructions,
            lat: a.lat, lng: a.lng,
        });
        setEditingId(a._id);
        setAdding(false);
    }

    function cancelForm() {
        setAdding(false);
        setEditingId(null);
    }

    // GPS -> reverse geocode -> prefill. Coordinates are captured either
    // way (authoritative); reverse-geocoded text fields are filled only
    // when currently empty, never clobbering what the customer already typed.
    function handleUseCurrentLocation() {
        if (!navigator.geolocation) {
            toast.error("Your browser doesn't support location detection. Please enter the address manually.");
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                setForm((p) => ({ ...p, lat, lng }));
                try {
                    const res = await fetch("/api/location/reverse-geocode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ latitude: lat, longitude: lng }),
                    });
                    const data = await res.json();
                    setForm((p) => ({
                        ...p,
                        locality: p.locality || data?.locality || "",
                        city: p.city || data?.city || "",
                        state: p.state || data?.state || "",
                        pincode: p.pincode || data?.pincode || "",
                    }));
                } catch { /* best-effort — coordinates are already captured */ }
                setLocating(false);
                toast.success("Location captured");
            },
            (err) => {
                setLocating(false);
                toast.error(
                    err.code === err.PERMISSION_DENIED
                        ? "Location permission was denied. You can still save this address without it."
                        : "Couldn't detect your location. You can still save this address without it."
                );
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
        );
    }

    async function handleSubmit() {
        if (!form.addressLine.trim() || !form.city.trim() || !form.state.trim() || !/^\d{6}$/.test(form.pincode)) {
            toast.error("Address line, city, state and a 6-digit pincode are required");
            return;
        }
        setBusy(true);
        try {
            const url = editingId ? `/api/users/me/addresses/${editingId}` : "/api/users/me/addresses";
            const res = await fetch(url, {
                method: editingId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Failed to save address");
            setAddresses(data.addresses);
            toast.success(editingId ? "Address updated" : "Address added");
            cancelForm();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete(id: string) {
        setBusy(true);
        try {
            const res = await fetch(`/api/users/me/addresses/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Failed to delete address");
            setAddresses(data.addresses);
            toast.success("Address removed");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    async function handleSetDefault(id: string) {
        setBusy(true);
        try {
            const res = await fetch(`/api/users/me/addresses/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ isDefault: true }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Failed to set default");
            setAddresses(data.addresses);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    const showForm = adding || editingId !== null;

    return (
        <div className="space-y-4">
            {addresses.length === 0 && !showForm && (
                <div className="rounded-fk-lg border border-dashed border-fk-border bg-fk-surface-elevated p-8 text-center">
                    <MapPin size={28} className="mx-auto text-fk-text-tertiary" />
                    <p className="mt-2 text-sm font-semibold text-fk-text-secondary">No saved addresses yet</p>
                </div>
            )}

            {!showForm && addresses.map((a) => (
                <div key={a._id} className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-surface-selected">
                            <MapPin size={16} className="text-[var(--fk-accent)]" strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-[14px] font-bold text-fk-text">{a.label || "Address"}</p>
                                {a.isDefault && (
                                    <span className="rounded-fk-pill bg-fk-success/15 px-2 py-0.5 text-[10px] font-bold text-fk-success">
                                        Default
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 text-[13px] text-fk-text-secondary">
                                {[a.flatNo, a.addressLine, a.locality, a.city, a.state, a.pincode]
                                    .filter(Boolean)
                                    .join(", ")}
                            </p>
                            {a.landmark && <p className="text-[12px] text-fk-text-tertiary">Landmark: {a.landmark}</p>}
                            {a.deliveryInstructions && <p className="text-[12px] text-fk-text-tertiary">Note: {a.deliveryInstructions}</p>}
                            {(a.lat === null || a.lng === null) && (
                                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-fk-gold">
                                    <AlertTriangle size={11} /> No location set — edit to add, so we can calculate delivery accurately
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {!a.isDefault && (
                            <button
                                onClick={() => handleSetDefault(a._id)}
                                disabled={busy}
                                className="flex items-center gap-1 rounded-fk-sm border border-fk-border px-2.5 py-1.5 text-[12px] font-semibold text-fk-text-secondary disabled:opacity-50"
                            >
                                <Star size={12} /> Set default
                            </button>
                        )}
                        <button
                            onClick={() => startEdit(a)}
                            disabled={busy}
                            className="flex items-center gap-1 rounded-fk-sm border border-fk-border px-2.5 py-1.5 text-[12px] font-semibold text-fk-text-secondary disabled:opacity-50"
                        >
                            <Pencil size={12} /> Edit
                        </button>
                        <button
                            onClick={() => handleDelete(a._id)}
                            disabled={busy}
                            className="flex items-center gap-1 rounded-fk-sm border border-fk-danger/30 px-2.5 py-1.5 text-[12px] font-semibold text-fk-danger disabled:opacity-50"
                        >
                            <Trash2 size={12} /> Delete
                        </button>
                    </div>
                </div>
            ))}

            {showForm ? (
                <div className="rounded-fk-lg border border-[var(--fk-accent)]/30 bg-fk-surface-elevated p-4">
                    <div className="mb-3 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            disabled={locating}
                            className="flex items-center justify-center gap-2 rounded-fk-md border border-[var(--fk-accent)]/30 bg-fk-surface-selected py-2.5 text-[13px] font-bold text-[var(--fk-accent)] transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                            {locating ? "Detecting…" : "Use current location"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPinPickerOpen(true)}
                            className="flex items-center justify-center gap-2 rounded-fk-md border border-fk-border bg-fk-surface-interactive py-2.5 text-[13px] font-bold text-fk-text-secondary transition-colors hover:bg-fk-surface-selected"
                        >
                            <MapPin size={14} /> Pin on map
                        </button>
                    </div>
                    {/* Phase 10 — free map-pin fallback: doesn't require GPS permission at all. */}
                    <MapPinPicker
                        open={pinPickerOpen}
                        onClose={() => setPinPickerOpen(false)}
                        onConfirm={(lat, lng) => {
                            setForm((p) => ({ ...p, lat, lng }));
                            setPinPickerOpen(false);
                            toast.success("Location pinned");
                        }}
                        initialLat={form.lat}
                        initialLng={form.lng}
                    />
                    {form.lat !== null && form.lng !== null && (
                        <p className="mb-3 flex items-center gap-1 text-[11px] font-semibold text-fk-success">
                            <Check size={12} /> Location attached to this address
                        </p>
                    )}

                    {/* Mobile-first: single column, two-up only from sm: up */}
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <input placeholder="Label (Home, Work…)" value={form.label}
                            onChange={(e) => setForm({ ...form, label: e.target.value })}
                            className={`${fieldClass} sm:col-span-2`} />
                        <input placeholder="Flat / House No." value={form.flatNo}
                            onChange={(e) => setForm({ ...form, flatNo: e.target.value })}
                            className={fieldClass} />
                        <input placeholder="Locality / Area / Village" value={form.locality}
                            onChange={(e) => setForm({ ...form, locality: e.target.value })}
                            className={fieldClass} />
                        <input placeholder="Address line *" value={form.addressLine}
                            onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
                            className={`${fieldClass} sm:col-span-2`} />
                        <input placeholder="City *" value={form.city}
                            onChange={(e) => setForm({ ...form, city: e.target.value })}
                            className={fieldClass} />
                        <input placeholder="State *" value={form.state}
                            onChange={(e) => setForm({ ...form, state: e.target.value })}
                            className={fieldClass} />
                        <input placeholder="Pincode *" value={form.pincode} maxLength={6}
                            onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "") })}
                            className={fieldClass} />
                        <input placeholder="Landmark" value={form.landmark}
                            onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                            className={fieldClass} />
                        <input placeholder="Delivery instructions — e.g. call on arrival, gate no., floor" value={form.deliveryInstructions}
                            onChange={(e) => setForm({ ...form, deliveryInstructions: e.target.value })}
                            className={`${fieldClass} sm:col-span-2`} />
                    </div>

                    {/* Sticky within the card so Save/Cancel are always
                        reachable regardless of form height or viewport. */}
                    <div className="sticky bottom-0 mt-3 flex gap-2 bg-fk-surface-elevated pt-1">
                        <button
                            onClick={handleSubmit}
                            disabled={busy}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                        >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {busy ? "Saving…" : editingId ? "Save" : "Add address"}
                        </button>
                        <button
                            onClick={cancelForm}
                            disabled={busy}
                            className="flex items-center justify-center gap-1.5 rounded-fk-md border border-fk-border px-4 py-2.5 text-[13px] font-semibold text-fk-text-secondary"
                        >
                            <X size={14} /> Cancel
                        </button>
                    </div>
                </div>
            ) : (
                addresses.length < 10 && (
                    <button
                        onClick={startAdd}
                        className="flex w-full items-center justify-center gap-1.5 rounded-fk-lg border border-dashed border-[var(--fk-accent)]/30 bg-fk-surface-selected py-3.5 text-[13px] font-bold text-[var(--fk-accent)]"
                    >
                        <Plus size={15} /> Add new address
                    </button>
                )
            )}
        </div>
    );
}
