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
            className="group relative w-full overflow-hidden rounded-[24px] text-left outline-none transition-all duration-300 ease-out focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:scale-[0.995]"
            style={{
                border: isActive
                    ? `1px solid ${founder.color}55`
                    : "1px solid rgba(0, 0, 0, 0.06)",
                background: isActive
                    ? "linear-gradient(155deg, #ffffff 0%, #fffbf5 100%)"
                    : "#ffffff",
                transform: isActive ? "translateY(-3px)" : "translateY(0)",
                boxShadow: isActive
                    ? `0 16px 40px -12px ${founder.color}35, 0 4px 12px -4px ${founder.color}20`
                    : "0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02)",
            }}
        >
            {/* Ambient fill — quiet, only on hover/active, never both stacking hard */}
            <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    background: `radial-gradient(ellipse at 75% 0%, ${founder.color}08, transparent 60%)`,
                    opacity: isActive ? 1 : undefined,
                }}
                aria-hidden="true"
            />

            {/* Top accent line — thinner, calmer */}
            <div
                className="absolute left-7 right-7 top-0 h-px transition-opacity duration-300"
                style={{
                    background: `linear-gradient(90deg, transparent, ${founder.color}90, transparent)`,
                    opacity: isActive ? 0.7 : 0,
                }}
                aria-hidden="true"
            />

            <div className="relative p-6 sm:p-7">
                {/* Header row */}
                <div className="mb-6 flex items-start justify-between gap-3">
                    {/* Avatar */}
                    <div
                        className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                        style={{
                            border: isActive
                                ? `2px solid ${founder.color}70`
                                : "2px solid rgba(0, 0, 0, 0.06)",
                            boxShadow: isActive
                                ? `0 6px 18px -4px ${founder.color}40`
                                : "0 1px 3px rgba(0,0,0,0.06)",
                        }}
                    >
                        <img
                            src={founder.image}
                            alt={founder.name}
                            className="h-full w-full object-cover"
                        />
                        {isActive && (
                            <div
                                className="absolute inset-0"
                                style={{ background: `linear-gradient(135deg, ${founder.color}0f, transparent)` }}
                            />
                        )}
                    </div>

                    {/* Pillar badge — smaller, quieter type, still clear as a status marker */}
                    <span
                        className="mt-0.5 shrink-0 rounded-full px-3 py-1 text-[9.5px] font-black uppercase tracking-[0.14em] transition-colors duration-300"
                        style={{
                            background: isActive
                                ? `linear-gradient(135deg, ${founder.color}, ${founder.colorAlt})`
                                : `${founder.color}0c`,
                            color: isActive ? "#ffffff" : founder.color,
                            boxShadow: isActive ? `0 3px 10px ${founder.color}40` : "none",
                        }}
                    >
                        {founder.pillar}
                    </span>
                </div>

                {/* Name */}
                <h3
                    className="mb-1 text-[20px] font-black leading-tight tracking-[-0.01em] text-gray-900"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                    {founder.name}
                </h3>

                {/* Role */}
                <p className="mb-4 text-[12px] font-medium leading-snug text-gray-400">
                    {founder.role}
                </p>

                {/* Short bio — improved measure/leading for readability */}
                <p className="text-[13.5px] leading-[1.68] text-gray-600">
                    {founder.shortBio}
                </p>

                {/* CTA row — cleaner rest state, clearer active state */}
                <div
                    className="mt-6 flex items-center gap-2 rounded-xl px-4 py-3 transition-colors duration-300"
                    style={{
                        background: isActive ? `${founder.color}0a` : "rgba(0, 0, 0, 0.02)",
                        border: isActive ? `1px solid ${founder.color}20` : "1px solid rgba(0, 0, 0, 0.04)",
                    }}
                >
                    <p
                        className="text-[11.5px] font-black uppercase tracking-[0.1em] transition-colors duration-200"
                        style={{ color: isActive ? founder.color : "rgb(120, 113, 108)" }}
                    >
                        {isActive ? "Profile open" : "View full profile"}
                    </p>
                    <svg
                        className="ml-auto transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                        style={{
                            transform: isActive ? "rotate(45deg)" : "rotate(0deg)",
                            color: isActive ? founder.color : "rgb(168, 162, 158)",
                        }}
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
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