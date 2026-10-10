"use client";

// src/components/search/SearchOverlay.tsx
//
// Pre-Phase 17 — Phase 3: Advanced Search. Premium, full-screen, top-
// anchored search overlay — deliberately NOT built on BottomSheet/Dialog
// (both are designed for bottom-anchored/centered confirmation-style
// content; a search experience needs a top search bar with results
// filling the rest of the viewport). Mirrors the SAME interaction rules
// those primitives already establish elsewhere in the app — Escape
// closes, body scroll locks while open, focus moves to the input on open
// — just in a layout shaped for search, not a second ad-hoc modal system.
//
// Submitting (Enter / "See all results") navigates to the EXISTING,
// working /menu?search=... experience (src/components/products/MenuClient.tsx)
// — this overlay owns only the fast typeahead/suggestion layer in front of
// it, not a second, duplicate results/pagination/filter page.

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Star, UtensilsCrossed, Search as SearchIcon } from "lucide-react";
import { cdnImage } from "@/lib/cdnImage";
import RecentSearches, { recordRecentSearch } from "@/components/products/RecentSearches";

type Suggestion = {
    _id: string;
    name: string;
    slug: string;
    image: string;
    price: number;
    category: string;
    rating: number | null;
    isAvailable: boolean;
    stock: number;
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

// Compact, shared result row — used for both query results and the
// empty-state discovery picks, so there is exactly one row implementation
// (spec: "reduce the visual footprint substantially", "~48-56px thumbnail").
function ResultList({ products, onSelect }: { products: Suggestion[]; onSelect: (slug: string) => void }) {
    return (
        <div className="space-y-0.5">
            {products.map((p) => (
                <button
                    key={p._id}
                    onClick={() => onSelect(p.slug)}
                    className="flex w-full items-center gap-2.5 rounded-fk-md px-1.5 py-1.5 text-left transition-colors hover:bg-fk-surface-interactive"
                >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-fk-sm border border-fk-border bg-fk-surface-interactive">
                        <img src={cdnImage(p.image, 80)} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[12.5px] font-bold leading-tight text-fk-text">{p.name}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-fk-text-tertiary">
                            <span className="truncate capitalize">{p.category}</span>
                            {typeof p.rating === "number" && p.rating > 0 && (
                                <span className="flex shrink-0 items-center gap-0.5"><Star size={8} className="fill-fk-gold text-fk-gold" /> {p.rating.toFixed(1)}</span>
                            )}
                            {(!p.isAvailable || p.stock <= 0) && <span className="shrink-0 font-bold text-fk-danger">Unavailable</span>}
                        </div>
                    </div>
                    <span className="shrink-0 text-[12.5px] font-black text-[var(--fk-accent)]">₹{p.price}</span>
                </button>
            ))}
        </div>
    );
}

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Suggestion[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [didYouMean, setDidYouMean] = useState<string | null>(null);
    const [searched, setSearched] = useState(false);

    // Pre-Phase 17 — Home/Search polish: a small set of real, bounded
    // "discovery" products/categories shown while the overlay is open and
    // the query is still empty — fetched ONCE per open (not on every
    // keystroke, not refetched while typing), from the SAME /api/search/suggest
    // endpoint (empty-q discovery branch) rather than a second API.
    const [discoveryProducts, setDiscoveryProducts] = useState<Suggestion[]>([]);
    const [discoveryCategories, setDiscoveryCategories] = useState<string[]>([]);
    const [discoveryLoading, setDiscoveryLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        document.body.style.overflow = "hidden";
        const timer = setTimeout(() => inputRef.current?.focus(), 50);
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handleKey);
        return () => {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKey);
            clearTimeout(timer);
        };
    }, [open, onClose]);

    // Fetches the empty-state discovery set exactly once per open — not on
    // every keystroke, not re-fetched while the overlay stays open.
    useEffect(() => {
        if (!open) return;
        setDiscoveryLoading(true);
        const controller = new AbortController();
        fetch("/api/search/suggest?q=", { signal: controller.signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!data?.success) return;
                setDiscoveryProducts(data.products);
                setDiscoveryCategories(data.categories);
            })
            .catch(() => {})
            .finally(() => setDiscoveryLoading(false));
        return () => controller.abort();
    }, [open]);

    // Reset to a clean idle state every time the overlay is reopened — a
    // render-phase state adjustment (React's documented pattern: bail out
    // before an extra paint), not an effect, so there's no setState-in-
    // effect cascade for something that's really just "derive this from a
    // prop change". Same pattern already used by AdminListSearchBar.tsx.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setQuery("");
            setProducts([]);
            setCategories([]);
            setDidYouMean(null);
            setSearched(false);
        }
    }

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        const trimmed = query.trim();
        // Too short to search yet — the render below already gates the
        // suggestions/results UI on `showIdle`, so stale leftover state from
        // a previous longer query simply never renders; nothing to reset
        // here, and no fetch to debounce.
        if (trimmed.length < MIN_QUERY_LENGTH) return;

        setLoading(true);
        const controller = new AbortController();
        debounceRef.current = setTimeout(() => {
            fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                    if (!data?.success) return;
                    setProducts(data.products);
                    setCategories(data.categories);
                    setDidYouMean(data.didYouMean);
                    setSearched(true);
                })
                .catch((err) => { if (err?.name !== "AbortError") setSearched(true); })
                .finally(() => setLoading(false));
        }, DEBOUNCE_MS);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); controller.abort(); };
    }, [query]);

    const goToResults = useCallback((term: string) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        recordRecentSearch(trimmed);
        onClose();
        router.push(`/menu?search=${encodeURIComponent(trimmed)}`);
    }, [onClose, router]);

    const goToProduct = useCallback((slug: string) => {
        recordRecentSearch(query.trim());
        onClose();
        router.push(`/menu/${slug}`);
    }, [onClose, query, router]);

    const goToCategory = useCallback((category: string) => {
        recordRecentSearch(query.trim());
        onClose();
        router.push(`/menu?category=${encodeURIComponent(category)}`);
    }, [onClose, query, router]);

    if (!open) return null;

    const trimmed = query.trim();
    const showIdle = trimmed.length < MIN_QUERY_LENGTH;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-fk-bg" role="dialog" aria-modal="true" aria-label="Search FoodKnock">
            {/* Top bar */}
            <div className="flex shrink-0 items-center gap-2 border-b border-fk-border bg-fk-surface-elevated px-3 py-3">
                <button
                    onClick={onClose}
                    aria-label="Close search"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-fk-md text-fk-text-secondary transition-colors hover:bg-fk-surface-interactive hover:text-fk-text"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="relative flex-1">
                    <SearchIcon size={14} strokeWidth={2.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fk-text-tertiary" />
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") goToResults(query); }}
                        placeholder="Search for burgers, pizza, fries…"
                        aria-label="Search FoodKnock"
                        className="w-full rounded-fk-lg border border-fk-border bg-fk-surface-interactive py-2.5 pl-9 pr-11 text-[14px] text-fk-text placeholder:text-fk-text-tertiary focus:border-[var(--fk-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--fk-accent)]/20"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            aria-label="Clear search"
                            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-fk-text-tertiary transition-colors hover:text-[var(--fk-accent)]"
                        >
                            <span className="flex h-5 w-5 items-center justify-center rounded-fk-pill bg-fk-surface-elevated">
                                <X size={12} strokeWidth={3} />
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                {showIdle && (
                    <div className="pb-4">
                        <p className="px-4 pt-3 text-[13px] font-bold text-fk-text-secondary">
                            Search something delicious
                        </p>

                        <RecentSearches onSelect={(term) => { setQuery(term); }} />

                        {discoveryCategories.length > 0 && (
                            <div className="px-3 pb-1 pt-1 md:px-8">
                                <p className="mb-1.5 px-1 text-[10.5px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                                    Browse categories
                                </p>
                                <div className="flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                                    {discoveryCategories.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => goToCategory(c)}
                                            className="shrink-0 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-3 py-1.5 text-[11.5px] font-bold capitalize text-fk-text-secondary transition-colors hover:border-[var(--fk-accent)]/40 hover:text-[var(--fk-accent)]"
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(discoveryLoading || discoveryProducts.length > 0) && (
                            <div className="px-3 pt-2 md:px-8">
                                <p className="mb-1 px-1 text-[10.5px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                                    Quick picks
                                </p>
                                {discoveryLoading ? (
                                    <div className="space-y-1 px-1">
                                        {[0, 1, 2].map((i) => (
                                            <div key={i} className="h-11 animate-pulse rounded-fk-md bg-fk-surface-interactive" />
                                        ))}
                                    </div>
                                ) : (
                                    <ResultList products={discoveryProducts} onSelect={goToProduct} />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {!showIdle && loading && (
                    <div className="space-y-2 px-4 py-4">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-11 animate-pulse rounded-fk-md bg-fk-surface-interactive" />
                        ))}
                    </div>
                )}

                {!showIdle && !loading && searched && (
                    <div className="px-4 py-3">
                        {didYouMean && (
                            <button
                                onClick={() => setQuery(didYouMean)}
                                className="mb-3 flex items-center gap-1.5 rounded-fk-md border border-fk-border bg-fk-gold-soft px-3 py-2 text-[12.5px] font-bold text-fk-text"
                            >
                                Did you mean <span className="capitalize text-[var(--fk-accent)]">{didYouMean}</span>?
                            </button>
                        )}

                        {categories.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-1.5">
                                {categories.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => goToCategory(c)}
                                        className="rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3 py-1.5 text-[11.5px] font-bold text-[var(--fk-accent)]"
                                    >
                                        Browse {c}
                                    </button>
                                ))}
                            </div>
                        )}

                        {products.length > 0 ? (
                            <>
                                <ResultList products={products} onSelect={goToProduct} />
                                <button
                                    onClick={() => goToResults(query)}
                                    className="mt-3 w-full rounded-fk-pill border border-fk-border bg-fk-surface-selected py-2.5 text-[12.5px] font-black text-[var(--fk-accent)]"
                                >
                                    See all results for &quot;{trimmed}&quot;
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center px-6 py-14 text-center">
                                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-fk-lg bg-fk-surface-selected">
                                    <UtensilsCrossed size={26} className="text-[var(--fk-accent)]" strokeWidth={1.75} />
                                </div>
                                <p className="text-[15px] font-black text-fk-text">No tasty matches yet.</p>
                                <p className="mt-1.5 max-w-[260px] text-[12.5px] text-fk-text-secondary">
                                    Try searching for burgers, pizza, fries or desserts.
                                </p>
                                <button
                                    onClick={() => { onClose(); router.push("/menu"); }}
                                    className="mt-5 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-5 py-2.5 text-[12.5px] font-black text-white"
                                >
                                    Explore our menu
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
