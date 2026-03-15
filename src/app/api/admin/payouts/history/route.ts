import { NextResponse } from "next/server";
import { db } from "@/db";
import { ledgerEntries, users } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

// GET /api/admin/payouts/history — list all executed payouts (admin + supermod)
export async function GET() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allPayouts = await db
      .select({
        id: ledgerEntries.id,
        userId: ledgerEntries.userId,
        amountUsd: ledgerEntries.amountUsd,
        amountRmb: ledgerEntries.amountRmb,
        description: ledgerEntries.description,
        createdAt: ledgerEntries.createdAt,
        username: users.username,
        displayName: users.displayName,
      })
      .from(ledgerEntries)
      .innerJoin(users, eq(ledgerEntries.userId, users.id))
      .where(eq(ledgerEntries.type, "payout"))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(100);

    return NextResponse.json({ history: allPayouts });
  } catch (error) {
    console.error("Payout history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
