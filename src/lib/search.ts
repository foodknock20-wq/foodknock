// src/lib/search.ts
//
// Pre-Phase 17 — Phase 3: Advanced Search ranking engine. Runs entirely
// server-side over a single bounded Product query (see
// src/app/api/search/suggest/route.ts) — no external search service, no
// AI calls, deterministic and cheap. Appropriate for FoodKnock's actual
// scale (one cloud kitchen's catalog, not a multi-vendor marketplace): a
// single-digit-millisecond in-memory rank over a few hundred products at
// most is far simpler and cheaper than a MongoDB text index or Atlas
// Search, and keeps every ranking rule easy to read/tune in one place.
//
// Typo tolerance / Hinglish support is a SMALL, CONTROLLED alias table —
// not a dictionary, not AI-generated. Aliases only ever influence MATCHING
// against products that genuinely exist; they never fabricate a result.

export type SearchableProduct = {
    _id: string;
    name: string;
    slug: string;
    image: string;
    price: number;
    compareAtPrice?: number | null;
    category: string;
    tags?: string[];
    description?: string;
    rating?: number | null;
    reviewCount?: number;
    isAvailable: boolean;
    stock: number;
};

export type RankedSearchProduct = SearchableProduct & { _score: number };

const MAX_QUERY_LENGTH = 60;

/** Trim, collapse whitespace, lowercase, strip anything that isn't a safe search character. Bounded length. */
export function normalizeQuery(raw: string): string {
    return raw
        .slice(0, MAX_QUERY_LENGTH)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function tokenize(normalized: string): string[] {
    return normalized.split(/[\s-]+/).filter(Boolean);
}

// Small, controlled alias table — common food-ordering typos/Hinglish
// variants mapped to a canonical term. Only ever used to ADD a matching
// pass; never used to invent a product that doesn't exist in the catalog.
const ALIASES: Record<string, string> = {
    "cold drink": "soft drink",
    "colddrink": "soft drink",
    "coke": "cola",
    "cocacola": "cola",
    "coca cola": "cola",
    "choco": "chocolate",
    "chco": "chocolate",
    "piza": "pizza",
    "pizaa": "pizza",
    "burgar": "burger",
    "burgur": "burger",
    "frys": "fries",
    "frise": "fries",
    "chiken": "chicken",
    "panir": "paneer",
    "panner": "paneer",
    "sandwitch": "sandwich",
    "sandwhich": "sandwich",
    "alo": "aloo",
    "allo": "aloo",
    "mo mo": "momos",
    "momo": "momos",
    "nodles": "noodles",
    "noddles": "noodles",
};

function resolveAlias(token: string): string | null {
    return ALIASES[token] ?? null;
}

/** Bounded Levenshtein distance — only ever called on short tokens against a small candidate vocabulary (see buildTypoCorrection), never on arbitrary-length strings. */
function editDistance(a: string, b: string): number {
    if (Math.abs(a.length - b.length) > 3) return 99; // cheap short-circuit, never meaningfully close
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

function scoreProduct(product: SearchableProduct, qNorm: string, qTokens: string[]): number {
    const name = product.name.toLowerCase();
    const category = product.category.toLowerCase();
    const tags = (product.tags ?? []).map((t) => t.toLowerCase());
    const description = (product.description ?? "").toLowerCase();

    let score = 0;

    if (name === qNorm) score = Math.max(score, 1000);
    else if (name.startsWith(qNorm)) score = Math.max(score, 900);
    else if (new RegExp(`\\b${qTokens.map((t) => escapeRegex(t)).join("|")}\\b`).test(name)) score = Math.max(score, 800);
    else if (name.includes(qNorm)) score = Math.max(score, 700);

    if (category === qNorm || category.startsWith(qNorm)) score = Math.max(score, 600);
    if (tags.some((t) => t === qNorm || t.includes(qNorm))) score = Math.max(score, 550);

    // Alias pass — only applied if nothing above matched yet, and only
    // ever matches against the SAME real fields (never fabricates data).
    if (score === 0) {
        for (const token of qTokens) {
            const canonical = resolveAlias(token) ?? resolveAlias(qNorm);
            if (canonical && (name.includes(canonical) || category.includes(canonical) || tags.some((t) => t.includes(canonical)))) {
                score = Math.max(score, 500);
            }
        }
    }

    if (score === 0 && description.includes(qNorm)) score = Math.max(score, 300);

    return score;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Secondary, availability-first tie-breaker within the same score tier. */
function tieBreak(a: RankedSearchProduct, b: RankedSearchProduct): number {
    const aOrderable = a.isAvailable && a.stock > 0;
    const bOrderable = b.isAvailable && b.stock > 0;
    if (aOrderable !== bOrderable) return aOrderable ? -1 : 1;
    const aRating = a.rating ?? -1;
    const bRating = b.rating ?? -1;
    if (aRating !== bRating) return bRating - aRating;
    return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
}

/**
 * Bounded edit-distance fallback — only runs when direct/alias matching
 * found ZERO results, and only compares the query against each product's
 * first name-token (not every substring), so the cost stays O(products).
 */
function buildTypoCorrection(products: SearchableProduct[], qNorm: string): { corrected: string; matches: SearchableProduct[] } | null {
    if (qNorm.length < 3) return null;

    let best: { word: string; distance: number } | null = null;
    const candidateWords = new Set<string>();
    for (const p of products) {
        for (const w of tokenize(p.name.toLowerCase())) candidateWords.add(w);
        candidateWords.add(p.category.toLowerCase());
    }

    for (const word of candidateWords) {
        if (Math.abs(word.length - qNorm.length) > 2) continue;
        const d = editDistance(qNorm, word);
        const threshold = qNorm.length <= 4 ? 1 : 2;
        if (d <= threshold && (!best || d < best.distance)) best = { word, distance: d };
    }

    if (!best) return null;

    const matches = products.filter((p) =>
        p.name.toLowerCase().includes(best!.word) || p.category.toLowerCase() === best!.word
    );
    if (matches.length === 0) return null;

    return { corrected: best.word, matches };
}

export type SearchResult = {
    products: RankedSearchProduct[];
    matchedCategories: string[];
    didYouMean: string | null;
};

export function searchProducts(products: SearchableProduct[], rawQuery: string, limit = 8): SearchResult {
    const qNorm = normalizeQuery(rawQuery);
    if (!qNorm) return { products: [], matchedCategories: [], didYouMean: null };

    const qTokens = tokenize(qNorm);

    const scored = products
        .map((p) => ({ ...p, _score: scoreProduct(p, qNorm, qTokens) }))
        .filter((p) => p._score > 0);

    let result = scored;
    let didYouMean: string | null = null;

    if (result.length === 0) {
        const typo = buildTypoCorrection(products, qNorm);
        if (typo) {
            didYouMean = typo.corrected;
            result = typo.matches.map((p) => ({ ...p, _score: 200 }));
        }
    }

    result.sort((a, b) => (b._score !== a._score ? b._score - a._score : tieBreak(a, b)));

    const categories = Array.from(new Set(products.map((p) => p.category)))
        .filter((c) => {
            const cl = c.toLowerCase();
            return cl === qNorm || cl.startsWith(qNorm) || (resolveAlias(qNorm) && cl.includes(resolveAlias(qNorm)!));
        })
        .slice(0, 2);

    return { products: result.slice(0, limit), matchedCategories: categories, didYouMean };
}
