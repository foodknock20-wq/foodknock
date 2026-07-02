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
            className="relative w-full overflow-hidden rounded-[24px] sm:rounded-[28px]"
            style={{
                background: "#ffffff",
                border: `1px solid ${founder.color}25`,
                boxShadow: `0 24px 64px -16px ${founder.color}25, 0 8px 24px -8px rgba(0,0,0,0.10)`,
                maxHeight: "calc(100dvh - 2rem)",
                overflowY: "auto",
                overflowX: "hidden",
                scrollbarWidth: "thin",
                scrollbarColor: `${founder.color}35 transparent`,
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
                    background: ${founder.color}40;
                    border-radius: 99px;
                }
                #founder-panel-${founder.id}::-webkit-scrollbar-thumb:hover {
                    background: ${founder.color}70;
                }
            `}</style>

            {/* Top accent strip — thinner, calmer */}
            <div
                className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-[2px]"
                style={{
                    background: `linear-gradient(90deg, transparent 8%, ${founder.color}70 35%, ${founder.colorAlt}60 65%, transparent 92%)`,
                }}
                aria-hidden="true"
            />

            {/* Ambient glow — single, quiet source top-right */}
            <div
                className="pointer-events-none absolute right-0 top-0 h-[320px] w-[320px] translate-x-1/3 -translate-y-1/3 rounded-full opacity-[0.06] blur-3xl sm:h-[380px] sm:w-[380px]"
                style={{ background: `radial-gradient(circle, ${founder.color}, transparent 65%)` }}
                aria-hidden="true"
            />

            {/* Close button — larger touch target, cleaner rest state */}
            <button
                onClick={onClose}
                aria-label="Close founder profile"
                className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.06] bg-white text-gray-400 shadow-sm transition-all duration-200 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-90 sm:right-5 sm:top-5 sm:h-10 sm:w-10"
            >
                <X size={15} strokeWidth={2.25} />
            </button>

            {/* Content grid */}
            <div className="relative grid grid-cols-1 md:grid-cols-[280px_1fr]">

                {/* ════ LEFT SIDEBAR ════ */}
                <div
                    className="border-b p-7 sm:p-8 md:border-b-0 md:border-r"
                    style={{
                        background: "linear-gradient(165deg, rgba(255,251,245,0.6) 0%, rgba(255,247,235,0.3) 100%)",
                        borderColor: "rgba(0, 0, 0, 0.06)",
                    }}
                >
                    {/* Avatar */}
                    <div
                        className="relative mb-6 h-28 w-28 overflow-hidden rounded-[20px] sm:h-32 sm:w-32"
                        style={{
                            border: `2px solid ${founder.color}45`,
                            boxShadow: `0 8px 24px -8px ${founder.color}35`,
                        }}
                    >
                        <img
                            src={founder.image}
                            alt={founder.name}
                            className="h-full w-full object-cover"
                        />
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{ background: `linear-gradient(135deg, ${founder.color}08, transparent 55%)` }}
                        />
                    </div>

                    {/* Co-founder label */}
                    <p
                        className="mb-2 text-[9.5px] font-black uppercase tracking-[0.28em]"
                        style={{ color: founder.color }}
                    >
                        Co-Founder
                    </p>

                    {/* Name */}
                    <h2
                        className="mb-2 text-[22px] font-black leading-[1.15] tracking-[-0.01em] text-gray-900 sm:text-[24px]"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                        {founder.name}
                    </h2>

                    {/* Role */}
                    <p className="mb-6 text-[12.5px] leading-[1.6] text-gray-500">
                        {founder.role}
                    </p>

                    {/* Divider */}
                    <div
                        className="mb-5 h-px w-full"
                        style={{ background: `linear-gradient(90deg, ${founder.color}25, transparent)` }}
                    />

                    {/* Expertise tags */}
                    <div className="mb-7">
                        <p className="mb-3 text-[9.5px] font-black uppercase tracking-[0.24em] text-gray-400">
                            Expertise
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {founder.expertise.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                                    style={{
                                        background: `${founder.color}0a`,
                                        border: `1px solid ${founder.color}20`,
                                        color: founder.color,
                                    }}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Social CTA */}
                    
                        href={founder.social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[12px] font-black uppercase tracking-[0.06em] text-white transition-all duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
                        style={{
                            background: `linear-gradient(135deg, ${founder.color} 0%, ${founder.colorAlt} 100%)`,
                            boxShadow: `0 8px 20px -6px ${founder.color}55`,
                        }}
                    >
                        {founder.social.type === "instagram" ? (
                            <Instagram size={14} strokeWidth={2.25} />
                        ) : (
                            <Linkedin size={14} strokeWidth={2.25} />
                        )}
                        {founder.social.label}
                    </a>
                </div>
                {/* ════ END LEFT SIDEBAR ════ */}

                {/* ════ RIGHT CONTENT ════ */}
                <div className="flex flex-col gap-7 p-7 sm:gap-8 sm:p-8 md:p-9">

                    {/* About section — improved measure for reading comfort */}
                    <div>
                        <p className="mb-4 text-[9.5px] font-black uppercase tracking-[0.28em] text-gray-400">
                            About {founder.name.split(" ")[0]}
                        </p>
                        <div className="max-w-[62ch] space-y-4">
                            {founder.bio.map((para, i) => (
                                <p
                                    key={i}
                                    className="text-[13.5px] leading-[1.8] text-gray-700"
                                >
                                    {para}
                                </p>
                            ))}
                        </div>
                    </div>

                    {/* Quote block — quieter background, clearer accent */}
                    <blockquote
                        className="relative overflow-hidden rounded-2xl p-6"
                        style={{
                            background: `${founder.color}06`,
                            border: `1px solid ${founder.color}18`,
                        }}
                    >
                        <span
                            className="pointer-events-none absolute right-4 top-1 select-none text-[64px] font-black leading-none opacity-[0.05]"
                            style={{ color: founder.color, fontFamily: "Georgia, serif" }}
                            aria-hidden="true"
                        >
                            "
                        </span>

                        <div
                            className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-2xl"
                            style={{ background: `linear-gradient(180deg, ${founder.color}, ${founder.colorAlt})` }}
                        />

                        <p className="relative mb-3 max-w-[56ch] pl-3 text-[14.5px] italic leading-[1.75] text-gray-800">
                            &ldquo;{founder.quote}&rdquo;
                        </p>
                        <footer className="pl-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                            — {founder.name}
                        </footer>
                    </blockquote>
                </div>
                {/* ════ END RIGHT CONTENT ════ */}

            </div>
        </div>
    );
}