// src/app/fonts.ts
//
// FoodKnock UI 2.0 — Phase 1: "Playfair Display" is referenced via inline
// style={{fontFamily: "'Playfair Display', Georgia, serif"}} in ~30
// existing components (Navbar, product cards, headings, modals) but was
// never actually loaded anywhere — no @font-face, no Google Fonts <link>,
// no next/font call — so every one of those inline styles has silently
// been falling back to Georgia. This self-hosts the font via next/font
// (zero added network dependency, zero layout shift, no new npm package)
// and exposes it as the --font-playfair CSS variable, which globals.css
// maps to the --font-display Tailwind token (font-display utility).
//
// This does not change any existing inline-style usage — those still
// render exactly as before, just now with the real face available instead
// of silently falling back.

import { Playfair_Display } from "next/font/google";

export const playfairDisplay = Playfair_Display({
    subsets: ["latin"],
    weight: ["700", "800", "900"],
    variable: "--font-playfair",
    display: "swap",
});
