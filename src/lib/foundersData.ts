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
        role: "Brand Strategy, Business Development & Customer Growth",
        pillar: "Business",
        image: "/founders/manish.png",
        color: "#FF5C1A",
        colorAlt: "#FF8C42",
        shortBio:
            "Manish reads the market before it moves. He built FoodKnock's brand identity from nothing, owns every customer-facing decision, and drives the vendor relationships and growth strategy that make FoodKnock trustworthy from the first order to the last.",
        bio: [
            "Manish Kumar is the business and brand mind behind FoodKnock. Growing up in Rajasthan alongside his brother and co-founder Gaurav, he developed a sharp awareness of how local businesses succeed and where they fail — particularly in food, where customer trust is everything and most operators take it for granted.",
            "Before FoodKnock, Manish spent time studying how marketing and brand positioning actually work at the local level. He understood early that people don't just buy food — they buy the feeling that comes with it. That insight became the foundation of FoodKnock's entire customer experience strategy, from how the brand speaks to how every order is sourced and presented.",
            "As co-founder, Manish owns brand strategy, business development, marketing, and the customer growth engine that shapes FoodKnock's trajectory. He builds and manages vendor relationships and partnerships — ensuring the ingredients and supply behind every order meet the standard the brand promises — and leads operations planning and expansion strategy as the business grows across Rajasthan.",
            "He treats every business decision as a customer decision. Vendor terms, expansion timing, partnership choices — all of it is filtered through one question: does this actually serve the person ordering in Danta and Sikar. That discipline, paired with an unwillingness to cut corners on quality, defines how Manish runs the business side of FoodKnock.",
        ],
        expertise: [
            "Brand Strategy",
            "Business Development",
            "Marketing",
            "Vendor Relations",
            "Customer Growth",
            "Operations Planning",
            "Business Vision",
            "Expansion Strategy",
            "Customer Experience",
            "Partnerships",
        ],
        quote:
            "We're not building a food delivery app. We're building a brand people feel proud to order from — and that starts with every single detail, from the vendors we choose to the moment an order arrives at the door.",
        social: {
            type: "instagram",
            label: "Instagram",
            href: "https://instagram.com/learnwith.manish",
        },
    },
    {
        id: "gaurav",
        name: "Gaurav Kumawat",
        role: "Founder & Full Stack Developer — Software Architecture & Product",
        pillar: "Technology",
        image: "/founders/gaurav.png",
        color: "#f59e0b",
        colorAlt: "#fbbf24",
        shortBio:
            "Gaurav built FoodKnock's entire platform from scratch — every screen, every API, every database query. As founder and full stack developer, he owns the architecture, the infrastructure, and the technical roadmap that keeps FoodKnock fast, secure, and ready to scale.",
        bio: [
            "Gaurav Kumawat is FoodKnock's founder and full stack developer. He designed and built the entire platform himself — from the customer-facing ordering experience to the backend systems that make it run reliably under real-world conditions. Every layer of the stack, frontend to database, carries his architecture.",
            "His engineering philosophy is simple: build it right the first time. FoodKnock's platform reflects this — a fast, mobile-first PWA with real-time order tracking, loyalty points, live inventory management, and secure payment flows, engineered with proper software architecture from day one rather than patched together under pressure.",
            "Gaurav's technical ownership spans backend engineering, frontend development, database design, infrastructure, and performance — alongside newer additions like AI integration and process automation that keep operations efficient as order volume grows. Security and reliability are treated as non-negotiable, not afterthoughts.",
            "Alongside his brother and co-founder Manish, Gaurav also shapes FoodKnock's product direction and technical vision — deciding what gets built next and how it should work. Where Manish defines the customer experience standard, Gaurav builds the systems and product that make it real. Together, the two of them run the entire company without a gap between strategy and execution.",
        ],
        expertise: [
            "Founder & Full Stack Developer",
            "Software Architecture",
            "Backend Engineering",
            "Frontend Development",
            "Mobile / PWA",
            "UI/UX",
            "Database Design",
            "Infrastructure",
            "Performance",
            "Security",
            "AI Integration",
            "Automation",
            "Product Development",
            "Technical Vision",
        ],
        quote:
            "Great software is invisible. Users just feel that everything works perfectly. I built FoodKnock so that trust — in the platform and in the food — never has to be a question.",
        social: {
            type: "linkedin",
            label: "LinkedIn",
            href: "https://www.linkedin.com/in/gauravkumawatkirodiwal",
        },
    },
];