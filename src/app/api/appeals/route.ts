import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  appeals,
  attempts,
  tasks,
  channels,
  users,
  messages,
  notifications,
} from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import { publishMessage, publishNotification } from "@/lib/ws-publish";

/**
 * POST /api/appeals — Creator files an appeal on a rejected attempt
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { attemptId, reason } = await req.json();

    if (!attemptId || !reason || reason.trim().length < 20) {
      return NextResponse.json(
        { error: "Attempt ID and reason (min 20 chars) are required" },
        { status: 400 }
      );
    }

    // Get the attempt
    const [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    // Only the attempt owner can appeal
    if (attempt.userId !== auth.userId) {
      return NextResponse.json(
        { error: "You can only appeal your own attempts" },
        { status: 403 }
      );
    }

    // Attempt must be rejected
    if (attempt.status !== "rejected") {
      return NextResponse.json(
        { error: "Can only appeal rejected attempts" },
        { status: 400 }
      );
    }

    // Check no existing appeal for this attempt
    const [existing] = await db
      .select({ id: appeals.id })
      .from(appeals)
      .where(eq(appeals.attemptId, attemptId))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Appeal already exists for this attempt" },
        { status: 400 }
      );
    }

    // Create the appeal
    const [appeal] = await db
      .insert(appeals)
      .values({
        attemptId,
        userId: auth.userId,
        reason: reason.trim(),
      })
      .returning();

    // Get task info for the system message
    const [task] = await db
      .select({ title: tasks.title, channelId: tasks.channelId })
      .from(tasks)
      .where(eq(tasks.id, attempt.taskId))
      .limit(1);

    // Get the #appeals channel
    const [appealsChannel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.slug, "appeals"))
      .limit(1);

    // Get user display info
    const [appealUser] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    const displayName =
      appealUser?.displayName || appealUser?.username || "A creator";

    if (appealsChannel) {
      // Post system message in #appeals channel
      const [sysMsg] = await db
        .insert(messages)
        .values({
          channelId: appealsChannel.id,
          userId: auth.userId,
          type: "system",
          content: `📋 New appeal filed by ${displayName} for task "${task?.title || "Unknown"}" — Reason: ${reason.trim().slice(0, 100)}${reason.trim().length > 100 ? "…" : ""}`,
        })
        .returning();

      // Broadcast to #appeals channel
      await publishMessage("appeals", {
        id: sysMsg.id,
        content: sysMsg.content,
        type: sysMsg.type,
        replyToId: null,
        replyCount: 0,
        createdAt: sysMsg.createdAt,
        user: {
          id: appealUser?.id || auth.userId,
          username: appealUser?.username || "System",
          displayName: appealUser?.displayName || null,
          avatarUrl: null,
          role: auth.role,
        },
      });
    }

    // Notify mods/supermods/admins
    const modUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "mod"));
    const supermodUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "supermod"));
    const adminUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));

    const reviewerIds = [
      ...modUsers.map((u) => u.id),
      ...supermodUsers.map((u) => u.id),
      ...adminUsers.map((u) => u.id),
    ];

    for (const reviewerId of reviewerIds) {
      const [notif] = await db
        .insert(notifications)
        .values({
          userId: reviewerId,
          type: "new_appeal",
          title: "New appeal filed",
          body: `${displayName} appealed a rejection on "${task?.title || "Unknown"}"`,
          data: {
            appealId: appeal.id,
            attemptId,
            channelSlug: "appeals",
          },
        })
        .returning();

      await publishNotification(reviewerId, {
        type: "new_appeal",
        title: notif.title,
        unreadCount: -1,
      });
    }

    return NextResponse.json({ appeal });
  } catch (error) {
    console.error("Create appeal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/appeals — List appeals
 * Mods/supermods/admins see all; creators see only their own.
 * ?status=pending|granted|denied to filter
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const isMod = ["mod", "supermod", "admin"].includes(auth.role);

    // Build base query conditions
    const conditions = [];
    if (!isMod) {
      conditions.push(eq(appeals.userId, auth.userId));
    }
    if (
      statusFilter &&
      ["pending", "granted", "denied"].includes(statusFilter)
    ) {
      conditions.push(
        eq(
          appeals.status,
          statusFilter as "pending" | "granted" | "denied"
        )
      );
    }

    const whereClause =
      conditions.length > 1
        ? and(...conditions)
        : conditions.length === 1
        ? conditions[0]
        : undefined;

    const allAppeals = await db
      .select({
        id: appeals.id,
        attemptId: appeals.attemptId,
        userId: appeals.userId,
        reason: appeals.reason,
        status: appeals.status,
        arbitratorId: appeals.arbitratorId,
        arbitratorNote: appeals.arbitratorNote,
        createdAt: appeals.createdAt,
        resolvedAt: appeals.resolvedAt,
      })
      .from(appeals)
      .where(whereClause)
      .orderBy(desc(appeals.createdAt))
      .limit(50);

    // Enrich with user, task, and attempt info
    const enriched = await Promise.all(
      allAppeals.map(async (appeal) => {
        const [attempt] = await db
          .select({
            id: attempts.id,
            status: attempts.status,
            taskId: attempts.taskId,
            deliverables: attempts.deliverables,
            rejectionReason: attempts.rejectionReason,
            reviewerId: attempts.reviewerId,
          })
          .from(attempts)
          .where(eq(attempts.id, appeal.attemptId))
          .limit(1);

        let task = null;
        let channelSlug = null;
        if (attempt) {
          const [t] = await db
            .select({
              id: tasks.id,
              title: tasks.title,
              channelId: tasks.channelId,
            })
            .from(tasks)
            .where(eq(tasks.id, attempt.taskId))
            .limit(1);
          task = t || null;

          if (task) {
            const [ch] = await db
              .select({ slug: channels.slug })
              .from(channels)
              .where(eq(channels.id, task.channelId))
              .limit(1);
            channelSlug = ch?.slug || null;
          }
        }

        const [appealUser] = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, appeal.userId))
          .limit(1);

        // Get the original reviewer who rejected
        let reviewer = null;
        if (attempt?.reviewerId) {
          const [r] = await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
            })
            .from(users)
            .where(eq(users.id, attempt.reviewerId))
            .limit(1);
          reviewer = r || null;
        }

        return {
          ...appeal,
          user: appealUser || null,
          attempt: attempt
            ? {
                id: attempt.id,
                status: attempt.status,
                deliverables: attempt.deliverables,
                rejectionReason: attempt.rejectionReason,
              }
            : null,
          task: task
            ? { id: task.id, title: task.title }
            : null,
          channelSlug,
          reviewer,
        };
      })
    );

    return NextResponse.json({ appeals: enriched });
  } catch (error) {
    console.error("List appeals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
