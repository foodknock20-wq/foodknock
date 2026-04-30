import withPWA from "next-pwa";
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
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
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

const pwa = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",

  runtimeCaching: [
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
  ],
});

export default pwa(nextConfig);