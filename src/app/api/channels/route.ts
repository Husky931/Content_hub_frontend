import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, userTags, channelMods } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get all channels
    const allChannels = await db
      .select()
      .from(channels)
      .orderBy(asc(channels.sortOrder));

    // Get user's tags for RBAC filtering
    const userTagRecords = await db
      .select({ tagId: userTags.tagId })
      .from(userTags)
      .where(eq(userTags.userId, auth.userId));

    const userTagIds = new Set(userTagRecords.map((t) => t.tagId));

    // Filter channels based on role and tags
    const visibleChannels = allChannels.filter((ch) => {
      // Special: payment-issues only visible to supermod/admin
      if (ch.slug === "payment-issues") {
        return ["supermod", "admin"].includes(auth.role);
      }

      // Special + Discussion: visible to all authenticated users
      if (ch.type === "special" || ch.type === "discussion") {
        return true;
      }

      // Task channels: require tag OR be mod/supermod/admin
      if (ch.type === "task") {
        if (["supermod", "admin"].includes(auth.role)) return true;
        if (!ch.requiredTagId) return true;
        return userTagIds.has(ch.requiredTagId);
      }

      return true;
    });

    return NextResponse.json({
      channels: visibleChannels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        nameCn: ch.nameCn,
        slug: ch.slug,
        type: ch.type,
        description: ch.description,
        isFixed: ch.isFixed,
        requiredTagId: ch.requiredTagId,
      })),
    });
  } catch (error) {
    console.error("Channels error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
