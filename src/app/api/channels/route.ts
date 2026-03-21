import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, userTags, channelReads, messages, appeals } from "@/db/schema";
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

    // Filter channels: hide only payment-issues for non-admin/supermod.
    // All other channels are visible — tag-gated channels are shown but marked as restricted.
    const visibleChannels = allChannels.filter((ch) => {
      if (ch.slug === "payment-issues") {
        return ["supermod", "admin"].includes(auth.role);
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

    // Count pending appeals for mods/supermods/admins (shown as badge on #appeals)
    let pendingAppealsCount = 0;
    if (["mod", "supermod", "admin"].includes(auth.role)) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(appeals)
        .where(eq(appeals.status, "pending"));
      pendingAppealsCount = row?.count ?? 0;
    }

    return NextResponse.json({
      channels: visibleChannels.map((ch) => {
        // Determine if user has access (can interact) with this channel
        let hasAccess = true;
        if (ch.type === "task" && ch.requiredTagId) {
          hasAccess = ["supermod", "admin"].includes(auth.role) || userTagIds.has(ch.requiredTagId);
        }
        return {
          id: ch.id,
          name: ch.name,
          nameCn: ch.nameCn,
          slug: ch.slug,
          type: ch.type,
          description: ch.description,
          isFixed: ch.isFixed,
          requiredTagId: ch.requiredTagId,
          hasAccess,
          hasUnread: unreadSet.has(ch.id),
          ...(ch.slug === "appeals" ? { pendingAppealsCount } : {}),
        };
      }),
    });
  } catch (error) {
    console.error("Channels error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
