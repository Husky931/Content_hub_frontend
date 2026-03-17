import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels, messages, users } from "@/db/schema";
import { eq, asc, sql, isNull } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Find channel
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.slug, slug))
      .limit(1);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Get all non-deleted messages with user info (including replies)
    const channelMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        type: messages.type,
        replyToId: messages.replyToId,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        userId: messages.userId,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: users.role,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(
        sql`${messages.channelId} = ${channel.id} AND ${messages.deletedAt} IS NULL`
      )
      .orderBy(asc(messages.createdAt))
      .limit(200);

    // Build reply count map: parentId → count (exclude deleted)
    const replyCounts = await db
      .select({
        parentId: messages.replyToId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(
        sql`${messages.channelId} = ${channel.id} AND ${messages.deletedAt} IS NULL`
      )
      .groupBy(messages.replyToId);

    const replyCountMap: Record<string, number> = {};
    for (const r of replyCounts) {
      if (r.parentId) replyCountMap[r.parentId] = r.count;
    }

    return NextResponse.json({
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        description: channel.description,
      },
      messages: channelMessages.map((m) => ({
        id: m.id,
        content: m.content,
        type: m.type,
        replyToId: m.replyToId || null,
        replyCount: replyCountMap[m.id] || 0,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt || null,
        user: {
          id: m.userId,
          username: m.username,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
          role: m.role,
        },
      })),
    });
  } catch (error) {
    console.error("Channel fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
