// src/lib/categoryConfig.ts
//
// FoodKnock UI 2.0 — Phase 2 bug fix. Server/Client boundary fix: this
// static category display config (thumbnail image/accent/label per
// category) used to live inside src/components/products/CategorySlider.tsx,
// which has a top-level "use client" directive. Server Components
// (src/components/home/CategoryRail.tsx, src/app/(main)/page.tsx) cannot
// import a plain value/function from a "use client" module — only render
// it as JSX — which caused the runtime error:
//   "Attempted to call getCfg() from the server but getCfg is on the client."
//
// Fix: this config + the pure getCfg() helper now live in a neutral,
// server-safe module with no React/client dependency at all (no "use
// client", no hooks) — safe to import from both Server Components and
// Client Components alike. CategorySlider.tsx now imports from here
// instead of defining its own copy — single source of truth, not
// duplicated.

export type CategoryDisplayConfig = { image: string; accent: string; label: string };

export const CAT_CONFIG: Record<string, CategoryDisplayConfig> = {
    all: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773952907/foodknock/products/ko6diantlifvrv16fdal.jpg",
        accent: "#f97316",
        label: "All",
    },
    combos: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953355/ChatGPT_Image_Mar_20_2026_02_18_53_AM_g7hert.png",
        accent: "#e11d48",
        label: "Combos",
    },
    pizza: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773931399/foodknock/products/xhlywcqzo0fgwwdxa8id.jpg",
        accent: "#f97316",
        label: "Pizza",
    },
    "special pizza": {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1786609824/ChatGPT_Image_Aug_13_2026_02_00_09_PM_vkspve.png",
        accent: "#f97316",
        label: "Special Pizza",
    },
    burger: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773925722/foodknock/products/ochghfubzkruolrb4ggu.jpg",
        accent: "#d97706",
        label: "Burger",
    },
    sandwich: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773932309/foodknock/products/ppefuhohguvfmd91lbjf.jpg",
        accent: "#16a34a",
        label: "Sandwich",
    },
    coffee: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773931773/foodknock/products/dfpzqgcjxmnlhjuinxpo.jpg",
        accent: "#92400e",
        label: "Coffee",
    },
    juice: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773931773/foodknock/products/dfpzqgcjxmnlhjuinxpo.jpg",
        accent: "#16a34a",
        label: "Juice",
    },
    shake: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773931823/foodknock/products/q1m2ysvg1ia2offh5mgn.jpg",
        accent: "#2563eb",
        label: "Shake",
    },
    "ice cream": {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953301/Screenshot_2026-03-20_021758_ecb6v0.png",
        accent: "#a855f7",
        label: "Ice Cream",
    },
    momos: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773930261/foodknock/products/rxrmisuiklzwyn9oldwe.jpg",
        accent: "#ea580c",
        label: "Momos",
    },
    fries: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773929303/foodknock/products/isipjpgf7klg2vtrtzy3.jpg",
        accent: "#ca8a04",
        label: "Fries",
    },
    pasta: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773930445/foodknock/products/criyulvvdzaqoxv57vvi.jpg",
        accent: "#ea580c",
        label: "Pasta",
    },
    noodles: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953447/Let_s_make_crispy_chow_mein_noodles_tossed_in_a_m1ewd8.jpg",
        accent: "#d97706",
        label: "Noodles",
    },
    maggi: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773929812/foodknock/products/a90ubocuhw8swmjaovom.jpg",
        accent: "#b45309",
        label: "Maggi",
    },
    tea: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953504/Qatar_s_most_loved_tea_strong_black_tea_brewed_osouhe.jpg",
        accent: "#15803d",
        label: "Tea",
    },
    snacks: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773930661/foodknock/products/w59zxcc0mmclexgh9upl.jpg",
        accent: "#f97316",
        label: "Snacks",
    },
    chinese: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773928655/foodknock/products/ouvxufr7bapazmgfwdl8.jpg",
        accent: "#dc2626",
        label: "Chinese",
    },
    pavbhaji: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773925149/foodknock/products/vgowppmw8u8awprv4sjk.jpg",
        accent: "#ea580c",
        label: "Pav Bhaji",
    },
    patties: {
        image: "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773925644/foodknock/products/us1vuswyw1qn65qa0zio.jpg",
        accent: "#16a34a",
        label: "Patties",
    },
};

export const FALLBACK_IMAGE =
    "https://res.cloudinary.com/dr3usvmyr/image/upload/v1773953868/WhatsApp_Image_2026-03-15_at_13.17.10-removebg-preview_ksiduq.png";

export const getCfg = (cat: string): CategoryDisplayConfig =>
    CAT_CONFIG[cat.toLowerCase()] ?? { image: FALLBACK_IMAGE, accent: "#f97316", label: cat };
