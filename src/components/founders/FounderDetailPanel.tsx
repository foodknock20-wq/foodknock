import { Instagram, Linkedin, X } from "lucide-react";
import type { Founder } from "@/lib/foundersData";

interface Props {
    founder: Founder;
    onClose: () => void;
}

export default function FounderDetailPanel({ founder, onClose }: Props) {
    return (
        <div
            id={`founder-panel-${founder.id}`}
            role="region"
            aria-label={`${founder.name} profile`}
            className="relative w-full overflow-hidden rounded-[28px] sm:rounded-[32px]"
            style={{
                background: "linear-gradient(145deg, #ffffff 0%, #fffcf5 40%, #fff8ed 100%)",
                border: `1.5px solid ${founder.color}35`,
                boxShadow: `0 32px 80px -16px ${founder.color}30, 0 16px 40px -12px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)`,
                // Scroll lives here — the whole modal scrolls on mobile
                maxHeight: "calc(100dvh - 2rem)",
                overflowY: "auto",
                overflowX: "hidden",
                // Custom scrollbar via inline vars for WebKit
                scrollbarWidth: "thin",
                scrollbarColor: `${founder.color}40 transparent`,
            }}
        >
            {/* WebKit scrollbar styles */}
            <style>{`
                #founder-panel-${founder.id}::-webkit-scrollbar {
                    width: 4px;
                }
                #founder-panel-${founder.id}::-webkit-scrollbar-track {
                    background: transparent;
                }
                #founder-panel-${founder.id}::-webkit-scrollbar-thumb {
                    background: ${founder.color}50;
                    border-radius: 99px;
                }
                #founder-panel-${founder.id}::-webkit-scrollbar-thumb:hover {
                    background: ${founder.color}80;
                }
            `}</style>

            {/* ── Top ambient glow strip ── */}
            <div
                className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-[3px] rounded-t-[32px]"
                style={{
                    background: `linear-gradient(90deg, transparent 5%, ${founder.color}80 30%, ${founder.colorAlt}70 70%, transparent 95%)`,
                }}
                aria-hidden="true"
            />

            {/* ── Ambient radial glow — top right ── */}
            <div
                className="pointer-events-none absolute right-0 top-0 h-[340px] w-[340px] translate-x-1/3 -translate-y-1/3 rounded-full opacity-[0.10] blur-3xl sm:h-[420px] sm:w-[420px]"
                style={{ background: `radial-gradient(circle, ${founder.color}, transparent 65%)` }}
                aria-hidden="true"
            />

            {/* ── Ambient radial glow — bottom left ── */}
            <div
                className="pointer-events-none absolute bottom-0 left-0 h-[220px] w-[220px] -translate-x-1/4 translate-y-1/3 rounded-full opacity-[0.06] blur-3xl sm:h-[300px] sm:w-[300px]"
                style={{ background: `radial-gradient(circle, ${founder.colorAlt}, transparent 65%)` }}
                aria-hidden="true"
            />

            {/* ── Close button ── */}
            <button
                onClick={onClose}
                aria-label="Close founder profile"
                className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-orange-100 bg-white/95 text-gray-400 shadow-md backdrop-blur-sm transition-all hover:border-orange-200 hover:bg-orange-50 hover:text-orange-500 active:scale-90 sm:right-5 sm:top-5 sm:h-9 sm:w-9"
                style={{ boxShadow: `0 2px 12px ${founder.color}25` }}
            >
                <X size={14} strokeWidth={2.5} />
            </button>

            {/* ── Content grid ── */}
            {/*
                Mobile  : single column, sidebar stacks above content
                Desktop : [260px sidebar] | [fluid right content]
            */}
            <div className="relative grid grid-cols-1 md:grid-cols-[260px_1fr]">

                {/* ════ LEFT SIDEBAR ════ */}
                <div
                    className="border-b p-6 sm:p-7 md:border-b-0 md:border-r"
                    style={{
                        background: "linear-gradient(160deg, rgba(255,251,245,0.95) 0%, rgba(255,247,235,0.65) 100%)",
                        borderColor: `${founder.color}20`,
                    }}
                >
                    {/* Avatar */}
                    <div
                        className="relative mb-5 h-28 w-28 overflow-hidden rounded-[18px] sm:mb-6 sm:h-36 sm:w-36 sm:rounded-[22px]"
                        style={{
                            border: `3px solid ${founder.color}60`,
                            boxShadow: `0 12px 36px -8px ${founder.color}45, 0 0 0 5px ${founder.color}10`,
                        }}
                    >
                        <img
                            src={founder.image}
                            alt={founder.name}
                            className="h-full w-full object-cover"
                        />
                        {/* Warm sheen overlay */}
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background: `linear-gradient(135deg, ${founder.color}0a, transparent 50%, rgba(0,0,0,0.04))`,
                            }}
                        />
                    </div>

                    {/* Co-founder label */}
                    <p
                        className="mb-1 text-[9px] font-black uppercase tracking-[0.35em]"
                        style={{ color: founder.color }}
                    >
                        ✦ Co-Founder
                    </p>

                    {/* Name */}
                    <h2
                        className="mb-1.5 text-[20px] font-black leading-tight tracking-tight text-gray-900 sm:text-[22px]"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                        {founder.name}
                    </h2>

                    {/* Role */}
                    <p className="mb-5 text-[12px] leading-relaxed text-gray-500 sm:mb-6 sm:text-[12.5px]">
                        {founder.role}
                    </p>

                    {/* Divider */}
                    <div
                        className="mb-4 h-px w-full sm:mb-5"
                        style={{ background: `linear-gradient(90deg, ${founder.color}30, transparent)` }}
                    />

                    {/* Expertise tags */}
                    <div className="mb-6 sm:mb-7">
                        <p className="mb-2.5 text-[9px] font-black uppercase tracking-[0.28em] text-gray-400">
                            Expertise
                        </p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {founder.expertise.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-full px-2.5 py-1 text-[10px] font-bold sm:px-3 sm:py-1.5 sm:text-[11px]"
                                    style={{
                                        background: `${founder.color}0e`,
                                        border: `1px solid ${founder.color}28`,
                                        color: founder.color,
                                        boxShadow: `0 1px 4px ${founder.color}10`,
                                    }}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Social CTA */}

                    <a href={founder.social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-wide text-white transition-all hover:brightness-105 hover:shadow-xl active:scale-[0.97] sm:gap-2.5 sm:px-5 sm:text-[12px]"
                        style={{
                            background: `linear-gradient(135deg, ${founder.color} 0%, ${founder.colorAlt} 100%)`,
                            boxShadow: `0 10px 28px -8px ${founder.color}60`,
                            letterSpacing: "0.06em",
                        }}
                    >
                        {founder.social.type === "instagram" ? (
                            <Instagram size={13} strokeWidth={2.5} />
                        ) : (
                            <Linkedin size={13} strokeWidth={2.5} />
                        )}
                        {founder.social.label}
                    </a>
                </div>
                {/* ════ END LEFT SIDEBAR ════ */}

                {/* ════ RIGHT CONTENT ════ */}
                <div className="flex flex-col gap-6 p-6 sm:gap-7 sm:p-7 md:p-8">

                    {/* About section */}
                    <div>
                        <p className="mb-3 text-[9px] font-black uppercase tracking-[0.35em] text-gray-400 sm:mb-4">
                            About {founder.name.split(" ")[0]}
                        </p>
                        <div className="space-y-3 sm:space-y-3.5">
                            {founder.bio.map((para, i) => (
                                <p
                                    key={i}
                                    className="text-[13px] leading-[1.85] text-gray-700 sm:text-[13.5px] sm:leading-[1.88]"
                                >
                                    {para}
                                </p>
                            ))}
                        </div>
                    </div>

                    {/* Quote block */}
                    <blockquote
                        className="relative overflow-hidden rounded-xl p-5 sm:rounded-2xl sm:p-6"
                        style={{
                            background: `linear-gradient(135deg, ${founder.color}0a 0%, ${founder.colorAlt}06 100%)`,
                            border: `1px solid ${founder.color}22`,
                            boxShadow: `inset 0 1px 0 ${founder.color}18`,
                        }}
                    >
                        {/* Decorative large quote mark */}
                        <span
                            className="pointer-events-none absolute right-3 top-0 select-none text-[60px] font-black leading-none opacity-[0.06] sm:right-4 sm:text-[72px]"
                            style={{ color: founder.color, fontFamily: "Georgia, serif" }}
                            aria-hidden="true"
                        >
                            "
                        </span>

                        {/* Left gradient accent bar */}
                        <div
                            className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl sm:rounded-l-2xl"
                            style={{
                                background: `linear-gradient(180deg, ${founder.color}, ${founder.colorAlt})`,
                            }}
                        />

                        <p className="relative mb-2.5 pl-3 text-[13.5px] italic leading-[1.75] text-gray-800 sm:mb-3 sm:pl-2 sm:text-[14.5px]">
                            &ldquo;{founder.quote}&rdquo;
                        </p>
                        <footer className="pl-3 text-[10px] font-black uppercase tracking-[0.22em] text-gray-400 sm:pl-2">
                            — {founder.name}
                        </footer>
                    </blockquote>
                </div>
                {/* ════ END RIGHT CONTENT ════ */}

            </div>
            {/* ── End content grid ── */}

        </div >
    );
}