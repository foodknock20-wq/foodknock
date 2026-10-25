// src/components/home/TestimonialsStrip.tsx
//
// FoodKnock UI 2.0 — Phase 2: extracted from the inline `TestimonialsStrip`
// function that used to live directly in src/app/(main)/page.tsx (spec
// section 40 — named by responsibility, not "Section3"). Same data/logic
// (real approved reviews from getHomeData(), unchanged), restyled to dark
// tokens. Server component — no interactivity.

import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";
import type { HomeReview } from "@/app/(main)/page";

const WORD_LIMIT = 12;

function truncateWords(text: string): { preview: string; isTruncated: boolean } {
    const words = text.trim().split(/\s+/);
    if (words.length <= WORD_LIMIT) return { preview: text, isTruncated: false };
    return { preview: words.slice(0, WORD_LIMIT).join(" ") + "…", isTruncated: true };
}

function initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export default function TestimonialsStrip({ reviews }: { reviews: HomeReview[] }) {
    if (reviews.length === 0) return null;

    return (
        <section className="px-4 py-10 md:px-8 md:py-14">
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--fk-accent)]">
                        Customer Love
                    </p>
                    <h2 className="font-display text-xl font-black text-fk-text md:text-2xl">
                        Don&apos;t just take our word for it
                    </h2>
                </div>
                <Link href="/reviews" className="hidden items-center gap-1 text-[12px] font-bold text-fk-text-secondary md:inline-flex">
                    All Reviews <ChevronRight size={13} />
                </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {reviews.map(({ _id, userName, rating, comment }) => {
                    const { preview, isTruncated } = truncateWords(comment);
                    return (
                        <div key={_id} className="flex flex-col rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-5">
                            <div className="mb-3 flex gap-0.5">
                                {Array.from({ length: rating }).map((_, si) => (
                                    <Star key={si} size={13} className="fill-fk-gold text-fk-gold" />
                                ))}
                            </div>
                            <p className="flex-1 text-sm leading-7 text-fk-text-secondary">&ldquo;{preview}&rdquo;</p>
                            {isTruncated && (
                                <Link href="/reviews" className="mt-1.5 flex w-fit items-center gap-0.5 text-[12px] font-bold text-[var(--fk-accent)]">
                                    Read more <ChevronRight size={12} strokeWidth={2.5} />
                                </Link>
                            )}
                            <div className="mt-4 flex items-center gap-2.5 border-t border-fk-border pt-4">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] text-xs font-black text-white">
                                    {initials(userName)}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-fk-text">{userName}</p>
                                    <p className="text-[11px] text-fk-text-tertiary">FoodKnock customer</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
