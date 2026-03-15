import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes, users } from "@/db/schema";
import { getAuthFromCookies, generateInviteCode } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const codes = await db
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        status: inviteCodes.status,
        maxUses: inviteCodes.maxUses,
        useCount: inviteCodes.useCount,
        expiresAt: inviteCodes.expiresAt,
        createdAt: inviteCodes.createdAt,
        createdByUsername: users.username,
      })
      .from(inviteCodes)
      .innerJoin(users, eq(inviteCodes.createdById, users.id))
      .orderBy(desc(inviteCodes.createdAt));

    return NextResponse.json({ codes });
  } catch (error) {
    console.error("Invite codes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { maxUses, expiresInDays } = await req.json();

    const code = generateInviteCode();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const [newCode] = await db
      .insert(inviteCodes)
      .values({
        code,
        createdById: auth.userId,
        maxUses: maxUses || 1,
        expiresAt,
      })
      .returning();

    return NextResponse.json({ code: newCode });
  } catch (error) {
    console.error("Create invite code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { codeId, action } = await req.json();

    if (!codeId || action !== "revoke") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await db
      .update(inviteCodes)
      .set({ status: "revoked" })
      .where(eq(inviteCodes.id, codeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke invite code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
