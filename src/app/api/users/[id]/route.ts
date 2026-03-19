export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    await connectDB();

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const allowed: Record<string, any> = {};

    if (typeof body.isActive === "boolean") {
      allowed.isActive = body.isActive;
    }

    if (body.role !== undefined) {
      if (!["user", "admin"].includes(body.role)) {
        return NextResponse.json(
          { success: false, message: "Invalid role. Must be 'user' or 'admin'" },
          { status: 400 }
        );
      }
      allowed.role = body.role;
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json(
        { success: false, message: "No valid fields provided to update" },
        { status: 400 }
      );
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: allowed },
      { new: true, runValidators: true }
    )
      .select("-password")
      .lean();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("PATCH_USER_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to update user" },
      { status: 500 }
    );
  }
}