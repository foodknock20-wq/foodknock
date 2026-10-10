// src/lib/analyticsDateRange.ts
//
// Phase 15D — single source of truth for Analytics 2.0 date-range
// resolution. FoodKnock is an India-only business; every "Today"/"This
// Month"/etc. boundary must be the Asia/Kolkata calendar day, not the
// server process's local time (which on Vercel is UTC — a naive
// `new Date().setHours(0,0,0,0)` would roll "today" over 5.5 hours early/
// late depending on the time of day, exactly the bug found in the
// existing /admin dashboard during the Phase 15D audit).
//
// Approach: Asia/Kolkata has a fixed, always-on +05:30 offset (India has
// not observed DST since 1945) — so "the current Kolkata wall-clock time"
// is always exactly `Date.now() + 5.5h`, and "midnight Kolkata" for any
// given Kolkata calendar date is always that UTC instant minus 5.5h. This
// lets every boundary be computed with plain arithmetic, no Intl calendar
// math needed, and no DST edge cases to get wrong.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The current instant, expressed as if it were UTC wall-clock time in Kolkata — i.e. shifted +5:30. Only used to read Y/M/D fields; never returned directly as a real Date. */
function nowAsKolkataShifted(): Date {
    return new Date(Date.now() + IST_OFFSET_MS);
}

/** Midnight at the start of the Kolkata calendar day containing `shifted` (a Date already shifted by +5:30), expressed as the REAL UTC instant. */
function kolkataMidnightUtc(shiftedYear: number, shiftedMonth: number, shiftedDate: number): Date {
    // Build the UTC midnight for (Y,M,D) in the shifted frame, then undo the shift.
    const shiftedMidnightUtcMs = Date.UTC(shiftedYear, shiftedMonth, shiftedDate, 0, 0, 0, 0);
    return new Date(shiftedMidnightUtcMs - IST_OFFSET_MS);
}

export type AnalyticsRangeKey =
    | "today" | "yesterday" | "7d" | "30d" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

export type ResolvedRange = {
    key: AnalyticsRangeKey;
    /** Inclusive start instant (UTC), real Date, Mongo-query-ready. */
    start: Date;
    /** Exclusive end instant (UTC) — i.e. query with `createdAt: { $gte: start, $lt: end }`. */
    end: Date;
    /** Equal-length immediately-preceding period, for comparison metrics. */
    prevStart: Date;
    prevEnd: Date;
    /** Suggested trend-chart bucket granularity for this range. */
    bucket: "hour" | "day" | "week" | "month";
    label: string;
};

const VALID_KEYS: AnalyticsRangeKey[] = ["today", "yesterday", "7d", "30d", "thisMonth", "lastMonth", "thisYear", "custom"];

export function isValidRangeKey(v: string | undefined): v is AnalyticsRangeKey {
    return !!v && (VALID_KEYS as string[]).includes(v);
}

/**
 * Resolves a range key (+ optional custom from/to, as "YYYY-MM-DD" strings)
 * into real UTC Date boundaries, Kolkata-calendar-correct, plus the
 * matching previous-period boundaries for comparison metrics.
 *
 * Never trusts arbitrary client Mongo expressions — only this fixed,
 * allowlisted set of keys, and for "custom" only two plain date strings
 * which are parsed as Kolkata calendar dates, never as raw client-supplied
 * Date objects or query fragments.
 */
export function resolveAnalyticsRange(
    key: AnalyticsRangeKey,
    customFrom?: string,
    customTo?: string
): ResolvedRange {
    const shiftedNow = nowAsKolkataShifted();
    const y = shiftedNow.getUTCFullYear();
    const m = shiftedNow.getUTCMonth();
    const d = shiftedNow.getUTCDate();

    const todayStart = kolkataMidnightUtc(y, m, d);
    const todayEnd = kolkataMidnightUtc(y, m, d + 1);

    switch (key) {
        case "today": {
            const prevStart = kolkataMidnightUtc(y, m, d - 1);
            return { key, start: todayStart, end: todayEnd, prevStart, prevEnd: todayStart, bucket: "hour", label: "Today" };
        }
        case "yesterday": {
            const start = kolkataMidnightUtc(y, m, d - 1);
            const prevStart = kolkataMidnightUtc(y, m, d - 2);
            return { key, start, end: todayStart, prevStart, prevEnd: start, bucket: "hour", label: "Yesterday" };
        }
        case "7d": {
            const start = kolkataMidnightUtc(y, m, d - 7);
            const prevStart = kolkataMidnightUtc(y, m, d - 14);
            return { key, start, end: todayEnd, prevStart, prevEnd: start, bucket: "day", label: "Last 7 Days" };
        }
        case "30d": {
            const start = kolkataMidnightUtc(y, m, d - 30);
            const prevStart = kolkataMidnightUtc(y, m, d - 60);
            return { key, start, end: todayEnd, prevStart, prevEnd: start, bucket: "day", label: "Last 30 Days" };
        }
        case "thisMonth": {
            const start = kolkataMidnightUtc(y, m, 1);
            const prevStart = kolkataMidnightUtc(y, m - 1, 1);
            return { key, start, end: todayEnd, prevStart, prevEnd: start, bucket: "day", label: "This Month" };
        }
        case "lastMonth": {
            const start = kolkataMidnightUtc(y, m - 1, 1);
            const end = kolkataMidnightUtc(y, m, 1);
            const prevStart = kolkataMidnightUtc(y, m - 2, 1);
            return { key, start, end, prevStart, prevEnd: start, bucket: "day", label: "Last Month" };
        }
        case "thisYear": {
            const start = kolkataMidnightUtc(y, 0, 1);
            const prevStart = kolkataMidnightUtc(y - 1, 0, 1);
            return { key, start, end: todayEnd, prevStart, prevEnd: start, bucket: "month", label: "This Year" };
        }
        case "custom": {
            // customFrom/customTo are "YYYY-MM-DD" Kolkata calendar dates.
            const from = parseKolkataDateString(customFrom) ?? todayStart;
            const toExclusive = parseKolkataDateString(customTo);
            const end = toExclusive ? addKolkataDays(toExclusive, 1) : todayEnd;
            const spanMs = Math.max(end.getTime() - from.getTime(), 24 * 60 * 60 * 1000);
            const prevEnd = from;
            const prevStart = new Date(from.getTime() - spanMs);
            const bucket = spanMs > 95 * 24 * 60 * 60 * 1000 ? "month" : spanMs > 2 * 24 * 60 * 60 * 1000 ? "day" : "hour";
            return { key, start: from, end, prevStart, prevEnd, bucket, label: "Custom Range" };
        }
        default: {
            // Exhaustive — TypeScript should prevent reaching here given AnalyticsRangeKey.
            return { key: "30d", start: kolkataMidnightUtc(y, m, d - 30), end: todayEnd, prevStart: kolkataMidnightUtc(y, m, d - 60), prevEnd: kolkataMidnightUtc(y, m, d - 30), bucket: "day", label: "Last 30 Days" };
        }
    }
}

function parseKolkataDateString(s: string | undefined): Date | null {
    if (!s) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!match) return null;
    const [, yy, mm, dd] = match;
    return kolkataMidnightUtc(Number(yy), Number(mm) - 1, Number(dd));
}

function addKolkataDays(midnight: Date, days: number): Date {
    return new Date(midnight.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Safe percentage-change calculator — never divides by zero, never returns Infinity/NaN to a caller. */
export function percentChange(current: number, previous: number): { pct: number | null; direction: "up" | "down" | "flat" } {
    if (previous === 0) {
        if (current === 0) return { pct: 0, direction: "flat" };
        return { pct: null, direction: "up" }; // undefined magnitude — caller must render "New" not a %
    }
    const pct = ((current - previous) / previous) * 100;
    return { pct, direction: pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat" };
}
