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
                "Meet Manish Kumar, Gaurav Kumawat, and Ajay Sharma — the co-founders of FoodKnock, Rajasthan's premium online food delivery platform.",
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
                { "@id": `${BASE_URL}/founders#ajay-sharma` },
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
                "Manish Kumar is the co-founder of FoodKnock leading brand strategy, marketing, and business development. He shapes how FoodKnock is perceived and drives customer growth across Rajasthan.",
            image: `${BASE_URL}/founders/manish.png`,
            url: `${BASE_URL}/founders#manish-kumar`,
            worksFor: { "@id": `${BASE_URL}/#organization` },
            knowsAbout: [
                "Brand Strategy",
                "Marketing",
                "Business Development",
                "Customer Acquisition",
                "Market Positioning",
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
                "Gaurav Kumawat is the co-founder of FoodKnock who architected and built the entire platform. He leads all technical decisions including full-stack development, database design, and digital operations.",
            image: `${BASE_URL}/founders/gaurav.png`,
            url: `${BASE_URL}/founders#gaurav-kumawat`,
            worksFor: { "@id": `${BASE_URL}/#organization` },
            knowsAbout: [
                "Next.js",
                "Full-Stack Engineering",
                "Database Architecture",
                "DevOps",
                "API Design",
                "Performance Optimization",
            ],
            sameAs: ["https://www.linkedin.com/in/gauravkumawatkirodiwal"],
        },
        {
            "@type": "Person",
            "@id": `${BASE_URL}/founders#ajay-sharma`,
            name: "Ajay Sharma",
            givenName: "Ajay",
            familyName: "Sharma",
            jobTitle: "Co-Founder & Operations Lead",
            description:
                "Ajay Sharma is the co-founder of FoodKnock managing day-to-day operations, vendor relationships, food quality standards, and packaging systems that make every order reliable.",
            image: `${BASE_URL}/founders/ajay.png`,
            url: `${BASE_URL}/founders#ajay-sharma`,
            worksFor: { "@id": `${BASE_URL}/#organization` },
            knowsAbout: [
                "Supply Chain Management",
                "Vendor Management",
                "Quality Control",
                "Food Operations",
                "Packaging Systems",
                "Logistics",
            ],
            sameAs: ["https://www.instagram.com/ajaysharma_2003"],
        },
    ],
};