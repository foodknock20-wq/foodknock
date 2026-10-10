// src/app/campaigns/[slug]/page.tsx
//
// Phase 12 completion — public campaign detail page. Server component:
// one bounded query (src/lib/campaignPublic.ts), no client-side data
// waterfall. A draft/paused/archived/unknown slug renders the same
// not_found state as a genuinely missing campaign — never leaks which
// slugs exist in the system.

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import CustomerShell from "@/components/shell/CustomerShell";
import Footer from "@/components/shared/Footer";
import OfferCard from "@/components/campaigns/OfferCard";
import CampaignCountdown from "@/components/campaigns/CampaignCountdown";
import { getPublicCampaignBySlug } from "@/lib/campaignPublic";
import { Sparkles, ArrowRight, Gift } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const result = await getPublicCampaignBySlug(slug);
    if (result.state === "not_found") return { title: "Campaign Not Found | FoodKnock" };

    const { campaign } = result;
    return {
        title: `${campaign.title} | FoodKnock`,
        description: campaign.shortDescription || campaign.description.slice(0, 160) || `${campaign.title} — exclusive offers on FoodKnock.`,
        openGraph: {
            title: campaign.title,
            description: campaign.shortDescription,
            images: campaign.heroImage ? [campaign.heroImage] : undefined,
        },
        alternates: { canonical: `/campaigns/${campaign.slug}` },
    };
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <CustomerShell>
            <main className="min-h-screen bg-fk-bg">{children}</main>
            <Footer />
        </CustomerShell>
    );
}

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const result = await getPublicCampaignBySlug(slug);

    if (result.state === "not_found") {
        return (
            <Shell>
                <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-24 text-center">
                    <div className="text-5xl">🪔</div>
                    <h1 className="text-xl font-black text-fk-text">Campaign not found</h1>
                    <p className="text-sm text-fk-text-secondary">This campaign doesn&apos;t exist or is no longer available.</p>
                    <Link href="/menu" className="mt-2 inline-flex items-center gap-1.5 rounded-fk-md bg-[var(--fk-accent)] px-5 py-2.5 text-[13px] font-bold text-white hover:brightness-110">
                        Browse Menu <ArrowRight size={14} />
                    </Link>
                </div>
            </Shell>
        );
    }

    const { campaign } = result;

    if (result.state === "not_started") {
        return (
            <Shell>
                <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-24 text-center">
                    <div className="text-5xl">⏳</div>
                    <h1 className="text-xl font-black text-fk-text">{campaign.title} hasn&apos;t started yet</h1>
                    <p className="text-sm text-fk-text-secondary">
                        {campaign.startAt ? `Check back on ${new Date(campaign.startAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.` : "Check back soon."}
                    </p>
                </div>
            </Shell>
        );
    }

    if (result.state === "ended") {
        return (
            <Shell>
                <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-24 text-center">
                    <div className="text-5xl">🎉</div>
                    <h1 className="text-xl font-black text-fk-text">{campaign.title} has ended</h1>
                    <p className="text-sm text-fk-text-secondary">Thanks to everyone who joined in — stay tuned for what&apos;s next.</p>
                    <Link href="/menu" className="mt-2 inline-flex items-center gap-1.5 rounded-fk-md bg-[var(--fk-accent)] px-5 py-2.5 text-[13px] font-bold text-white hover:brightness-110">
                        Browse Menu <ArrowRight size={14} />
                    </Link>
                </div>
            </Shell>
        );
    }

    const { offers } = result;

    return (
        <Shell>
            {/* ── Hero ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.08]"
                    style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
                />
                <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-10 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                        <Sparkles size={11} /> FoodKnock Campaign
                    </span>
                    <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">{campaign.title}</h1>
                    {campaign.shortDescription && (
                        <p className="mx-auto mt-2 max-w-md text-[14px] text-white/85">{campaign.shortDescription}</p>
                    )}
                    {campaign.endAt && (
                        <div className="mt-5 flex justify-center">
                            <CampaignCountdown endAt={campaign.endAt} />
                        </div>
                    )}
                    <div className="mt-6">
                        <Link
                            href="/menu"
                            className="inline-flex items-center gap-2 rounded-fk-lg bg-fk-surface-elevated px-6 py-3 text-[14px] font-black text-[var(--fk-accent)] shadow-lg transition-transform active:scale-95"
                        >
                            Order Now <ArrowRight size={15} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
                {campaign.description && (
                    <div className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-5">
                        <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-fk-text-secondary">{campaign.description}</p>
                    </div>
                )}

                {offers.length > 0 && (
                    <div>
                        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-fk-text-secondary">Offers in this campaign</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {offers.map((offer) => <OfferCard key={offer._id} offer={offer} />)}
                        </div>
                        <p className="mt-2 text-[11px] text-fk-text-tertiary">
                            Final eligibility and discount are confirmed at checkout. One promotion applies per order.
                        </p>
                    </div>
                )}

                <div className="rounded-fk-lg border border-fk-border bg-fk-surface-selected p-5">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-fk-md bg-fk-gold-soft">
                            <Gift size={16} className="text-[var(--fk-accent)]" />
                        </div>
                        <div>
                            <p className="text-[13px] font-black text-fk-text">Also earning FoodKnock Rewards?</p>
                            <p className="text-[11.5px] text-fk-text-secondary">Spin &amp; Win on the Rewards page — separate from campaign offers.</p>
                        </div>
                    </div>
                    <Link href="/loyalty" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--fk-accent)] hover:brightness-110">
                        Go to Rewards <ArrowRight size={12} />
                    </Link>
                </div>

                {campaign.terms && (
                    <details className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-5">
                        <summary className="cursor-pointer text-[12px] font-bold text-fk-text-secondary">Terms &amp; Conditions</summary>
                        <p className="mt-2 whitespace-pre-line text-[11.5px] leading-relaxed text-fk-text-secondary">{campaign.terms}</p>
                    </details>
                )}
            </div>
        </Shell>
    );
}
