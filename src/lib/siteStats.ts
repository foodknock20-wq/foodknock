// src/lib/siteStats.ts
//
// CRITICAL FINAL FIX — pure, side-effect-free extraction of the homepage's
// review-stats computation out of getHomeData() (src/app/(main)/page.tsx),
// specifically so the real bug fixed there (totalReviews/avgRating were
// silently computed from a `.limit(10)`-capped review query instead of the
// true site-wide total) has a directly testable contract that doesn't
// require mocking MongoDB/Mongoose.
//
// `totalApproved` must come from a real `Review.countDocuments({isApproved:
// true})` — this function does not (and cannot) verify that; it only
// combines whatever count and rating sample it's given. `ratings` is the
// bounded (`.limit(200)`) sample used to compute the average — large enough
// to be the TRUE average unless/until approved reviews exceed 200 (see
// getHomeData()'s own comment for why a full aggregation isn't run just for
// this).

export type SiteStatsResult = { avgRating: string | null; totalReviews: number };

export function computeSiteStats(ratings: number[], totalApproved: number): SiteStatsResult {
    if (ratings.length === 0) {
        return { avgRating: null, totalReviews: totalApproved };
    }
    const sum = ratings.reduce((s, r) => s + r, 0);
    const avg = sum / ratings.length;
    return { avgRating: avg.toFixed(1), totalReviews: totalApproved };
}
