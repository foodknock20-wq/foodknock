"use client";

// src/components/admin/AdminShell.tsx
// Admin UI shell — FoodKnock
// Extracted from layout.tsx so layout can be a server component (auth guard).

import { useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar  from "@/components/admin/AdminTopbar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-[#09090f]">

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