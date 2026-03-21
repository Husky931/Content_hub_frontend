import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testQuestions, tests } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, sql, asc } from "drizzle-orm";

// POST /api/training/lessons/:id/questions — create a test question
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: lessonId } = await params;
    const body = await req.json();
    const { type, prompt, promptCn, options, correctAnswers, points } = body;

    if (!type || !prompt) {
      return NextResponse.json(
        { error: "type and prompt are required" },
        { status: 400 }
      );
    }

    // Find test for this lesson
    const [test] = await db
      .select()
      .from(tests)
      .where(eq(tests.lessonId, lessonId));

    if (!test) {
      return NextResponse.json(
        { error: "Test not found for this lesson" },
        { status: 404 }
      );
    }

    // Auto-assign sort order
    const [maxOrder] = await db
      .select({
        max: sql<number>`coalesce(max(${testQuestions.sortOrder}), -1)`,
      })
      .from(testQuestions)
      .where(eq(testQuestions.testId, test.id));

    const [newQuestion] = await db
      .insert(testQuestions)
      .values({
        testId: test.id,
        type,
        prompt,
        promptCn: promptCn || null,
        options: options || null,
        correctAnswers: correctAnswers || null,
        points: points || 25,
        sortOrder: (maxOrder.max ?? -1) + 1,
      })
      .returning();

    return NextResponse.json(newQuestion, { status: 201 });
  } catch (err) {
    console.error("POST question error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/training/lessons/:id/questions — reorder questions
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ids } = (await req.json()) as { ids: string[] };

    await Promise.all(
      ids.map((qId, index) =>
        db
          .update(testQuestions)
          .set({ sortOrder: index })
          .where(eq(testQuestions.id, qId))
      )
    );

    return NextResponse.json({ reordered: true });
  } catch (err) {
    console.error("PUT questions reorder error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
