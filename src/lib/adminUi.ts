// src/lib/adminUi.ts
//
// Phase 15E.5 — FoodKnock Operations admin design system. Centralized
// semantic button/text className constants, matching the CSS tokens in
// globals.css (--admin-*). Audit finding: several admin buttons used
// `text-stone-600`/`text-stone-700` as their DEFAULT (non-disabled,
// non-hover) label color — on the dark graphite surfaces that resolves to
// a genuinely low-contrast, "looks disabled" button even though it's a
// perfectly normal, clickable action (e.g. the Products form's Cancel
// button, the Review Rewards Delete/No buttons). The fix is semantic, not
// per-pixel: a button's DEFAULT state must use ADMIN_TEXT or
// ADMIN_TEXT_MUTED (never ADMIN_TEXT_SUBTLE) — subtle is reserved for
// non-interactive labels/metadata. New/updated admin buttons should import
// from here instead of re-guessing a stone-NNN shade.

/** Primary readable text — labels on active, non-ghost controls. */
export const ADMIN_TEXT = "text-stone-200";
/** Secondary but still clearly legible — default state of ghost/secondary buttons. */
export const ADMIN_TEXT_MUTED = "text-stone-400";
/** De-emphasized — table headers, metadata, captions. NEVER a button's default label color. */
export const ADMIN_TEXT_SUBTLE = "text-stone-600";

/** Secondary/ghost action button — bordered, transparent, legible default text (not stone-600/700). */
export const ADMIN_BTN_GHOST =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-[13px] font-semibold text-stone-300 transition-all hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-stone-100 disabled:opacity-50 disabled:cursor-not-allowed";

/** Primary accent action button — amber/orange, dark text (already high-contrast on a bright accent). */
export const ADMIN_BTN_PRIMARY =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-[13px] font-bold text-stone-950 shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 disabled:opacity-55 disabled:cursor-not-allowed";

/** Destructive action button — clear danger state, legible default text. */
export const ADMIN_BTN_DANGER =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-[13px] font-bold text-rose-300 transition-all hover:border-rose-500/45 hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-50 disabled:cursor-not-allowed";

/** Success/confirm action button. */
export const ADMIN_BTN_SUCCESS =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-[13px] font-bold text-emerald-300 transition-all hover:border-emerald-500/45 hover:bg-emerald-500/20 hover:text-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed";
