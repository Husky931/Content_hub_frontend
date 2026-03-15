import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, inviteCodes, tags, channels } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, count } from "drizzle-orm";

export async function GET() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [[userCount], [inviteCount], [tagCount], [channelCount]] =
      await Promise.all([
        db.select({ value: count() }).from(users),
        db
          .select({ value: count() })
          .from(inviteCodes)
          .where(eq(inviteCodes.status, "active")),
        db.select({ value: count() }).from(tags),
        db.select({ value: count() }).from(channels),
      ]);

    return NextResponse.json({
      totalUsers: userCount.value,
      activeInvites: inviteCount.value,
      totalTags: tagCount.value,
      totalChannels: channelCount.value,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
