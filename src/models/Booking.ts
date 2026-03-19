import { Schema, model, models } from "mongoose";

const BookingSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    guests: { type: Number, required: true, min: 1 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

const Booking = models.Booking || model("Booking", BookingSchema);
export default Booking;