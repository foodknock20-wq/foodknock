"use client";

// src/components/admin/AdminShell.tsx
// Admin UI shell — FoodKnock
// Extracted from layout.tsx so layout can be a server component (auth guard).

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar  from "@/components/admin/AdminTopbar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Phase 15B: lock background scroll while the mobile drawer is open —
    // without this, the page content underneath the backdrop could still
    // scroll, which reads as a broken/leaky overlay on touch devices.
    useEffect(() => {
        if (!sidebarOpen) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = original; };
    }, [sidebarOpen]);

    return (
        // Phase 15E.5: `fixed inset-0` instead of `h-screen` (static 100vh).
        // ROOT CAUSE of the bottom cream/white gap: the root layout
        // (src/app/layout.tsx) wraps EVERY route — including /admin — in a
        // `pb-[62px+safe-area] lg:pb-0` div reserved for the customer-only
        // mobile BottomNav (which only ever mounts via <Navbar> on (main)
        // pages — AdminShell never renders it). On mobile widths that left
        // ~62px+ of real, scrollable body height below this shell, exposing
        // <body>'s cream (#FFFBF5) background. `h-screen` also only tracks a
        // STATIC 100vh, not the mobile browser's dynamically resizing
        // toolbar. `fixed inset-0` removes this element from the body's
        // normal flow entirely (so that inherited padding can no longer
        // extend body's scrollable height) and is continuously resized by
        // the browser against the live visual viewport — no vh/dvh unit
        // involved, so mobile toolbar show/hide can't create a gap either.
        // Contrast audit root cause: this wrapper set the dark admin
        // BACKGROUND but never set a base text color. src/app/globals.css's
        // `body { color: #292524 }` is the CUSTOMER light-theme foreground —
        // any admin element that forgets its own explicit text-color class
        // was silently inheriting that near-black color on top of this
        // near-black background (an "inherited foreground resolves to a
        // dark shade" bug, invisible in code review since every affected
        // element LOOKS fine — it's just missing a class). `text-stone-200`
        // matches ADMIN_TEXT (src/lib/adminUi.ts) so anything that already
        // sets its own color is completely unaffected (an element's own
        // class always wins over an inherited one); this only fixes
        // elements that had no color of their own.
        <div className="fixed inset-0 flex overflow-hidden bg-[#09090f] text-stone-200">

            {/* Sidebar */}
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <AdminTopbar onMenuClick={() => setSidebarOpen((o) => !o)} />

                <main className="flex-1 overflow-y-auto">
                    {/* Subtle top ambient glow for depth */}
                    <div
                        className="pointer-events-none sticky top-0 z-10 h-px w-full opacity-30"
                        style={{ background: "linear-gradient(90deg, transparent 10%, #f97316 40%, #fbbf24 60%, transparent 90%)" }}
                        aria-hidden="true"
                    />
                    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}