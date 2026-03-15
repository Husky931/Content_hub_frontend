import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, users, channelMods } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// POST /api/tasks/[taskId]/claim-review — claim a task's review queue
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!["admin", "supermod", "mod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { taskId } = await params;

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Already claimed by someone else
    if (task.reviewClaimedById && task.reviewClaimedById !== auth.userId) {
      const [claimer] = await db
        .select({ username: users.username, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, task.reviewClaimedById))
        .limit(1);
      const claimerName = claimer?.displayName || claimer?.username || "another reviewer";
      return NextResponse.json(
        { error: `Already being reviewed by ${claimerName}` },
        { status: 409 }
      );
    }

    // Already claimed by this user — no-op
    if (task.reviewClaimedById === auth.userId) {
      return NextResponse.json({ success: true });
    }

    // Check channel assignment for non-admin roles
    if (auth.role === "mod" || auth.role === "supermod") {
      const [modAssignment] = await db
        .select({ id: channelMods.id })
        .from(channelMods)
        .where(
          and(
            eq(channelMods.channelId, task.channelId),
            eq(channelMods.userId, auth.userId)
          )
        )
        .limit(1);
      if (!modAssignment) {
        return NextResponse.json(
          { error: "You are not assigned to this channel" },
          { status: 403 }
        );
      }
    }

    // Claim the task for review
    await db
      .update(tasks)
      .set({
        reviewClaimedById: auth.userId,
        reviewClaimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Claim task review error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[taskId]/claim-review — release a task's review claim
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!["admin", "supermod", "mod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { taskId } = await params;

    const [task] = await db
      .select({ reviewClaimedById: tasks.reviewClaimedById })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Only the claimer (or admin) can release
    if (task.reviewClaimedById !== auth.userId && auth.role !== "admin") {
      return NextResponse.json(
        { error: "You did not claim this task's review" },
        { status: 403 }
      );
    }

    await db
      .update(tasks)
      .set({
        reviewClaimedById: null,
        reviewClaimedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Release task review claim error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
