import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions, userTags, tags } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Validate session still exists (for server-side invalidation)
    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.tokenJti, auth.jti), eq(sessions.userId, auth.userId)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    // Get full user data
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        status: users.status,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        currency: users.currency,
        onboardingCompleted: users.onboardingCompleted,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    if (!user || user.status === "banned") {
      return NextResponse.json({ error: "Account unavailable" }, { status: 403 });
    }

    // Get user's tags
    const userTagRows = await db
      .select({ id: tags.id, name: tags.name, nameCn: tags.nameCn, color: tags.color })
      .from(userTags)
      .innerJoin(tags, eq(userTags.tagId, tags.id))
      .where(eq(userTags.userId, auth.userId));

    return NextResponse.json({ user: { ...user, tags: userTagRows } });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
