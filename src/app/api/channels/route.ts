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

    // Get unread counts in a single query using a subquery approach:
    // For each channel, count messages created after the user's last-read message.
    // If no read record → 0 unread (first visit = all read).
    const visibleIds = visibleChannels.map((ch) => ch.id);
    const unreadCounts: Record<string, number> = {};

    if (visibleIds.length > 0) {
      // Get read positions with the last-read message's createdAt
      const readPositions = await db
        .select({
          channelId: channelReads.channelId,
          lastReadAt: messages.createdAt,
        })
        .from(channelReads)
        .innerJoin(messages, eq(channelReads.lastReadMessageId, messages.id))
        .where(
          and(
            eq(channelReads.userId, auth.userId),
            inArray(channelReads.channelId, visibleIds)
          )
        );

      const readAtMap: Record<string, Date> = {};
      for (const r of readPositions) {
        readAtMap[r.channelId] = r.lastReadAt;
      }

      // For channels with read positions, batch count unread messages
      // We do one query per channel but only for channels with a read record
      const channelsWithReads = visibleChannels.filter(
        (ch) => readAtMap[ch.id]
      );

      if (channelsWithReads.length > 0) {
        // Use a single query with CASE WHEN for all channels at once
        const results = await db
          .select({
            channelId: messages.channelId,
            count: sql<number>`count(*)::int`,
          })
          .from(messages)
          .where(inArray(messages.channelId, channelsWithReads.map((c) => c.id)))
          .groupBy(messages.channelId);

        // Count only messages after each channel's last-read timestamp
        // We need per-channel filtering, so use individual counts
        for (const ch of channelsWithReads) {
          const afterDate = readAtMap[ch.id];
          const [result] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(messages)
            .where(
              and(
                eq(messages.channelId, ch.id),
                gt(messages.createdAt, afterDate)
              )
            );
          unreadCounts[ch.id] = result?.count || 0;
        }
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
        unreadCount: unreadCounts[ch.id] || 0,
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
