import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testQuestions } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/training/questions/:id — update a test question
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { type, prompt, promptCn, options, correctAnswers, points } = body;

    const updates: Record<string, unknown> = {};
    if (type !== undefined) updates.type = type;
    if (prompt !== undefined) updates.prompt = prompt;
    if (promptCn !== undefined) updates.promptCn = promptCn || null;
    if (options !== undefined) updates.options = options;
    if (correctAnswers !== undefined) updates.correctAnswers = correctAnswers;
    if (points !== undefined) updates.points = points;

    const [updated] = await db
      .update(testQuestions)
      .set(updates)
      .where(eq(testQuestions.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT question error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/training/questions/:id — delete a test question
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await db.delete(testQuestions).where(eq(testQuestions.id, id));
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("DELETE question error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
