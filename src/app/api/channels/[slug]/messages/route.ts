import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels, messages, users } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { publishMessage } from "@/lib/ws-publish";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { slug } = await params;
    const { content, replyToId } = await req.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    if (content.trim().length > 2000) {
      return NextResponse.json(
        { error: "Message must be 2000 characters or fewer" },
        { status: 400 }
      );
    }

    // Find channel
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.slug, slug))
      .limit(1);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check permissions: announcements is read-only for creators
    if (
      channel.slug === "announcements" &&
      !["mod", "supermod", "admin"].includes(auth.role)
    ) {
      return NextResponse.json(
        { error: "You cannot post in this channel" },
        { status: 403 }
      );
    }

    // Validate replyToId if provided
    if (replyToId) {
      const [parentMsg] = await db
        .select({ id: messages.id, channelId: messages.channelId })
        .from(messages)
        .where(eq(messages.id, replyToId))
        .limit(1);

      if (!parentMsg || parentMsg.channelId !== channel.id) {
        return NextResponse.json(
          { error: "Reply target not found in this channel" },
          { status: 400 }
        );
      }
    }

    // Determine message type
    const messageType =
      channel.slug === "announcements" ? "mod" : "text";

    // Insert message
    const [newMessage] = await db
      .insert(messages)
      .values({
        channelId: channel.id,
        userId: auth.userId,
        type: messageType,
        content: content.trim(),
        replyToId: replyToId || null,
      })
      .returning();

    // Get user info for response
    const [msgUser] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    const messagePayload = {
      id: newMessage.id,
      content: newMessage.content,
      type: newMessage.type,
      replyToId: newMessage.replyToId || null,
      replyCount: 0,
      createdAt: newMessage.createdAt,
      user: msgUser,
    };

    // Broadcast to channel via WebSocket (must await on serverless)
    await publishMessage(slug, messagePayload);

    return NextResponse.json({ message: messagePayload });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
