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
        role: "Business Strategy, Marketing & Decision Leadership",
        pillar: "Strategy",
        image: "/founders/manish.png",
        color: "#FF5C1A",
        colorAlt: "#FF8C42",
        shortBio:
            "Manish reads the market before it moves. He built FoodKnock's brand identity from nothing and drives every decision that touches how customers see and trust us.",
        bio: [
            "Manish Kumar is the brand and business mind behind FoodKnock. Growing up in Rajasthan, he developed a sharp awareness of how local businesses succeed and where they fail — particularly in food, where customer trust is everything and most operators take it for granted.",
            "Before FoodKnock, Manish spent time studying how marketing and brand positioning actually work at the local level. He understood early that people don't just buy food — they buy the feeling that comes with it. That insight became the foundation of FoodKnock's entire customer experience.",
            "As co-founder, Manish owns the brand voice, marketing strategy, and the business decisions that shape FoodKnock's trajectory. He balances ambition with pragmatism — always asking whether a move actually serves the customer in Danta and Sikar, not just looks good on paper.",
        ],
        expertise: ["Brand Strategy", "Growth Marketing", "Customer Acquisition", "Business Development", "Market Positioning"],
        quote:
            "We're not building a food delivery app. We're building a brand people feel proud to order from — and that starts with every single detail.",
        social: {
            type: "instagram",
            label: "Instagram",
            href: "https://instagram.com/learnwith.manish",
        },
    },
    {
        id: "gaurav",
        name: "Gaurav Kumawat",
        role: "Technical Architecture, Web Platform Engineering & Digital Operations",
        pillar: "Technology",
        image: "/founders/gaurav.png",
        color: "#f59e0b",
        colorAlt: "#fbbf24",
        shortBio:
            "Gaurav built FoodKnock's entire platform from scratch — every screen, every API, every database query. Fast, reliable, and built to scale.",
        bio: [
            "Gaurav Kumawat is FoodKnock's technical co-founder. He designed and built the entire platform — from the customer-facing ordering experience to the backend infrastructure that makes it run reliably under real-world conditions.",
            "His engineering philosophy is simple: build it right the first time. FoodKnock's platform reflects this — a fast, mobile-first web app with real-time order tracking, loyalty points, live inventory management, and secure payment flows, all without the technical debt that cripples most early startups.",
            "Beyond the launch build, Gaurav handles all digital operations — monitoring platform health, shipping continuous improvements, and making sure FoodKnock's tech remains an advantage rather than a liability. He treats performance as a feature and reliability as non-negotiable.",
        ],
        expertise: ["Full-Stack Architecture", "Next.js & React", "Database Design", "API Engineering", "DevOps", "Performance Optimisation"],
        quote:
            "Great software is invisible. Users just feel that everything works perfectly. That's the only standard worth building to.",
        social: {
            type: "linkedin",
            label: "LinkedIn",
            href: "https://www.linkedin.com/in/gauravkumawatkirodiwal",
        },
    },
    {
        id: "ajay",
        name: "Ajay Sharma",
        role: "Ground Operations, Vendor Management & Packaging Systems",
        pillar: "Operations",
        image: "/founders/ajay.png",
        color: "#10b981",
        colorAlt: "#34d399",
        shortBio:
            "Ajay is the reason every order arrives exactly as it should. He owns the operations, the vendors, and the quality — the invisible work that makes FoodKnock trustworthy.",
        bio: [
            "Ajay Sharma runs everything that happens after a customer places an order. In food delivery, this is where most brands quietly fail — and it's why Ajay's role is central to FoodKnock's identity, not just its logistics.",
            "His domain covers vendor sourcing and relationships, ingredient quality standards, kitchen workflow coordination, and the packaging systems that ensure food arrives fresh and presented well. Every item that leaves FoodKnock's kitchen reflects decisions Ajay has made about quality, consistency, and reliability.",
            "Ajay has built the operational SOPs that hold FoodKnock to a consistent standard regardless of the day or volume. His vendor relationships are built on trust and transparency — which means better ingredients, more reliable supply, and fewer surprises for customers.",
        ],
        expertise: ["Supply Chain Management", "Vendor Partnerships", "Quality Control", "Packaging Systems", "Logistics", "Operational SOPs"],
        quote:
            "The food speaks for itself when the operations behind it are airtight. My job is to make sure nothing ever falls through the cracks.",
        social: {
            type: "instagram",
            label: "Instagram",
            href: "https://www.instagram.com/ajaysharma_2003",
        },
    },
];