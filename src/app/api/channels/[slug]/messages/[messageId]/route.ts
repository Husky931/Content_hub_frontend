import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels, messages, users } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { wsPublish } from "@/lib/ws-publish";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ slug: string; messageId: string }> };

/**
 * Delete permission logic:
 * - Everyone can delete their own messages
 * - Mods can delete creator messages
 * - Admins can delete everyone's messages
 */
function canDelete(
  authRole: string,
  authUserId: string,
  msgUserId: string,
  msgUserRole: string
): boolean {
  // Own message — always allowed
  if (authUserId === msgUserId) return true;
  // Admin can delete anyone's
  if (authRole === "admin") return true;
  // Mod/supermod can delete creator messages
  if (
    ["mod", "supermod"].includes(authRole) &&
    msgUserRole === "creator"
  )
    return true;
  return false;
}

/** Broadcast a WS event to the correct rooms (channel or private user rooms) */
async function broadcastEvent(
  slug: string,
  event: string,
  data: unknown,
  privateToUserId: string | null,
  msgUserId: string
) {
  if (privateToUserId) {
    const payload = { ...data as Record<string, unknown>, channelSlug: slug };
    await Promise.all([
      wsPublish({ room: `user:${msgUserId}`, event, data: payload }),
      wsPublish({ room: `user:${privateToUserId}`, event, data: payload }),
    ]);
  } else {
    await wsPublish({ room: `channel:${slug}`, event, data });
  }
}

/** PATCH — edit a message (own messages only) */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { slug, messageId } = await params;
    const { content } = await req.json();

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
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.slug, slug))
      .limit(1);
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Find message
    const [msg] = await db
      .select({
        id: messages.id,
        userId: messages.userId,
        channelId: messages.channelId,
        deletedAt: messages.deletedAt,
        privateToUserId: messages.privateToUserId,
      })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channel.id)))
      .limit(1);

    if (!msg || msg.deletedAt) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Only own messages can be edited
    if (msg.userId !== auth.userId) {
      return NextResponse.json(
        { error: "You can only edit your own messages" },
        { status: 403 }
      );
    }

    // Update
    const [updated] = await db
      .update(messages)
      .set({ content: content.trim(), updatedAt: new Date() })
      .where(eq(messages.id, messageId))
      .returning();

    // Broadcast edit via WS
    await broadcastEvent(
      slug,
      "message:edit",
      { id: updated.id, content: updated.content, updatedAt: updated.updatedAt },
      msg.privateToUserId,
      msg.userId
    );

    return NextResponse.json({
      message: { id: updated.id, content: updated.content, updatedAt: updated.updatedAt },
    });
  } catch (error) {
    console.error("Edit message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE — soft-delete a message */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { slug, messageId } = await params;

    // Find channel
    const [channel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.slug, slug))
      .limit(1);
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Find message with its author's role
    const [msg] = await db
      .select({
        id: messages.id,
        userId: messages.userId,
        channelId: messages.channelId,
        deletedAt: messages.deletedAt,
        privateToUserId: messages.privateToUserId,
        userRole: users.role,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channel.id)))
      .limit(1);

    if (!msg || msg.deletedAt) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // For private messages, verify the user is a participant (or admin)
    if (msg.privateToUserId) {
      const isParticipant =
        auth.userId === msg.userId || auth.userId === msg.privateToUserId;
      if (!isParticipant && auth.role !== "admin") {
        return NextResponse.json(
          { error: "You do not have permission to delete this message" },
          { status: 403 }
        );
      }
    }

    if (!canDelete(auth.role, auth.userId, msg.userId, msg.userRole)) {
      return NextResponse.json(
        { error: "You do not have permission to delete this message" },
        { status: 403 }
      );
    }

    // Soft delete
    await db
      .update(messages)
      .set({ deletedAt: new Date() })
      .where(eq(messages.id, messageId));

    // Broadcast deletion via WS
    await broadcastEvent(
      slug,
      "message:delete",
      { id: messageId },
      msg.privateToUserId,
      msg.userId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
