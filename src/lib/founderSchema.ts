// src/lib/founderSchema.ts
const BASE_URL = "https://www.foodknock.com";

export const founderJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "AboutPage",
            "@id": `${BASE_URL}/founders#webpage`,
            url: `${BASE_URL}/founders`,
            name: "Our Founders — FoodKnock",
            description:
                "Meet Manish Kumar and Gaurav Kumawat — the two co-founders of FoodKnock, Rajasthan's premium online food delivery platform built in Danta, Sikar.",
            isPartOf: { "@id": `${BASE_URL}/#website` },
            about: { "@id": `${BASE_URL}/#organization` },
            inLanguage: "en-IN",
        },
        {
            "@type": "Organization",
            "@id": `${BASE_URL}/#organization`,
            name: "FoodKnock",
            url: BASE_URL,
            logo: {
                "@type": "ImageObject",
                url: `${BASE_URL}/icon-512.png`,
                width: 512,
                height: 512,
            },
            description:
                "FoodKnock is a premium online food delivery platform based in Danta, Rajasthan. Fresh burgers, pizza, momos, shakes, juices and ice cream delivered fast.",
            email: "foodknock20@gmail.com",
            telephone: "+91-97849-63648",
            foundingDate: "2024",
            address: {
                "@type": "PostalAddress",
                addressLocality: "Danta",
                addressRegion: "Rajasthan",
                postalCode: "332403",
                addressCountry: "IN",
            },
            founder: [
                { "@id": `${BASE_URL}/founders#manish-kumar` },
                { "@id": `${BASE_URL}/founders#gaurav-kumawat` },
            ],
            sameAs: [
                "https://instagram.com/food__knock",
            ],
        },
        {
            "@type": "Person",
            "@id": `${BASE_URL}/founders#manish-kumar`,
            name: "Manish Kumar",
            givenName: "Manish",
            familyName: "Kumar",
            jobTitle: "Co-Founder & Business Strategy Lead",
            description:
                "Manish Kumar is the co-founder of FoodKnock leading brand strategy, marketing, business operations, and customer experience. He shapes how FoodKnock is perceived, manages vendor relationships, and drives customer growth across Rajasthan.",
            image: `${BASE_URL}/founders/manish.png`,
            url: `${BASE_URL}/founders#manish-kumar`,
            worksFor: { "@id": `${BASE_URL}/#organization` },
            knowsAbout: [
                "Brand Strategy",
                "Marketing",
                "Business Development",
                "Customer Acquisition",
                "Market Positioning",
                "Vendor Relationships",
                "Customer Experience",
                "Business Operations",
            ],
            sameAs: ["https://instagram.com/learnwith.manish"],
        },
        {
            "@type": "Person",
            "@id": `${BASE_URL}/founders#gaurav-kumawat`,
            name: "Gaurav Kumawat",
            givenName: "Gaurav",
            familyName: "Kumawat",
            jobTitle: "Co-Founder & Technical Lead",
            description:
                "Gaurav Kumawat is the co-founder of FoodKnock who architected and built the entire platform. He leads all technical decisions including full-stack development, database design, platform operations, process automation, and systems infrastructure.",
            image: `${BASE_URL}/founders/gaurav.png`,
            url: `${BASE_URL}/founders#gaurav-kumawat`,
            worksFor: { "@id": `${BASE_URL}/#organization` },
            knowsAbout: [
                "Next.js",
                "Full-Stack Engineering",
                "Database Architecture",
                "DevOps",
                "API Design",
                "Platform Operations",
                "Process Automation",
                "Systems Management",
                "Performance Optimization",
            ],
            sameAs: ["https://www.linkedin.com/in/gauravkumawatkirodiwal"],
        },
    ],
};
