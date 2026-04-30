/**
 * cdnImage — Production-safe Cloudinary URL transformer.
 *
 * For Cloudinary URLs: injects a compact transformation string into the upload
 * path so the browser receives an already-optimised image directly from
 * Cloudinary's CDN, bypassing Vercel's image optimizer entirely.
 *
 * Transformation choices:
 *   f_auto        — serve WebP/AVIF automatically per browser support
 *   q_auto:eco    — Cloudinary's eco preset; lower bandwidth than :good,
 *                   visually indistinguishable for food-card thumbnails
 *   fl_progressive — progressive JPEG rendering for faster perceived load
 *   dpr_auto      — serve 2× on retina without a separate URL
 *   w_{bucket}    — width capped at the nearest 100-px bucket so multiple
 *                   component sizes share the same CDN cache entry
 *   c_limit       — never upscales; never crops — safe for all aspect ratios
 *
 * For non-Cloudinary URLs (Unsplash, local dev): returned as-is.
 *
 * @param url  Original image URL
 * @param w    Target width in pixels (default 500); bucketed to nearest 100
 */
export function cdnImage(url: string, w = 500): string {
  if (!url) return "";

  if (url.includes("res.cloudinary.com")) {
    // Guard: don't double-inject if transformations already present
    if (url.includes("/upload/f_auto")) return url;

    // Bucket width to the nearest 100 px — maximises CDN cache hits across
    // the card sizes (400 px thumbnail, 800 px detail, etc.)
    const bucket = Math.ceil(w / 100) * 100;

    return url.replace(
      "/upload/",
      `/upload/f_auto,q_auto:eco,fl_progressive,dpr_auto,w_${bucket},c_limit/`
    );
  }

  return url;
}