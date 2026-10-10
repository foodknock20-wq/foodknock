// src/lib/adminCampaigns.ts
//
// Phase 12 — admin Campaign CRUD. Mirrors adminCoupons.ts's discipline:
// explicit field allowlisting, bounded list queries, no hard delete
// (status transitions only — "archived" is the closest thing to deletion,
// and it preserves the row for historical Offer/Coupon references).

import mongoose from "mongoose";
import Campaign, { type CampaignType, type CampaignStatus } from "@/models/Campaign";

const MAX_LIST_LIMIT = 100;

// Phase 12 completion — server-enforced lifecycle (spec: "Do not allow
// nonsensical transitions... Server must enforce lifecycle rules"). A
// status is always allowed to "transition" to itself (no-op save of other
// fields shouldn't be blocked just because status was echoed back
// unchanged). archived is terminal — no architecture exists yet for a
// safe restore, so it stays that way deliberately.
const VALID_STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
    draft:     ["draft", "scheduled", "active", "archived"],
    scheduled: ["scheduled", "active", "paused", "archived"],
    active:    ["active", "paused", "ended", "archived"],
    paused:    ["paused", "active", "ended", "archived"],
    ended:     ["ended", "archived"],
    archived:  ["archived"],
};

function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

export interface CampaignInput {
    name: string;
    title?: string;
    shortDescription?: string;
    description?: string;
    campaignType?: CampaignType;
    startAt?: string | null;
    endAt?: string | null;
    priority?: number;
    heroImage?: string;
    visibility?: { homepage?: boolean; loyaltyPage?: boolean };
    terms?: string;
}

function parseOptionalDate(value: string | null | undefined, label: string): Date | null {
    if (value == null || value === "") return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`${label} is not a valid date`);
    return d;
}

async function uniqueSlug(base: string): Promise<string> {
    let slug = base || "campaign";
    let suffix = 1;
    while (await Campaign.exists({ slug })) {
        slug = `${base}-${suffix++}`;
    }
    return slug;
}

export async function createCampaign(input: CampaignInput) {
    const name = String(input.name ?? "").trim();
    if (!name) throw new Error("Campaign name is required");

    const startAt = parseOptionalDate(input.startAt, "Start date");
    const endAt = parseOptionalDate(input.endAt, "End date");
    if (startAt && endAt && endAt <= startAt) throw new Error("End date must be after the start date");

    const slug = await uniqueSlug(slugify(name));

    const doc = await Campaign.create({
        name,
        slug,
        title: String(input.title ?? "").trim().slice(0, 120),
        shortDescription: String(input.shortDescription ?? "").trim().slice(0, 200),
        description: String(input.description ?? "").trim().slice(0, 2000),
        campaignType: input.campaignType ?? "custom",
        status: "draft",
        startAt,
        endAt,
        priority: Number(input.priority ?? 0),
        heroImage: String(input.heroImage ?? "").trim(),
        visibility: {
            homepage: !!input.visibility?.homepage,
            loyaltyPage: !!input.visibility?.loyaltyPage,
        },
        terms: String(input.terms ?? "").trim().slice(0, 2000),
    });

    return doc.toObject();
}

export interface CampaignUpdateInput extends Partial<CampaignInput> {
    status?: CampaignStatus;
}

export async function updateCampaign(id: string, input: CampaignUpdateInput) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid campaign id");

    // Resolve the current status FIRST when a transition is requested —
    // the allowed-next-states list depends on where the campaign actually
    // is right now, never on what the client claims it was.
    let currentStatus: CampaignStatus | null = null;
    if (input.status !== undefined) {
        const existing = await Campaign.findById(id).select("status").lean<{ status: CampaignStatus } | null>();
        if (!existing) throw new Error("Campaign not found");
        currentStatus = existing.status;
    }

    const update: Record<string, unknown> = {};

    if (input.name !== undefined) update.name = String(input.name).trim();
    if (input.title !== undefined) update.title = String(input.title).trim().slice(0, 120);
    if (input.shortDescription !== undefined) update.shortDescription = String(input.shortDescription).trim().slice(0, 200);
    if (input.description !== undefined) update.description = String(input.description).trim().slice(0, 2000);
    if (input.campaignType !== undefined) update.campaignType = input.campaignType;
    if (input.startAt !== undefined) update.startAt = parseOptionalDate(input.startAt, "Start date");
    if (input.endAt !== undefined) update.endAt = parseOptionalDate(input.endAt, "End date");
    if (input.priority !== undefined) update.priority = Number(input.priority);
    if (input.heroImage !== undefined) update.heroImage = String(input.heroImage).trim();
    if (input.terms !== undefined) update.terms = String(input.terms).trim().slice(0, 2000);
    if (input.visibility !== undefined) {
        if (input.visibility.homepage !== undefined) update["visibility.homepage"] = !!input.visibility.homepage;
        if (input.visibility.loyaltyPage !== undefined) update["visibility.loyaltyPage"] = !!input.visibility.loyaltyPage;
    }
    if (input.status !== undefined) {
        const validStatuses: CampaignStatus[] = ["draft", "scheduled", "active", "paused", "ended", "archived"];
        if (!validStatuses.includes(input.status)) throw new Error("Invalid status");
        const allowedNext = VALID_STATUS_TRANSITIONS[currentStatus as CampaignStatus];
        if (!allowedNext.includes(input.status)) {
            throw new Error(`Cannot move a campaign from "${currentStatus}" to "${input.status}"`);
        }
        update.status = input.status;
    }

    const updated = await Campaign.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!updated) throw new Error("Campaign not found");
    return updated;
}

export async function duplicateCampaign(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid campaign id");
    const original = await Campaign.findById(id).lean<Record<string, unknown> | null>();
    if (!original) throw new Error("Campaign not found");

    const name = `${String(original.name)} (Copy)`;
    const slug = await uniqueSlug(slugify(name));

    const doc = await Campaign.create({
        name,
        slug,
        title: original.title,
        shortDescription: original.shortDescription,
        description: original.description,
        campaignType: original.campaignType,
        status: "draft",
        startAt: null,
        endAt: null,
        priority: original.priority,
        heroImage: original.heroImage,
        visibility: original.visibility,
        terms: original.terms,
    });

    return doc.toObject();
}

export interface ListCampaignsParams {
    status?: CampaignStatus;
    page?: number;
    limit?: number;
}

export async function listCampaigns(params: ListCampaignsParams) {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(Number(params.limit ?? 25))));
    const page = Math.max(1, Math.floor(Number(params.page ?? 1)));

    const filter: Record<string, unknown> = {};
    if (params.status) filter.status = params.status;

    const [campaigns, total] = await Promise.all([
        Campaign.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Campaign.countDocuments(filter),
    ]);

    return { campaigns, total, page, limit };
}
