"use client";

// src/components/account/ProfileForm.tsx
//
// Name/DOB edit only (Phase 9 scope decision — email/phone are read-only
// this phase, no re-verification flow exists for post-signup changes).
// Talks to PATCH /api/auth/me.

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Mail, Phone, BadgeCheck, Save } from "lucide-react";
import { useAccountUser } from "@/components/account/AccountContext";
import { validateFullName } from "@/lib/validation/name";

function toDateInputValue(iso: string | null): string {
    if (!iso) return "";
    return iso.slice(0, 10);
}

export default function ProfileForm() {
    const user = useAccountUser();
    const [name, setName] = useState(user.name);
    const [dob, setDob] = useState(toDateInputValue(user.dob));
    const [saving, setSaving] = useState(false);

    const dirty = name.trim() !== user.name || dob !== toDateInputValue(user.dob);

    async function handleSave() {
        // Customer Identity Validation Repair — only hold the name to the
        // new, stricter rule (>= 7 chars, contains a letter) when it's
        // being VOLUNTARILY changed. A name left exactly as stored (e.g. an
        // existing customer's legacy short name like "Amit") must keep
        // saving fine when only the DOB field changed.
        const nameChanged = name.trim() !== user.name;
        if (nameChanged) {
            const nameResult = validateFullName(name);
            if (!nameResult.ok) {
                toast.error(nameResult.message);
                return;
            }
        } else if (!name.trim()) {
            toast.error("Name cannot be empty");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/auth/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name: name.trim(), dob: dob || null }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || "Failed to update");
            toast.success("Profile updated");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't update — try again");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-5">
            <div className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-4">
                <label className="text-[11px] font-bold uppercase tracking-wide text-fk-text-tertiary">Full name</label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    className="mt-1.5 w-full rounded-fk-md border border-fk-border bg-fk-surface-interactive px-3.5 py-2.5 text-[15px] font-semibold text-fk-text outline-none focus:border-[var(--fk-accent)] focus:bg-fk-surface-elevated"
                />

                <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                    Date of birth
                </label>
                <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="mt-1.5 w-full rounded-fk-md border border-fk-border bg-fk-surface-interactive px-3.5 py-2.5 text-[15px] font-semibold text-fk-text outline-none focus:border-[var(--fk-accent)] focus:bg-fk-surface-elevated"
                />

                <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-fk-md bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
                >
                    <Save size={15} strokeWidth={2.5} />
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>

            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated">
                <p className="px-4 pt-3.5 text-[11px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                    Contact details
                </p>
                <div className="flex items-center gap-3 border-b border-fk-border px-4 py-3.5">
                    <Mail size={16} className="text-fk-text-tertiary" />
                    <div className="flex-1">
                        <p className="text-[14px] font-semibold text-fk-text">{user.email}</p>
                        <p className="text-[11px] text-fk-text-tertiary">Email — contact support to change</p>
                    </div>
                    <BadgeCheck size={16} className="text-fk-success" />
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5">
                    <Phone size={16} className="text-fk-text-tertiary" />
                    <div className="flex-1">
                        <p className="text-[14px] font-semibold text-fk-text">{user.phone || "—"}</p>
                        <p className="text-[11px] text-fk-text-tertiary">Phone — contact support to change</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
