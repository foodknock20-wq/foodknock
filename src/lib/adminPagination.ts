// src/lib/adminPagination.ts
//
// Phase 15A — THE single server-side pagination helper for Admin 2.0 list
// pages. Every admin list route/page should parse its page/limit through
// `parseAdminPagination()` and build its response meta through
// `buildPaginationMeta()` — one shape, reused everywhere, so the shared
// <Pagination> UI component (src/components/admin/shared/Pagination.tsx)
// never needs a per-section adapter.
//
// SAFETY: the client-provided `limit` is NEVER trusted as-is — it is
// always clamped to `maxLimit`. This is the server-side enforcement the
// Phase 15A pagination audit requires; a client passing `limit=100000`
// must never be able to force an unbounded Mongo query.

export interface AdminPaginationParams {
    page:  number;
    limit: number;
    skip:  number;
}

export interface AdminPaginationMeta {
    page:            number;
    limit:           number;
    total:           number;
    totalPages:      number;
    hasNextPage:     boolean;
    hasPreviousPage: boolean;
}

/**
 * Parses `page`/`limit` from a searchParams-like source (URLSearchParams or
 * the plain object Next.js server components receive). `defaultLimit` is
 * the page size used when the caller doesn't specify one; `maxLimit` is the
 * hard server-side ceiling — always enforced regardless of what was asked.
 */
export function parseAdminPagination(
    searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
    opts: { defaultLimit?: number; maxLimit?: number } = {}
): AdminPaginationParams {
    const defaultLimit = opts.defaultLimit ?? 25;
    const maxLimit = opts.maxLimit ?? 100;

    const get = (key: string): string | undefined => {
        if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? undefined;
        const v = searchParams[key];
        return Array.isArray(v) ? v[0] : v;
    };

    const rawPage = parseInt(get("page") ?? "1", 10);
    const rawLimit = parseInt(get("limit") ?? String(defaultLimit), 10);

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Math.min(
        maxLimit,
        Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit
    );

    return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginationMeta(total: number, page: number, limit: number): AdminPaginationMeta {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const clampedPage = Math.min(page, totalPages);
    return {
        page: clampedPage,
        limit,
        total,
        totalPages,
        hasNextPage: clampedPage < totalPages,
        hasPreviousPage: clampedPage > 1,
    };
}
