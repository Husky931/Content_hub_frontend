import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, users, channels, messages } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { publishSystemMessage, publishTaskUpdate } from "@/lib/ws-publish";

/**
 * POST /api/tasks/[taskId]/unlock — Manually unlock a locked task back to active.
 * Only mod/supermod/admin.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!["mod", "supermod", "admin"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { taskId } = await params;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.status !== "locked") {
      return NextResponse.json(
        { error: "Task is not locked" },
        { status: 400 }
      );
    }

    // Unlock: revert to active
    await db
      .update(tasks)
      .set({
        status: "active",
        lockedById: null,
        lockExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Get mod name
    const [mod] = await db
      .select({ username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);
    const modName = mod?.displayName || mod?.username || "A moderator";

    // Get channel slug
    const [channel] = await db
      .select({ slug: channels.slug })
      .from(channels)
      .where(eq(channels.id, task.channelId))
      .limit(1);
    const channelSlug = channel?.slug;

    // Post system message
    const sysContent = `Task "${task.title}" unlocked by ${modName} — reopened for all creators`;
    const [sysMsg] = await db
      .insert(messages)
      .values({
        channelId: task.channelId,
        userId: auth.userId,
        type: "system",
        content: sysContent,
      })
      .returning();

    // Real-time broadcasts
    if (channelSlug) {
      await Promise.all([
        publishSystemMessage(channelSlug, {
          id: sysMsg.id,
          type: "system",
          content: sysContent,
          createdAt: sysMsg.createdAt,
        }),
        publishTaskUpdate(channelSlug, {
          id: taskId,
          status: "active",
          lockedById: null,
          lockExpiresAt: null,
        }),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unlock task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
