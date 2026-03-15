import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { verifyPassword, createJWT } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if banned
    if (user.status === "banned") {
      return NextResponse.json(
        {
          error: "Account is permanently banned",
          banReason: user.banReason || "Contact support for details",
        },
        { status: 403 }
      );
    }

    // Check if verified
    if (user.status === "pending_verification") {
      return NextResponse.json(
        { error: "Please verify your email before logging in" },
        { status: 403 }
      );
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Issue JWT
    const jwt = await createJWT({ userId: user.id, role: user.role });

    // Store session
    await db.insert(sessions).values({
      userId: user.id,
      tokenJti: jwt.jti,
      expiresAt: jwt.expiresAt,
    });

    // Set httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("auth_token", jwt.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: user.onboardingCompleted,
        currency: user.currency,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
