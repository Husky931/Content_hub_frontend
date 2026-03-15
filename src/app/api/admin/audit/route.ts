import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  tasks,
  attempts,
  users,
  channels,
  ledgerEntries,
  messages,
  notifications,
} from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

// GET /api/admin/audit — get approved tasks pending payout (supermod/admin)
export async function GET() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get tasks in "approved" state (not yet paid) with their winning attempts
    const approvedTasks = await db
      .select({
        taskId: tasks.id,
        taskTitle: tasks.title,
        taskStatus: tasks.status,
        channelName: channels.name,
        channelSlug: channels.slug,
        bountyUsd: tasks.bountyUsd,
        bountyRmb: tasks.bountyRmb,
        approvedAt: tasks.updatedAt,
        attemptId: attempts.id,
        attemptUserId: attempts.userId,
        attemptDeliverables: attempts.deliverables,
        attemptCreatedAt: attempts.createdAt,
        creatorUsername: users.username,
        creatorDisplayName: users.displayName,
      })
      .from(tasks)
      .innerJoin(channels, eq(tasks.channelId, channels.id))
      .innerJoin(
        attempts,
        and(eq(attempts.taskId, tasks.id), eq(attempts.status, "approved"))
      )
      .innerJoin(users, eq(attempts.userId, users.id))
      .where(eq(tasks.status, "approved"))
      .orderBy(desc(tasks.updatedAt));

    return NextResponse.json({ auditItems: approvedTasks });
  } catch (error) {
    console.error("Audit list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/audit — supermod reverses an approval
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { taskId, attemptId, reason } = body;

    if (!taskId || !attemptId || !reason) {
      return NextResponse.json(
        { error: "taskId, attemptId, and reason are required" },
        { status: 400 }
      );
    }

    // Verify task is in approved state
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "approved")))
      .limit(1);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found or not in approved state" },
        { status: 400 }
      );
    }

    // Verify attempt
    const [attempt] = await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), eq(attempts.status, "approved")))
      .limit(1);

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found or not approved" },
        { status: 400 }
      );
    }

    // Reverse: attempt → rejected, task → active
    await db
      .update(attempts)
      .set({
        status: "rejected",
        rejectionReason: `Audit reversal: ${reason}`,
        reviewerId: auth.userId,
        updatedAt: new Date(),
      })
      .where(eq(attempts.id, attemptId));

    await db
      .update(tasks)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Remove the corresponding ledger entry
    await db
      .delete(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.attemptId, attemptId),
          eq(ledgerEntries.type, "task_earning")
        )
      );

    // Get auditor info
    const [auditor] = await db
      .select({ username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    // Post system message
    await db.insert(messages).values({
      channelId: task.channelId,
      userId: auth.userId,
      type: "system",
      content: `Audit reversal: "${task.title}" approval was reversed by ${auditor.displayName || auditor.username}. Task reopened.`,
    });

    // Notify the creator
    await db.insert(notifications).values({
      userId: attempt.userId,
      type: "audit_reversal",
      title: "Approval reversed",
      body: `Your approved submission for "${task.title}" was reversed during audit. Reason: ${reason}`,
      data: { taskId, attemptId },
    });

    return NextResponse.json({
      success: true,
      message: "Approval reversed, task reopened",
    });
  } catch (error) {
    console.error("Audit reversal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
