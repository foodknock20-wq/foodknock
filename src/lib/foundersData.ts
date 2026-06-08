// src/lib/founderData.ts
export type Founder = {
    id: string;
    name: string;
    role: string;
    pillar: string;
    image: string;
    color: string;
    colorAlt: string;
    shortBio: string;
    bio: string[];
    expertise: string[];
    quote: string;
    social: {
        type: "instagram" | "linkedin";
        label: string;
        href: string;
    };
};

export const founders: Founder[] = [
    {
        id: "manish",
        name: "Manish Kumar",
        role: "Brand Strategy, Business Operations & Customer Experience Leadership",
        pillar: "Strategy",
        image: "/founders/manish.png",
        color: "#FF5C1A",
        colorAlt: "#FF8C42",
        shortBio:
            "Manish reads the market before it moves. He built FoodKnock's brand identity from nothing, owns every customer-facing decision, and drives the operational standards that make FoodKnock trustworthy from the first order to the last.",
        bio: [
            "Manish Kumar is the brand, business, and operations mind behind FoodKnock. Growing up in Rajasthan, he developed a sharp awareness of how local businesses succeed and where they fail — particularly in food, where customer trust is everything and most operators take it for granted.",
            "Before FoodKnock, Manish spent time studying how marketing and brand positioning actually work at the local level. He understood early that people don't just buy food — they buy the feeling that comes with it. That insight became the foundation of FoodKnock's entire customer experience strategy, and it extends far beyond marketing into how every order is sourced, packaged, and delivered.",
            "As co-founder, Manish owns the brand voice, marketing strategy, and business development decisions that shape FoodKnock's trajectory. He also oversees vendor relationships and supply partnerships — ensuring the ingredients that go into every order meet the quality standard the brand promises. He balances ambition with pragmatism, always asking whether a move actually serves the customer in Danta and Sikar, not just looks good on paper.",
            "Operationally, Manish built the customer experience framework that holds FoodKnock to a consistent standard regardless of day or volume. His vendor relationships are built on trust and transparency — which means better ingredients, more reliable supply, and fewer surprises for customers. He treats every operational detail as a brand decision, because at FoodKnock, it is.",
        ],
        expertise: [
            "Brand Strategy",
            "Growth Marketing",
            "Customer Acquisition",
            "Business Development",
            "Vendor Relationships",
            "Customer Experience",
            "Market Positioning",
            "Business Operations",
        ],
        quote:
            "We're not building a food delivery app. We're building a brand people feel proud to order from — and that starts with every single detail, from the ingredients we source to the moment the order arrives at the door.",
        social: {
            type: "instagram",
            label: "Instagram",
            href: "https://instagram.com/learnwith.manish",
        },
    },
    {
        id: "gaurav",
        name: "Gaurav Kumawat",
        role: "Technical Architecture, Platform Engineering & Digital Operations",
        pillar: "Technology",
        image: "/founders/gaurav.png",
        color: "#f59e0b",
        colorAlt: "#fbbf24",
        shortBio:
            "Gaurav built FoodKnock's entire platform from scratch — every screen, every API, every database query. He keeps the systems running, the operations optimised, and the platform ahead of what the business needs next.",
        bio: [
            "Gaurav Kumawat is FoodKnock's technical co-founder. He designed and built the entire platform — from the customer-facing ordering experience to the backend infrastructure that makes it run reliably under real-world conditions. His fingerprints are on every layer of the stack.",
            "His engineering philosophy is simple: build it right the first time. FoodKnock's platform reflects this — a fast, mobile-first web app with real-time order tracking, loyalty points, live inventory management, and secure payment flows, all without the technical debt that cripples most early startups.",
            "Beyond the core platform, Gaurav manages the full scope of FoodKnock's digital and platform operations. This includes monitoring system health, shipping continuous improvements, coordinating kitchen workflow systems, and building the process automation that keeps operations consistent at scale. He treats performance as a feature and reliability as non-negotiable.",
            "Gaurav also owns FoodKnock's operational SOPs from a systems perspective — building the digital infrastructure that enforces quality and consistency across every order. Where Manish defines the customer experience standard, Gaurav builds the systems that make it repeatable. Together, they run the entire company without a gap between strategy and execution.",
        ],
        expertise: [
            "Technology Leadership",
            "Digital Product Development",
            "Platform Innovation",
            "Operational Systems",
            "Customer Experience Technology",
            "Order Management Systems",
            "Automation & Efficiency",
            "Business Infrastructure",
            "Scalable Platform Operations",
        ],

        quote:
            "Great software is invisible. Users just feel that everything works perfectly. The same is true of great operations — when the systems are right, nothing falls through the cracks.",
        social: {
            type: "linkedin",
            label: "LinkedIn",
            href: "https://www.linkedin.com/in/gauravkumawatkirodiwal",
        },
    },
];
