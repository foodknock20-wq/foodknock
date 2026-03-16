import { Schema, model, models } from "mongoose";

const ReviewSchema = new Schema(
  {
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Review = models.Review || model("Review", ReviewSchema);
export default Review;
