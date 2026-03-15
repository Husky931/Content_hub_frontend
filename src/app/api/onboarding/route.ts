import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { currency, displayName, bio } = await req.json();

    // Currency is required and must be valid
    if (!currency || !["usd", "rmb"].includes(currency)) {
      return NextResponse.json(
        { error: "Currency selection is required (usd or rmb)" },
        { status: 400 }
      );
    }

    // Check if user already completed onboarding (currency is irreversible)
    const [currentUser] = await db
      .select({ currency: users.currency, onboardingCompleted: users.onboardingCompleted })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    if (currentUser?.onboardingCompleted) {
      return NextResponse.json(
        { error: "Onboarding already completed" },
        { status: 400 }
      );
    }

    // Update user with onboarding data
    const [updated] = await db
      .update(users)
      .set({
        currency,
        displayName: displayName?.trim() || null,
        bio: bio?.trim() || null,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, auth.userId))
      .returning();

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        role: updated.role,
        status: updated.status,
        currency: updated.currency,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
        bio: updated.bio,
        onboardingCompleted: updated.onboardingCompleted,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
