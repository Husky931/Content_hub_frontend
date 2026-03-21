import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  lessons,
  trainerPrompts,
  tests,
  testQuestions,
  userProgress,
  uploadSubmissions,
  users,
  tags,
} from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, sql, count, and, desc } from "drizzle-orm";

// GET /api/training/lessons — list all lessons with stats (admin/supermod only)
export async function GET() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allLessons = await db
      .select({
        id: lessons.id,
        title: lessons.title,
        titleCn: lessons.titleCn,
        description: lessons.description,
        order: lessons.order,
        status: lessons.status,
        tagId: lessons.tagId,
        prerequisiteTagId: lessons.prerequisiteTagId,
        passingScore: lessons.passingScore,
        retryAfterHours: lessons.retryAfterHours,
        createdAt: lessons.createdAt,
      })
      .from(lessons)
      .orderBy(lessons.order);

    // Gather stats for each lesson
    const enriched = await Promise.all(
      allLessons.map(async (lesson) => {
        // Prompt count
        const [promptCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(trainerPrompts)
          .where(eq(trainerPrompts.lessonId, lesson.id));

        // Test question count
        const testRow = await db
          .select({ id: tests.id })
          .from(tests)
          .where(eq(tests.lessonId, lesson.id))
          .limit(1);

        let questionCount = 0;
        let uploadQuestionCount = 0;
        if (testRow.length > 0) {
          const [qCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(testQuestions)
            .where(eq(testQuestions.testId, testRow[0].id));
          questionCount = qCount.count;

          const [uCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(testQuestions)
            .where(
              and(
                eq(testQuestions.testId, testRow[0].id),
                eq(testQuestions.type, "upload")
              )
            );
          uploadQuestionCount = uCount.count;
        }

        // Pass rate
        const [passedCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userProgress)
          .where(
            and(
              eq(userProgress.lessonId, lesson.id),
              eq(userProgress.status, "passed")
            )
          );
        const [totalAttempts] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userProgress)
          .where(eq(userProgress.lessonId, lesson.id));

        const passRate =
          totalAttempts.count > 0
            ? Math.round((passedCount.count / totalAttempts.count) * 100)
            : null;

        // Pending reviews
        let pendingReviews = 0;
        if (testRow.length > 0) {
          const [pCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(uploadSubmissions)
            .innerJoin(
              testQuestions,
              eq(uploadSubmissions.testQuestionId, testQuestions.id)
            )
            .where(
              and(
                eq(testQuestions.testId, testRow[0].id),
                eq(uploadSubmissions.status, "pending")
              )
            );
          pendingReviews = pCount.count;
        }

        // Tag info
        let tagInfo = null;
        if (lesson.tagId) {
          const [t] = await db
            .select({ name: tags.name, nameCn: tags.nameCn, color: tags.color })
            .from(tags)
            .where(eq(tags.id, lesson.tagId));
          tagInfo = t || null;
        }

        let prereqTagInfo = null;
        if (lesson.prerequisiteTagId) {
          const [t] = await db
            .select({ name: tags.name, nameCn: tags.nameCn })
            .from(tags)
            .where(eq(tags.id, lesson.prerequisiteTagId));
          prereqTagInfo = t || null;
        }

        return {
          ...lesson,
          promptCount: promptCount.count,
          questionCount,
          uploadQuestionCount,
          passRate,
          totalAttempts: totalAttempts.count,
          pendingReviews,
          tag: tagInfo,
          prerequisiteTag: prereqTagInfo,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("GET /api/training/lessons error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/training/lessons — create a new lesson
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, titleCn, description, descriptionCn, order } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Determine order: max + 1 if not provided
    let lessonOrder = order;
    if (lessonOrder == null) {
      const [maxOrder] = await db
        .select({ max: sql<number>`coalesce(max(${lessons.order}), 0)` })
        .from(lessons);
      lessonOrder = (maxOrder.max ?? 0) + 1;
    }

    const [newLesson] = await db
      .insert(lessons)
      .values({
        title,
        titleCn: titleCn || null,
        description: description || null,
        descriptionCn: descriptionCn || null,
        order: lessonOrder,
        createdById: auth.userId,
      })
      .returning();

    // Auto-create an empty test for the lesson
    await db.insert(tests).values({ lessonId: newLesson.id });

    return NextResponse.json(newLesson, { status: 201 });
  } catch (err) {
    console.error("POST /api/training/lessons error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
