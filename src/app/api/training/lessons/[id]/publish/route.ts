import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lessons, trainerPrompts, tests, testQuestions } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, sql, and } from "drizzle-orm";

// PUT /api/training/lessons/:id/publish — publish or unpublish a lesson
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
    const { action } = body; // "publish" or "unpublish"

    const [lesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, id));

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (action === "publish") {
      // Validate: at least 1 prompt
      const [promptCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(trainerPrompts)
        .where(eq(trainerPrompts.lessonId, id));

      if (promptCount.count === 0) {
        return NextResponse.json(
          { error: "Cannot publish: add at least one trainer prompt" },
          { status: 400 }
        );
      }

      // Validate: at least 1 test question
      const [test] = await db
        .select()
        .from(tests)
        .where(eq(tests.lessonId, id));

      if (test) {
        const [qCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(testQuestions)
          .where(eq(testQuestions.testId, test.id));

        if (qCount.count === 0) {
          return NextResponse.json(
            { error: "Cannot publish: add at least one test question" },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Cannot publish: test not found" },
          { status: 400 }
        );
      }

      // Validate: tag bound
      if (!lesson.tagId) {
        return NextResponse.json(
          { error: "Cannot publish: bind a tag to this lesson first" },
          { status: 400 }
        );
      }

      await db
        .update(lessons)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(lessons.id, id));
    } else {
      // Unpublish
      await db
        .update(lessons)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(lessons.id, id));
    }

    const [updated] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, id));

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/training/lessons/:id/publish error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
