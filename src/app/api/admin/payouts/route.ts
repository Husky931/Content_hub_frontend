import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ledgerEntries, users, notifications, tasks, attempts, channels } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, ne, and, inArray } from "drizzle-orm";

// GET /api/admin/payouts — get payout summary (admin only)
export async function GET() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all users with their balances
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        currency: users.currency,
      })
      .from(users)
      .where(ne(users.status, "banned"));

    const payoutSummary = [];

    for (const user of allUsers) {
      const entries = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.userId, user.id));

      let earnedUsd = 0;
      let earnedRmb = 0;
      let paidUsd = 0;
      let paidRmb = 0;

      for (const e of entries) {
        const usd = parseFloat(e.amountUsd || "0");
        const rmb = parseFloat(e.amountRmb || "0");
        if (e.type === "payout") {
          paidUsd += Math.abs(usd);
          paidRmb += Math.abs(rmb);
        } else {
          earnedUsd += usd;
          earnedRmb += rmb;
        }
      }

      const owedUsd = earnedUsd - paidUsd;
      const owedRmb = earnedRmb - paidRmb;

      if (owedUsd > 0 || owedRmb > 0) {
        // Build task breakdown from earning entries
        const earningEntries = entries.filter(
          (e) => e.type === "task_earning" && e.taskId
        );
        const taskBreakdown = [];

        for (const entry of earningEntries) {
          const [task] = await db
            .select({
              title: tasks.title,
              channelId: tasks.channelId,
              createdById: tasks.createdById,
            })
            .from(tasks)
            .where(eq(tasks.id, entry.taskId!));

          if (!task) continue;

          // Get channel name
          const [channel] = await db
            .select({ name: channels.name })
            .from(channels)
            .where(eq(channels.id, task.channelId));

          // Get reviewer (approver) from the attempt
          let approverName: string | null = null;
          if (entry.attemptId) {
            const [attempt] = await db
              .select({ reviewerId: attempts.reviewerId })
              .from(attempts)
              .where(eq(attempts.id, entry.attemptId));
            if (attempt?.reviewerId) {
              const [reviewer] = await db
                .select({ username: users.username, displayName: users.displayName })
                .from(users)
                .where(eq(users.id, attempt.reviewerId));
              approverName = reviewer?.displayName || reviewer?.username || null;
            }
          }

          // Get task creator name
          const [creator] = await db
            .select({ username: users.username, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, task.createdById));

          taskBreakdown.push({
            taskTitle: task.title,
            channel: channel?.name || "Unknown",
            approvedAt: entry.createdAt,
            approvedBy: approverName,
            createdBy: creator?.displayName || creator?.username || "Unknown",
            amountUsd: entry.amountUsd || "0",
            amountRmb: entry.amountRmb || "0",
          });
        }

        payoutSummary.push({
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          currency: user.currency,
          owedUsd: owedUsd.toFixed(2),
          owedRmb: owedRmb.toFixed(2),
          tasks: taskBreakdown,
        });
      }
    }

    return NextResponse.json({ payouts: payoutSummary });
  } catch (error) {
    console.error("Get payouts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/payouts — execute payouts (admin only)
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds array is required" },
        { status: 400 }
      );
    }

    const results = [];

    for (const userId of userIds) {
      // Calculate owed amount
      const entries = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.userId, userId));

      let earnedUsd = 0;
      let earnedRmb = 0;
      let paidUsd = 0;
      let paidRmb = 0;

      for (const e of entries) {
        const usd = parseFloat(e.amountUsd || "0");
        const rmb = parseFloat(e.amountRmb || "0");
        if (e.type === "payout") {
          paidUsd += Math.abs(usd);
          paidRmb += Math.abs(rmb);
        } else {
          earnedUsd += usd;
          earnedRmb += rmb;
        }
      }

      const owedUsd = earnedUsd - paidUsd;
      const owedRmb = earnedRmb - paidRmb;

      if (owedUsd <= 0 && owedRmb <= 0) continue;

      // Create payout ledger entry (negative to represent money out)
      const [payoutEntry] = await db
        .insert(ledgerEntries)
        .values({
          userId,
          type: "payout",
          amountUsd: owedUsd > 0 ? (-owedUsd).toFixed(2) : "0",
          amountRmb: owedRmb > 0 ? (-owedRmb).toFixed(2) : "0",
          description: `Monthly payout - ${new Date().toISOString().slice(0, 7)}`,
        })
        .returning();

      // Transition associated tasks and attempts from approved → paid
      const earningEntries = entries.filter(
        (e) => e.type === "task_earning" && e.taskId
      );
      const taskIds = [...new Set(earningEntries.map((e) => e.taskId!))];
      const attemptIds = earningEntries
        .filter((e) => e.attemptId)
        .map((e) => e.attemptId!);

      if (taskIds.length > 0) {
        await db
          .update(tasks)
          .set({ status: "paid", updatedAt: new Date() })
          .where(and(inArray(tasks.id, taskIds), eq(tasks.status, "approved")));
      }
      if (attemptIds.length > 0) {
        await db
          .update(attempts)
          .set({ status: "paid", updatedAt: new Date() })
          .where(
            and(inArray(attempts.id, attemptIds), eq(attempts.status, "approved"))
          );
      }

      // Notify user
      await db.insert(notifications).values({
        userId,
        type: "payout",
        title: "Payout settled",
        body: `Your monthly payout of $${owedUsd.toFixed(2)} / ¥${owedRmb.toFixed(2)} has been settled.`,
        data: { ledgerEntryId: payoutEntry.id },
      });

      results.push({
        userId,
        paidUsd: owedUsd.toFixed(2),
        paidRmb: owedRmb.toFixed(2),
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Execute payouts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
