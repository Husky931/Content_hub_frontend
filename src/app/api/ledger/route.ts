import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ledgerEntries, users } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, desc, sql, and } from "drizzle-orm";

// GET /api/ledger — get user's ledger / wallet info
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // Admin can view any user's ledger; others see only their own
    const targetUserId =
      userId && ["admin", "supermod"].includes(auth.role)
        ? userId
        : auth.userId;

    // Get all ledger entries
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.userId, targetUserId))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(200);

    // Calculate balances
    let totalEarnedUsd = 0;
    let totalEarnedRmb = 0;
    let totalPaidOutUsd = 0;
    let totalPaidOutRmb = 0;

    for (const entry of entries) {
      const usd = parseFloat(entry.amountUsd || "0");
      const rmb = parseFloat(entry.amountRmb || "0");

      if (entry.type === "task_earning" || entry.type === "bonus" || entry.type === "adjustment") {
        totalEarnedUsd += usd;
        totalEarnedRmb += rmb;
      } else if (entry.type === "payout") {
        totalPaidOutUsd += Math.abs(usd);
        totalPaidOutRmb += Math.abs(rmb);
      }
    }

    // Pending = earnings from approved tasks not yet paid out
    const pendingUsd = totalEarnedUsd - totalPaidOutUsd;
    const pendingRmb = totalEarnedRmb - totalPaidOutRmb;

    return NextResponse.json({
      entries,
      summary: {
        totalEarnedUsd: totalEarnedUsd.toFixed(2),
        totalEarnedRmb: totalEarnedRmb.toFixed(2),
        totalPaidOutUsd: totalPaidOutUsd.toFixed(2),
        totalPaidOutRmb: totalPaidOutRmb.toFixed(2),
        availableUsd: pendingUsd.toFixed(2),
        availableRmb: pendingRmb.toFixed(2),
      },
    });
  } catch (error) {
    console.error("Ledger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
