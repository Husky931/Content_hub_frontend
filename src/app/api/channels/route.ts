import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, userTags, channelReads, messages } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, asc, and, gt, sql, inArray } from "drizzle-orm";

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
      if (ch.slug === "payment-issues") {
        return ["supermod", "admin"].includes(auth.role);
      }
      if (ch.type === "special" || ch.type === "discussion") {
        return true;
      }
      if (ch.type === "task") {
        if (["supermod", "admin"].includes(auth.role)) return true;
        if (!ch.requiredTagId) return true;
        return userTagIds.has(ch.requiredTagId);
      }
      return true;
    });

    // Determine which channels have unread messages (boolean only).
    // Single query: get user's read positions for all visible channels.
    // If no read record exists → no unread (first visit = all read).
    // If read record exists → check if any message exists after lastReadAt.
    const visibleIds = visibleChannels.map((ch) => ch.id);
    const unreadSet = new Set<string>();

    if (visibleIds.length > 0) {
      // Single query: find channels where messages exist after the user's lastReadAt
      const unreadChannels = await db
        .select({ channelId: channelReads.channelId })
        .from(channelReads)
        .where(
          and(
            eq(channelReads.userId, auth.userId),
            inArray(channelReads.channelId, visibleIds),
            sql`EXISTS (
              SELECT 1 FROM messages m
              WHERE m.channel_id = ${channelReads.channelId}
              AND m.created_at > ${channelReads.lastReadAt}
              LIMIT 1
            )`
          )
        );

      for (const row of unreadChannels) {
        unreadSet.add(row.channelId);
      }
    }

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
        hasUnread: unreadSet.has(ch.id),
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
