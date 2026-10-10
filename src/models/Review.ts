import { Schema, model, models } from "mongoose";

// Phase 17.2 (F5/F16): previously `isApproved` defaulted to true, so any
// unauthenticated POST /api/reviews/route.ts submission went instantly
// live under any attacker-chosen userName — impersonation/brand-abuse
// risk, mitigated only by a 10/hr/IP rate limit. Submission itself stays
// open (preserving the existing, deliberate "anonymous testimonial, no
// login required" product decision — see that route's own comments) but
// publication now requires the admin moderation step that already exists
// (PATCH /api/reviews/[id]).
const ReviewSchema = new Schema(
  {
    userName: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
    isApproved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Matches GET /api/reviews/route.ts's actual query shape exactly
// (filter on isApproved, sort by createdAt desc) — previously this
// collection had no indexes at all, meaning every list call was a full
// collection scan + in-memory sort.
ReviewSchema.index({ isApproved: 1, createdAt: -1 });

const Review = models.Review || model("Review", ReviewSchema);
export default Review;
