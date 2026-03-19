// src/models/Product.ts

import mongoose, { Schema } from "mongoose";

const ProductSchema = new Schema(
  {
    name:             { type: String, required: true, trim: true },
    slug:             { type: String, unique: true, trim: true, lowercase: true, index: true },
    description:      { type: String, required: true, trim: true },
    shortDescription: { type: String, trim: true, default: "" },
    price:            { type: Number, required: true, min: 0 },
    // compareAtPrice — optional original/cut price for strike-through display.
    // Only meaningful (and only shown) when it exists AND is strictly > price.
    compareAtPrice:   { type: Number, min: 0, default: null },
    category:         { type: String, required: true, trim: true, index: true },
    image:            { type: String, required: true },
    stock:            { type: Number, required: true, min: 0, default: 0 },
    isAvailable:      { type: Boolean, default: true, index: true },
    isFeatured:       { type: Boolean, default: false, index: true },
    tags:             { type: [String], default: [] },
    ingredients:      { type: [String], default: [] },
    rating:           { type: Number, min: 0, max: 5, default: null },
  },
  { timestamps: true }
);

ProductSchema.index({ isAvailable: 1, stock: 1, isFeatured: -1, createdAt: -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ category: 1, createdAt: -1 });

if (process.env.NODE_ENV === "development" && mongoose.models.Product) {
  delete mongoose.models.Product;
}

const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

export default Product;