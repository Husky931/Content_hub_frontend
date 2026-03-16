import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, attempts, channels, messages, notifications, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { publishSystemMessage, publishNotification, publishTaskUpdate } from "@/lib/ws-publish";

const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

/**
 * POST /api/automod/review — incoming auto-moderation result from Edtech backend.
 *
 * Auth: X-API-Key header must match BACKEND_API_KEY env var.
 *
 * Body:
 * {
 *   taskId: string,
 *   attemptId: string,
 *   status: "approved" | "rejected",
 *   reason?: string,
 *   confidence?: number (0-1),
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Validate API key
    if (!BACKEND_API_KEY) {
      return NextResponse.json(
        { error: "Backend integration not configured" },
        { status: 503 }
      );
    }

    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== BACKEND_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, attemptId, status, reason, confidence } = body;

    if (!taskId || !attemptId || !status) {
      return NextResponse.json(
        { error: "taskId, attemptId, and status are required" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    // Get the attempt
    const [attempt] = await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), eq(attempts.taskId, taskId)))
      .limit(1);

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    // Get the task
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get channel slug
    const [channel] = await db
      .select({ slug: channels.slug })
      .from(channels)
      .where(eq(channels.id, task.channelId))
      .limit(1);
    const channelSlug = channel?.slug;

    // Get submitter info
    const [submitter] = await db
      .select({ username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, attempt.userId))
      .limit(1);
    const displayName = submitter?.displayName || submitter?.username || "Unknown";

    if (status === "rejected") {
      // Auto-reject the attempt
      await db
        .update(attempts)
        .set({
          status: "rejected",
          rejectionReason: reason
            ? `Auto-check: ${reason}`
            : "Auto-check: rejected",
          updatedAt: new Date(),
        })
        .where(eq(attempts.id, attemptId));

      const sysContent = `Auto-check: ${displayName}'s submission rejected${reason ? ` — ${reason}` : ""}${confidence != null ? ` (confidence: ${Math.round(confidence * 100)}%)` : ""}`;

      // System message
      const [rejectSysMsg] = await db.insert(messages).values({
        channelId: task.channelId,
        userId: task.createdById,
        type: "system",
        content: sysContent,
      }).returning();

      // Notify the creator
      await db.insert(notifications).values({
        userId: attempt.userId,
        type: "task_rejected",
        title: "Submission auto-rejected",
        body: `Your submission for "${task.title}" was auto-rejected. ${reason || ""}`.trim(),
        data: { taskId, attemptId, channelSlug },
      });

      // Real-time (must await on serverless)
      const autoRejectPublishes: Promise<void>[] = [];
      if (channelSlug) {
        autoRejectPublishes.push(
          publishSystemMessage(channelSlug, { id: rejectSysMsg.id, type: "system", content: sysContent, createdAt: rejectSysMsg.createdAt }),
          publishTaskUpdate(channelSlug, { id: taskId, status: task.status, title: task.title }),
        );
      }
      autoRejectPublishes.push(publishNotification(attempt.userId, {
        type: "task_rejected",
        title: "Submission auto-rejected",
        unreadCount: -1,
      }));
      await Promise.all(autoRejectPublishes);
    } else {
      // Auto-approve — mark as needing human review with a note
      // We don't fully approve here; instead, flag it for fast-track review
      const approveSysContent = `Auto-check: ${displayName}'s submission approved${confidence != null ? ` (confidence: ${Math.round(confidence * 100)}%)` : ""} — pending human review`;

      const [approveSysMsg] = await db.insert(messages).values({
        channelId: task.channelId,
        userId: task.createdById,
        type: "system",
        content: approveSysContent,
      }).returning();

      if (channelSlug) {
        await publishSystemMessage(channelSlug, { id: approveSysMsg.id, type: "system", content: approveSysContent, createdAt: approveSysMsg.createdAt });
      }
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("Auto-mod review error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
