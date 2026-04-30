// src/components/founders/FounderCard.tsx
import type { Founder } from "@/lib/foundersData";

interface Props {
    founder: Founder;
    isActive: boolean;
    onClick: () => void;
}

export default function FounderCard({ founder, isActive, onClick }: Props) {
    return (
        <button
            onClick={onClick}
            aria-expanded={isActive}
            aria-controls={`founder-panel-${founder.id}`}
            className="group relative w-full overflow-hidden rounded-[28px] text-left outline-none transition-all duration-500 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
            style={{
                border: isActive
                    ? `1.5px solid ${founder.color}70`
                    : "1.5px solid rgba(255, 200, 140, 0.25)",
                background: isActive
                    ? "linear-gradient(145deg, #ffffff 0%, #fffbf2 60%, #fff7e8 100%)"
                    : "linear-gradient(145deg, #ffffff 0%, #fffdf9 100%)",
                transform: isActive ? "translateY(-6px) scale(1.015)" : "translateY(0) scale(1)",
                boxShadow: isActive
                    ? `0 24px 60px -10px ${founder.color}40, 0 8px 20px -8px ${founder.color}30, 0 0 0 1px ${founder.color}18`
                    : "0 2px 12px rgba(200, 120, 50, 0.07), 0 1px 3px rgba(0,0,0,0.04)",
            }}
        >
            {/* Warm ambient fill on hover/active */}
            <div
                className="pointer-events-none absolute inset-0 rounded-[28px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                    background: `radial-gradient(ellipse at 70% 10%, ${founder.color}10, transparent 65%)`,
                    opacity: isActive ? 1 : undefined,
                }}
                aria-hidden="true"
            />

            {/* Top accent line */}
            <div
                className="absolute left-6 right-6 top-0 h-[2px] rounded-full transition-all duration-500"
                style={{
                    background: isActive
                        ? `linear-gradient(90deg, transparent, ${founder.color}, transparent)`
                        : "transparent",
                    opacity: isActive ? 0.6 : 0,
                }}
                aria-hidden="true"
            />

            <div className="relative p-6 md:p-7">
                {/* Header row */}
                <div className="mb-5 flex items-start justify-between gap-3">
                    {/* Avatar */}
                    <div
                        className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-2xl transition-all duration-500"
                        style={{
                            border: isActive
                                ? `2.5px solid ${founder.color}90`
                                : "2.5px solid rgba(255, 190, 120, 0.2)",
                            boxShadow: isActive
                                ? `0 8px 28px ${founder.color}35`
                                : "0 2px 10px rgba(0,0,0,0.06)",
                        }}
                    >
                        <img
                            src={founder.image}
                            alt={founder.name}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {/* Warm image overlay when active */}
                        {isActive && (
                            <div
                                className="absolute inset-0 rounded-2xl"
                                style={{
                                    background: `linear-gradient(135deg, ${founder.color}12, transparent)`,
                                }}
                            />
                        )}
                    </div>

                    {/* Pillar badge */}
                    <span
                        className="mt-1 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all duration-300"
                        style={{
                            background: isActive
                                ? `linear-gradient(135deg, ${founder.color}, ${founder.colorAlt})`
                                : `${founder.color}10`,
                            color: isActive ? "#ffffff" : founder.color,
                            border: isActive ? "none" : `1px solid ${founder.color}28`,
                            boxShadow: isActive ? `0 4px 14px ${founder.color}45` : "none",
                        }}
                    >
                        {founder.pillar}
                    </span>
                </div>

                {/* Name */}
                <h3
                    className="mb-1 text-[19px] font-black leading-tight tracking-tight text-gray-900 transition-colors duration-300"
                    style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        color: isActive ? "#1a1008" : "#111827",
                    }}
                >
                    {founder.name}
                </h3>

                {/* Role */}
                <p className="mb-4 text-[12px] font-semibold leading-snug text-gray-400">
                    {founder.role}
                </p>

                {/* Short bio */}
                <p className="text-[13.5px] leading-[1.72] text-gray-600">
                    {founder.shortBio}
                </p>

                {/* CTA row */}
                <div
                    className="mt-6 flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all duration-300"
                    style={{
                        background: isActive
                            ? `linear-gradient(90deg, ${founder.color}12, ${founder.color}06)`
                            : "rgba(250, 245, 235, 0.5)",
                        border: isActive
                            ? `1px solid ${founder.color}22`
                            : "1px solid rgba(220, 180, 130, 0.15)",
                    }}
                >
                    <p
                        className="text-[12px] font-black uppercase tracking-wide transition-colors duration-200"
                        style={{ color: isActive ? founder.color : "rgba(180, 150, 110, 0.7)" }}
                    >
                        {isActive ? "Profile open ✦" : "View full profile"}
                    </p>
                    <svg
                        className="ml-auto transition-transform duration-400"
                        style={{
                            transform: isActive ? "rotate(45deg)" : "rotate(0deg)",
                            color: isActive ? founder.color : "rgba(180, 150, 110, 0.45)",
                        }}
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </div>
            </div>
        </button>
    );
}