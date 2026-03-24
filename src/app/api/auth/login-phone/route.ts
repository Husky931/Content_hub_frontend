import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyOtp } from "@/lib/otp-store";
import { createJWT } from "@/lib/auth-edge";

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { error: "Phone number and verification code are required" },
        { status: 400 }
      );
    }

    const cleaned = phone.replace(/\s/g, "").replace(/^\+?86/, "");
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(cleaned)) {
      return NextResponse.json({ error: "Invalid Chinese phone number" }, { status: 400 });
    }

    // Verify OTP (login uses "login:" prefix to separate from signup OTPs)
    const otpResult = verifyOtp(`login:${cleaned}`, otp);
    if (otpResult !== true) {
      return NextResponse.json({ error: otpResult }, { status: 400 });
    }

    // Look up user by phone
    const [user] = await db
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.phone, cleaned))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "No account found for this phone number" }, { status: 404 });
    }

    if (user.status === "banned") {
      return NextResponse.json({ error: "Account is banned" }, { status: 403 });
    }

    // Issue JWT session
    const { token, jti, expiresAt } = await createJWT({
      userId: user.id,
      role: user.role,
    });

    await db.insert(sessions).values({
      userId: user.id,
      tokenJti: jti,
      expiresAt,
    });

    const response = NextResponse.json({ message: "Login successful" });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[login-phone] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
