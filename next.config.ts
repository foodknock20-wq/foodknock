import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    // PERF: unoptimized:true is INTENTIONAL and correct for this architecture.
    //
    // All Cloudinary images are pre-transformed by cdnImage() before the browser
    // fetches them (f_auto, q_auto:eco, fl_progressive, dpr_auto, w_{bucket},
    // c_limit). Cloudinary's CDN delivers the already-optimal image directly.
    //
    // Vercel's image optimizer would:
    //   1. Re-download the image from Cloudinary on the server
    //   2. Re-compress it (redundantly, at extra quota cost)
    //   3. Serve it from a Vercel edge URL
    //
    // Setting unoptimized:true eliminates all three steps, preserving Vercel's
    // image transformation quota for any future use cases that actually need it.
    //
    // Non-Cloudinary URLs (Unsplash fallback) are returned as-is by cdnImage()
    // and served directly from Unsplash's CDN — also correct, no quota impact.
    unoptimized: true,

    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },

  compress: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Phase 17.2 (F14): was "SAMEORIGIN" here while vercel.json set
          // "DENY" for the exact same header on the exact same path —
          // two different values for one header from two different
          // sources is undefined behavior across browsers (not merely a
          // "stricter wins" guarantee). No legitimate need for FoodKnock
          // to frame itself was found (Razorpay's checkout is a popup/
          // redirect flow, not an iframe of this origin), so this now
          // matches vercel.json's stricter DENY exactly — one value, one
          // source of truth in effect, not two disagreeing ones.
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;