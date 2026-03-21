import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  lessons,
  trainerPrompts,
  tests,
  testQuestions,
  tags,
  userProgress,
} from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, asc, and, sql } from "drizzle-orm";

// GET /api/training/lessons/:id — full lesson detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [lesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, id));

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Get prompts
    const prompts = await db
      .select()
      .from(trainerPrompts)
      .where(eq(trainerPrompts.lessonId, id))
      .orderBy(asc(trainerPrompts.order));

    // Get test + questions
    const [test] = await db
      .select()
      .from(tests)
      .where(eq(tests.lessonId, id));

    let questions: (typeof testQuestions.$inferSelect)[] = [];
    if (test) {
      questions = await db
        .select()
        .from(testQuestions)
        .where(eq(testQuestions.testId, test.id))
        .orderBy(asc(testQuestions.sortOrder));
    }

    // Tag info
    let tagInfo = null;
    if (lesson.tagId) {
      const [t] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, lesson.tagId));
      tagInfo = t || null;
    }

    let prereqTagInfo = null;
    if (lesson.prerequisiteTagId) {
      const [t] = await db
        .select()
        .from(tags)
        .where(eq(tags.id, lesson.prerequisiteTagId));
      prereqTagInfo = t || null;
    }

    // Stats
    const [passedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProgress)
      .where(
        and(
          eq(userProgress.lessonId, id),
          eq(userProgress.status, "passed")
        )
      );
    const [totalCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProgress)
      .where(eq(userProgress.lessonId, id));

    return NextResponse.json({
      ...lesson,
      prompts,
      test: test ? { ...test, questions } : null,
      tag: tagInfo,
      prerequisiteTag: prereqTagInfo,
      stats: {
        passRate:
          totalCount.count > 0
            ? Math.round((passedCount.count / totalCount.count) * 100)
            : null,
        totalAttempts: totalCount.count,
        passedCount: passedCount.count,
      },
    });
  } catch (err) {
    console.error("GET /api/training/lessons/:id error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/training/lessons/:id — update lesson metadata
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

    const {
      title,
      titleCn,
      description,
      descriptionCn,
      order,
      prerequisiteTagId,
      passingScore,
      retryAfterHours,
      tagId,
    } = body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (titleCn !== undefined) updates.titleCn = titleCn || null;
    if (description !== undefined) updates.description = description || null;
    if (descriptionCn !== undefined)
      updates.descriptionCn = descriptionCn || null;
    if (order !== undefined) updates.order = order;
    if (prerequisiteTagId !== undefined)
      updates.prerequisiteTagId = prerequisiteTagId || null;
    if (passingScore !== undefined) updates.passingScore = passingScore;
    if (retryAfterHours !== undefined) updates.retryAfterHours = retryAfterHours;
    if (tagId !== undefined) updates.tagId = tagId || null;

    const [updated] = await db
      .update(lessons)
      .set(updates)
      .where(eq(lessons.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/training/lessons/:id error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/training/lessons/:id — delete/archive lesson
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

    // Check if any users have progress — if so, soft-archive by setting to draft
    const [progressCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProgress)
      .where(eq(userProgress.lessonId, id));

    if (progressCount.count > 0) {
      // Soft archive — just unpublish
      await db
        .update(lessons)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(lessons.id, id));
      return NextResponse.json({ archived: true });
    }

    // Hard delete (cascades to prompts, test, questions)
    await db.delete(lessons).where(eq(lessons.id, id));
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /api/training/lessons/:id error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
