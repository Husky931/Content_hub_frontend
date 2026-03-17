import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels, channelReads, messages } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { slug } = await params;

    // Find channel
    const [channel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.slug, slug))
      .limit(1);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Find the latest message in this channel
    const [latestMsg] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.channelId, channel.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    const lastReadMessageId = latestMsg?.id || null;

    // Upsert channel_reads record
    const existing = await db
      .select({ id: channelReads.id })
      .from(channelReads)
      .where(
        and(
          eq(channelReads.userId, auth.userId),
          eq(channelReads.channelId, channel.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(channelReads)
        .set({
          lastReadMessageId,
          lastReadAt: new Date(),
        })
        .where(eq(channelReads.id, existing[0].id));
    } else {
      await db.insert(channelReads).values({
        userId: auth.userId,
        channelId: channel.id,
        lastReadMessageId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
