"use client";

// src/components/admin/users/ExportUsersButton.tsx
// Fetches all active users (name + phone) from the admin-only API,
// shows them in a modal, and lets the admin copy or download as CSV.

import { useState } from "react";
import { toast }    from "react-hot-toast";
import {
    Download, X, Loader2, Users,
    Copy, CheckCheck, PhoneCall,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type UserContact = { name: string; phone: string };

type FetchState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; users: UserContact[] }
    | { status: "error"; message: string };

// ── Helpers ────────────────────────────────────────────────────────────────
function toCSV(users: UserContact[]): string {
    const header = "Name,Phone";
    const rows   = users.map(
        (u) => `"${u.name.replace(/"/g, '""')}","${u.phone}"`
    );
    return [header, ...rows].join("\n");
}

function downloadCSV(users: UserContact[]) {
    const blob = new Blob([toCSV(users)], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `foodknock-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ExportUsersButton() {
    const [state,    setState]    = useState<FetchState>({ status: "idle" });
    const [open,     setOpen]     = useState(false);
    const [copied,   setCopied]   = useState(false);
    const [search,   setSearch]   = useState("");

    // ── Fetch ──────────────────────────────────────────────────────────────
    async function handleFetch() {
        setState({ status: "loading" });
        setOpen(true);

        try {
            const res  = await fetch("/api/admin/users/export");
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message ?? "Failed to load users");
            }

            setState({ status: "success", users: data.users });
        } catch (err: any) {
            const message = err.message ?? "Something went wrong";
            setState({ status: "error", message });
            toast.error(message);
        }
    }

    // ── Copy all to clipboard ──────────────────────────────────────────────
    async function handleCopy() {
        if (state.status !== "success") return;
        const text = state.users
            .map((u) => `${u.name} — ${u.phone}`)
            .join("\n");
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    }

    // ── Close & reset ──────────────────────────────────────────────────────
    function handleClose() {
        setOpen(false);
        setSearch("");
        // Keep state so re-open is instant; reset only on fresh fetch
    }

    // ── Filtered list ──────────────────────────────────────────────────────
    const filtered =
        state.status === "success"
            ? state.users.filter(
                  (u) =>
                      u.name.toLowerCase().includes(search.toLowerCase()) ||
                      u.phone.includes(search)
              )
            : [];

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <>
            {/* Trigger button */}
            <button
                onClick={handleFetch}
                disabled={state.status === "loading"}
                className="
                    inline-flex items-center gap-2 rounded-xl
                    border border-amber-500/25 bg-amber-500/10
                    px-4 py-2 text-sm font-semibold text-amber-400
                    transition-all hover:bg-amber-500/20 hover:border-amber-500/40
                    disabled:cursor-not-allowed disabled:opacity-50
                "
            >
                {state.status === "loading" ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : (
                    <PhoneCall size={14} />
                )}
                {state.status === "loading" ? "Loading…" : "Export User Contacts"}
            </button>

            {/* Modal */}
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    onClick={(e) => e.target === e.currentTarget && handleClose()}
                >
                    <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e14] shadow-2xl">

                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                                    <Users size={15} className="text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">User Contacts</p>
                                    {state.status === "success" && (
                                        <p className="text-[10px] text-stone-500">
                                            {state.users.length} active user{state.users.length !== 1 ? "s" : ""}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-white/[0.05] hover:text-stone-300"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex flex-col gap-3 p-5">

                            {/* Loading */}
                            {state.status === "loading" && (
                                <div className="flex flex-col items-center gap-3 py-12 text-stone-500">
                                    <Loader2 size={28} className="animate-spin text-amber-400" />
                                    <p className="text-sm">Fetching user contacts…</p>
                                </div>
                            )}

                            {/* Error */}
                            {state.status === "error" && (
                                <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-400">
                                    {state.message}
                                </div>
                            )}

                            {/* Success */}
                            {state.status === "success" && (
                                <>
                                    {/* Search */}
                                    <input
                                        type="text"
                                        placeholder="Search name or phone…"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="
                                            w-full rounded-xl border border-white/[0.07]
                                            bg-white/[0.03] px-3 py-2 text-sm text-stone-300
                                            placeholder:text-stone-600 outline-none
                                            focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20
                                        "
                                    />

                                    {/* List */}
                                    <div className="max-h-72 overflow-y-auto rounded-xl border border-white/[0.06]">
                                        {filtered.length === 0 ? (
                                            <p className="py-6 text-center text-sm text-stone-600">
                                                No users match your search.
                                            </p>
                                        ) : (
                                            <ul className="divide-y divide-white/[0.04]">
                                                {filtered.map((u, i) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02]"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-[10px] font-black text-amber-300 ring-1 ring-amber-500/15">
                                                                {u.name.trim()[0]?.toUpperCase() ?? "?"}
                                                            </div>
                                                            <span className="text-sm font-medium text-stone-200">
                                                                {u.name}
                                                            </span>
                                                        </div>
                                                        <span className="font-mono text-xs text-stone-400">
                                                            {u.phone}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={handleCopy}
                                            className="
                                                flex flex-1 items-center justify-center gap-2
                                                rounded-xl border border-white/[0.07] bg-white/[0.03]
                                                py-2 text-sm font-semibold text-stone-300
                                                transition-colors hover:bg-white/[0.07] hover:text-white
                                            "
                                        >
                                            {copied ? (
                                                <><CheckCheck size={14} className="text-emerald-400" /> Copied!</>
                                            ) : (
                                                <><Copy size={14} /> Copy All</>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => downloadCSV(state.users)}
                                            className="
                                                flex flex-1 items-center justify-center gap-2
                                                rounded-xl border border-amber-500/25 bg-amber-500/10
                                                py-2 text-sm font-semibold text-amber-400
                                                transition-colors hover:bg-amber-500/20
                                            "
                                        >
                                            <Download size={14} /> Download CSV
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
