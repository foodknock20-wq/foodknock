import { Schema, model, models } from "mongoose";

// `isApproved` is the single server-owned VISIBILITY flag: true => the
// review is publicly visible, false => an admin has HIDDEN it. The field
// name is retained (rather than renamed to e.g. `isHidden`) purely for
// backward compatibility — renaming it would require a production data
// migration over every existing document, which this change deliberately
// avoids.
//
// Instant-publishing change: the default is now `true`, so a successfully
// submitted review is visible on /reviews immediately — there is no longer
// a mandatory admin approval/verification gate. Admins retain full
// control via PATCH /api/reviews/[id] (hide/unhide) and DELETE.
//
// Backward-compatible legacy mapping:
//   - legacy isApproved:true  -> visible   (unchanged)
//   - legacy isApproved:false -> hidden    (stays hidden on purpose)
// The schema cannot distinguish a legacy "awaiting approval" review from
// one an admin deliberately rejected/hid (both are isApproved:false), so
// we conservatively keep all legacy false records hidden rather than risk
// exposing a genuinely-hidden review. The owner can unhide any of them
// from the admin Reviews screen. No production records are modified by
// this change.
const ReviewSchema = new Schema(
  {
    userName: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
    // default true => new reviews are visible immediately (no approval gate)
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Matches the actual public/admin query shape (filter on isApproved, sort
// by createdAt desc) — previously this collection had no indexes at all,
// meaning every list call was a full collection scan + in-memory sort.
ReviewSchema.index({ isApproved: 1, createdAt: -1 });

const Review = models.Review || model("Review", ReviewSchema);
export default Review;
