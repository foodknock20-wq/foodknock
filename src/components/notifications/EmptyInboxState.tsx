"use client";

// src/components/notifications/EmptyInboxState.tsx
//
// UI REDESIGN: larger, more premium illustration + copy matching the
// design brief ("No notifications yet" / helpful description / Explore
// Menu CTA), still zero props, zero logic — purely presentational.

import Link from "next/link";
import { motion } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";

export default function EmptyInboxState() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex flex-col items-center px-6 py-20 text-center"
        >
            <div className="relative mb-7">
                <div
                    className="absolute inset-0 -m-4 rounded-full opacity-60 blur-2xl"
                    style={{ background: "radial-gradient(circle, #FFB347, transparent 70%)" }}
                    aria-hidden="true"
                />
                <svg
                    width="132"
                    height="132"
                    viewBox="0 0 120 120"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    className="relative"
                >
                    <circle cx="60" cy="62" r="46" fill="#FFF3E8" />
                    <path
                        d="M60 32c-12 0-20 9.5-20 22v9c0 3-1.5 5.7-4 8l-2 2h52l-2-2c-2.5-2.3-4-5-4-8v-9c0-12.5-8-22-20-22Z"
                        fill="url(#bellGradientEmpty)"
                    />
                    <path d="M52 81a8 8 0 0 0 16 0H52Z" fill="#C2410C" />
                    <path
                        d="M88 38l2.4 5.6L96 46l-5.6 2.4L88 54l-2.4-5.6L80 46l5.6-2.4L88 38Z"
                        fill="#FF5C1A"
                    />
                    <defs>
                        <linearGradient id="bellGradientEmpty" x1="40" y1="32" x2="80" y2="81" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#FF8C42" />
                            <stop offset="1" stopColor="#FF5C1A" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            <h2
                className="text-[22px] font-black text-stone-900"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
                No notifications yet
            </h2>
            <p className="mt-2.5 max-w-[300px] text-[14px] leading-relaxed text-stone-500">
                We&apos;ll let you know the moment your order moves — placed, prepped, on the way, delivered — plus rewards and offers as they land.
            </p>

            <Link
                href="/menu"
                className="mt-7 flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-[13.5px] font-black text-white shadow-lg shadow-orange-200 transition-all hover:brightness-110 active:scale-[0.97]"
            >
                <UtensilsCrossed size={15} strokeWidth={2.5} />
                Explore Menu
            </Link>
        </motion.div>
    );
}