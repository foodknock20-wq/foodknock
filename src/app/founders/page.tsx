// src/app/founders/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import FoundersHero from "@/components/founders/FoundersHero";
import FounderCard from "@/components/founders/FounderCard";
import FounderDetailPanel from "@/components/founders/FounderDetailPanel";
import FoodknockStory from "@/components/founders/FoodknockStory";
import { founders } from "@/lib/foundersData";

export default function FoundersPage() {
    const [activeId, setActiveId] = useState<string | null>(null);
    const activeFounder = founders.find((f) => f.id === activeId) ?? null;

    const handleClose = useCallback(() => setActiveId(null), []);

    function handleSelect(id: string) {
        setActiveId(id);
    }

    // Escape key closes modal
    useEffect(() => {
        if (!activeFounder) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") handleClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [activeFounder, handleClose]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (activeFounder) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [activeFounder]);

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-[#FFFBF5] via-[#FFF9F0] to-[#FFF5E8]">
            {/* Ambient glows */}
            <div
                className="pointer-events-none fixed left-[10%] top-0 h-[500px] w-[500px] -translate-y-1/2 rounded-full opacity-[0.08] blur-3xl"
                style={{ background: "radial-gradient(circle, #FF5C1A, transparent 70%)" }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none fixed bottom-0 right-[15%] h-[400px] w-[400px] translate-y-1/2 rounded-full opacity-[0.06] blur-3xl"
                style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }}
                aria-hidden="true"
            />

            <Navbar />

            <div className="relative z-10">
                <FoundersHero />
            </div>

            {/* Founder cards grid */}
            <section className="relative z-10 px-4 pb-20 md:px-8">
                <div className="mx-auto max-w-7xl">
                    <div className="grid gap-5 sm:grid-cols-3">
                        {founders.map((founder) => (
                            <FounderCard
                                key={founder.id}
                                founder={founder}
                                isActive={activeId === founder.id}
                                onClick={() => handleSelect(founder.id)}
                            />
                        ))}
                    </div>

                    <p className="mt-7 text-center text-[13px] font-medium text-gray-400">
                        Select a founder to view their full profile
                    </p>
                </div>
            </section>

            <div className="relative z-10">
                <FoodknockStory />
            </div>

            <Footer />

            {/* Modal overlay */}
            {activeFounder && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        style={{
                            background: "rgba(20, 10, 5, 0.55)",
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                            animation: "backdropIn 0.3s ease both",
                        }}
                        onClick={handleClose}
                        aria-hidden="true"
                    />

                    {/* Modal container */}
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${activeFounder.name} profile`}
                    >
                        <div
                            className="relative w-full max-w-4xl"
                            style={{
                                maxHeight: "calc(100dvh - 2rem)",
                                animation: "modalIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) both",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <FounderDetailPanel
                                founder={activeFounder}
                                onClose={handleClose}
                            />
                        </div>
                    </div>

                    <style>{`
                        @keyframes backdropIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes modalIn {
                            from { opacity: 0; transform: translateY(24px) scale(0.96); }
                            to { opacity: 1; transform: translateY(0) scale(1); }
                        }
                    `}</style>
                </>
            )}
        </div>
    );
}