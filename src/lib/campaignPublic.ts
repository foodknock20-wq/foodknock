// src/lib/campaignPublic.ts
//
// Phase 12 completion — THE single place public (customer-facing) campaign
// visibility/liveness is decided. A campaign's stored `status` is admin
// intent, not customer-facing truth on its own — "active" doesn't mean
// live if startAt is still in the future or endAt has already passed, and
// a non-"active" status (draft/paused/ended/archived) must NEVER be
// customer-visible regardless of dates. Both conditions are checked here,
// server-side, against the server clock — never the client's.

import Campaign, { type CampaignStatus } from "@/models/Campaign";
import Offer from "@/models/Offer";

export type PublicCampaign = {
    _id: string;
    name: string;
    slug: string;
    title: string;
    shortDescription: string;
    description: string;
    campaignType: string;
    heroImage: string;
    startAt: string | null;
    endAt: string | null;
    terms: string;
};

export type PublicOffer = {
    _id: string;
    name: string;
    description: string;
    discountType: "FIXED" | "PERCENTAGE" | "FREE_DELIVERY";
    discountValue: number;
    minimumOrderValue: number;
    maximumDiscount: number | null;
};

/** True only when status is literally "active" AND the current server time is within [startAt, endAt]. */
export function isCampaignLiveNow(status: CampaignStatus, startAt: Date | null, endAt: Date | null): boolean {
    if (status !== "active") return false;
    const now = Date.now();
    if (startAt && startAt.getTime() > now) return false;
    if (endAt && endAt.getTime() < now) return false;
    return true;
}

function toPublicCampaign(doc: {
    _id: unknown; name: string; slug: string; title: string; shortDescription: string;
    description: string; campaignType: string; heroImage: string; startAt: Date | null; endAt: Date | null; terms: string;
}): PublicCampaign {
    return {
        _id: String(doc._id),
        name: doc.name,
        slug: doc.slug,
        title: doc.title || doc.name,
        shortDescription: doc.shortDescription,
        description: doc.description,
        campaignType: doc.campaignType,
        heroImage: doc.heroImage,
        startAt: doc.startAt ? doc.startAt.toISOString() : null,
        endAt: doc.endAt ? doc.endAt.toISOString() : null,
        terms: doc.terms,
    };
}

/**
 * The single campaign shown on the homepage, if any: visibility.homepage
 * must be true AND it must be genuinely live right now (not just stored
 * as "active"). Highest-priority match wins; bounded to one result —
 * the homepage never needs to evaluate "how many campaigns exist".
 */
export async function getActiveHomepageCampaign(): Promise<PublicCampaign | null> {
    const now = new Date();
    const doc = await Campaign.findOne({
        status: "active",
        "visibility.homepage": true,
        $and: [
            { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
            { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
        ],
    })
        .sort({ priority: -1 })
        .select("name slug title shortDescription description campaignType heroImage startAt endAt terms")
        .lean<Parameters<typeof toPublicCampaign>[0] | null>();

    return doc ? toPublicCampaign(doc) : null;
}

/**
 * FoodKnock UI 2.0 — Phase 2: list variant of getActiveHomepageCampaign for
 * the new Home hero carousel (which can show more than one live campaign,
 * unlike the single-campaign strip it replaces). Exact same live/visibility
 * predicate, just `.find()` + `limit` instead of `.findOne()`.
 */
export async function getActiveCampaigns(limit = 5): Promise<PublicCampaign[]> {
    const now = new Date();
    const docs = await Campaign.find({
        status: "active",
        "visibility.homepage": true,
        $and: [
            { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
            { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
        ],
    })
        .sort({ priority: -1 })
        .limit(limit)
        .select("name slug title shortDescription description campaignType heroImage startAt endAt terms")
        .lean<Array<Parameters<typeof toPublicCampaign>[0]>>();

    return docs.map(toPublicCampaign);
}

export type CampaignPageResult =
    | { state: "live"; campaign: PublicCampaign; offers: PublicOffer[] }
    | { state: "not_started"; campaign: PublicCampaign }
    | { state: "ended"; campaign: PublicCampaign }
    | { state: "not_found" };

/**
 * For /campaigns/[slug]. A draft/paused/archived campaign is reported as
 * not_found (never leaked, even by direct slug guess) — only active
 * campaigns are ever returned, distinguishing "not started yet" and
 * "already ended" so the page can render a graceful state instead of a
 * generic 404 for a campaign that's merely scheduled or just finished.
 */
export async function getPublicCampaignBySlug(slug: string): Promise<CampaignPageResult> {
    const doc = await Campaign.findOne({ slug, status: "active" })
        .select("name slug title shortDescription description campaignType heroImage startAt endAt terms")
        .lean<Parameters<typeof toPublicCampaign>[0] | null>();

    if (!doc) return { state: "not_found" };

    const campaign = toPublicCampaign(doc);
    const now = Date.now();
    const startAt = doc.startAt ? doc.startAt.getTime() : null;
    const endAt = doc.endAt ? doc.endAt.getTime() : null;

    if (startAt && startAt > now) return { state: "not_started", campaign };
    if (endAt && endAt < now) return { state: "ended", campaign };

    const offers = await Offer.find({
        campaignId: doc._id,
        status: "ACTIVE",
        $and: [
            { $or: [{ startAt: null }, { startAt: { $lte: new Date(now) } }] },
            { $or: [{ endAt: null }, { endAt: { $gte: new Date(now) } }] },
        ],
    })
        .sort({ priority: -1 })
        .limit(20)
        .select("name description discountType discountValue minimumOrderValue maximumDiscount")
        .lean<Array<{ _id: unknown; name: string; description: string; discountType: "FIXED" | "PERCENTAGE" | "FREE_DELIVERY"; discountValue: number; minimumOrderValue: number; maximumDiscount: number | null }>>();

    return {
        state: "live",
        campaign,
        offers: offers.map((o) => ({
            _id: String(o._id),
            name: o.name,
            description: o.description,
            discountType: o.discountType,
            discountValue: o.discountValue,
            minimumOrderValue: o.minimumOrderValue,
            maximumDiscount: o.maximumDiscount,
        })),
    };
}
