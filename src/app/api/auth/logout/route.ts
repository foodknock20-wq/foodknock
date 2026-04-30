
import { NextResponse } from "next/server";

export async function POST() {
    try {
        const response = NextResponse.json({
            success: true,
            message: "Logged out successfully",
        });

        // Clear the httpOnly token cookie by expiring it immediately
        response.cookies.set("token", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            expires: new Date(0),
        });

        return response;
    } catch (error) {
        console.error("LOGOUT_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to logout" },
            { status: 500 }
        );
    }
}