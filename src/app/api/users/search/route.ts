import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { sql, and, ne } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() || "";

    if (q.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const pattern = `%${q}%`;

    const results = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          ne(users.id, auth.userId),
          sql`(${users.username} ILIKE ${pattern} OR ${users.displayName} ILIKE ${pattern})`
        )
      )
      .orderBy(users.username)
      .limit(10);

    return NextResponse.json({ users: results });
  } catch (error) {
    console.error("User search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
