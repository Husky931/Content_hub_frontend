import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels, messages, users, userTags, notifications } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { publishMessage, publishNotification } from "@/lib/ws-publish";
import { wsPublish } from "@/lib/ws-publish";
import { eq, and, inArray, ne } from "drizzle-orm";

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
    const { content, replyToId, privateToUserId } = await req.json();

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

    // Check tag-gated channel access
    if (
      channel.type === "task" &&
      channel.requiredTagId &&
      !["supermod", "admin"].includes(auth.role)
    ) {
      const [hasTag] = await db
        .select({ tagId: userTags.tagId })
        .from(userTags)
        .where(
          and(
            eq(userTags.userId, auth.userId),
            eq(userTags.tagId, channel.requiredTagId)
          )
        )
        .limit(1);

      if (!hasTag) {
        return NextResponse.json(
          { error: "You need the required tag to interact with this channel" },
          { status: 403 }
        );
      }
    }

    // Resolve private message target
    let resolvedPrivateToUserId: string | null = null;

    // Validate replyToId if provided
    if (replyToId) {
      const [parentMsg] = await db
        .select({
          id: messages.id,
          channelId: messages.channelId,
          userId: messages.userId,
          privateToUserId: messages.privateToUserId,
        })
        .from(messages)
        .where(eq(messages.id, replyToId))
        .limit(1);

      if (!parentMsg || parentMsg.channelId !== channel.id) {
        return NextResponse.json(
          { error: "Reply target not found in this channel" },
          { status: 400 }
        );
      }

      // If parent is private, reply must inherit privacy
      if (parentMsg.privateToUserId) {
        const isParticipant =
          auth.userId === parentMsg.userId ||
          auth.userId === parentMsg.privateToUserId;

        if (!isParticipant) {
          return NextResponse.json(
            { error: "You cannot reply to this private message" },
            { status: 403 }
          );
        }

        // Set privateToUserId to the "other" participant
        resolvedPrivateToUserId =
          auth.userId === parentMsg.userId
            ? parentMsg.privateToUserId
            : parentMsg.userId;
      }
    }

    // Handle explicit privateToUserId (initiating a new private message)
    if (privateToUserId && !resolvedPrivateToUserId) {
      // Cannot send private message to self
      if (privateToUserId === auth.userId) {
        return NextResponse.json(
          { error: "Cannot send a private message to yourself" },
          { status: 400 }
        );
      }

      // Validate target user exists
      const [targetUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, privateToUserId))
        .limit(1);

      if (!targetUser) {
        return NextResponse.json(
          { error: "Target user not found" },
          { status: 404 }
        );
      }

      resolvedPrivateToUserId = privateToUserId;
    }

    // Determine message type
    const messageType =
      channel.slug === "announcements" ? "mod" : "text";

    // Insert message
    const insertValues: Record<string, unknown> = {
      channelId: channel.id,
      userId: auth.userId,
      type: messageType,
      content: content.trim(),
      replyToId: replyToId || null,
    };
    if (resolvedPrivateToUserId) {
      insertValues.privateToUserId = resolvedPrivateToUserId;
    }
    const [newMessage] = await db
      .insert(messages)
      .values(insertValues as typeof messages.$inferInsert)
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
      privateToUserId: resolvedPrivateToUserId,
      replyCount: 0,
      createdAt: newMessage.createdAt,
      user: msgUser,
    };

    // Broadcast via WebSocket
    if (resolvedPrivateToUserId) {
      // Private message: send only to sender and recipient via user rooms
      const privatePayload = { ...messagePayload, channelSlug: slug };
      await Promise.all([
        wsPublish({ room: `user:${auth.userId}`, event: "message:new", data: privatePayload }),
        wsPublish({ room: `user:${resolvedPrivateToUserId}`, event: "message:new", data: privatePayload }),
      ]);
    } else {
      // Public message: broadcast to channel
      await publishMessage(slug, messagePayload);
    }

    // Parse @mentions and create notifications (non-blocking)
    const mentionMatches = newMessage.content.match(/@(\w+)/g);
    if (mentionMatches) {
      const mentionedUsernames = [...new Set(mentionMatches.map((m: string) => m.slice(1)))];
      try {
        const mentionedUsers = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(
            and(
              inArray(users.username, mentionedUsernames),
              ne(users.id, auth.userId) // Don't notify self
            )
          );

        // For private messages, only notify the recipient (they can already see it)
        const usersToNotify = resolvedPrivateToUserId
          ? mentionedUsers.filter((u) => u.id === resolvedPrivateToUserId)
          : mentionedUsers;

        for (const mentionedUser of usersToNotify) {
          const [notif] = await db
            .insert(notifications)
            .values({
              userId: mentionedUser.id,
              type: "mention",
              title: `${msgUser.displayName || msgUser.username} mentioned you`,
              body: newMessage.content.length > 100
                ? newMessage.content.slice(0, 100) + "…"
                : newMessage.content,
              data: { channelSlug: slug, messageId: newMessage.id },
            })
            .returning();
          await publishNotification(mentionedUser.id, {
            ...notif,
            type: "mention",
            title: notif.title,
          });
        }
      } catch (err) {
        console.warn("Mention notification error:", err);
      }
    }

    return NextResponse.json({ message: messagePayload });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
