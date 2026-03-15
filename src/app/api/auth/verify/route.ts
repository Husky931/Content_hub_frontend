import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, verificationTokens, sessions } from "@/db/schema";
import { createJWT } from "@/lib/auth";
import { eq, and, isNull } from "drizzle-orm";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      );
    }

    // Find valid token (not used, not expired)
    const [verifyRecord] = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, token),
          isNull(verificationTokens.usedAt)
        )
      )
      .limit(1);

    if (!verifyRecord) {
      return NextResponse.json(
        { error: "Invalid or already used verification token" },
        { status: 400 }
      );
    }

    // Check expiration
    if (verifyRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Verification token has expired" },
        { status: 400 }
      );
    }

    // Mark token as used
    await db
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, verifyRecord.id));

    // Update user status to verified
    const [verifiedUser] = await db
      .update(users)
      .set({ status: "verified", updatedAt: new Date() })
      .where(eq(users.id, verifyRecord.userId))
      .returning({ id: users.id, role: users.role });

    // Auto-login: issue JWT
    const jwt = await createJWT({
      userId: verifiedUser.id,
      role: verifiedUser.role,
    });

    // Store session for server-side invalidation
    await db.insert(sessions).values({
      userId: verifiedUser.id,
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
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Redirect to onboarding after verification
    return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
