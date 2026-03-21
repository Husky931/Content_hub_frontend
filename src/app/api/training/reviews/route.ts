import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  uploadSubmissions,
  testQuestions,
  tests,
  lessons,
  users,
  userProgress,
} from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, and, sql, desc } from "drizzle-orm";

// GET /api/training/reviews — list upload submissions for review
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod", "mod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const status = req.nextUrl.searchParams.get("status");
    const lessonId = req.nextUrl.searchParams.get("lessonId");

    let query = db
      .select({
        id: uploadSubmissions.id,
        fileUrl: uploadSubmissions.fileUrl,
        fileName: uploadSubmissions.fileName,
        fileType: uploadSubmissions.fileType,
        fileSize: uploadSubmissions.fileSize,
        status: uploadSubmissions.status,
        rejectionReason: uploadSubmissions.rejectionReason,
        reviewedAt: uploadSubmissions.reviewedAt,
        createdAt: uploadSubmissions.createdAt,
        questionPrompt: testQuestions.prompt,
        questionType: testQuestions.type,
        questionSortOrder: testQuestions.sortOrder,
        lessonTitle: lessons.title,
        lessonId: lessons.id,
        userName: users.username,
        userDisplayName: users.displayName,
        userAvatarUrl: users.avatarUrl,
        userId: users.id,
        userProgressId: uploadSubmissions.userProgressId,
        reviewerId: uploadSubmissions.reviewerId,
      })
      .from(uploadSubmissions)
      .innerJoin(
        testQuestions,
        eq(uploadSubmissions.testQuestionId, testQuestions.id)
      )
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .innerJoin(lessons, eq(tests.lessonId, lessons.id))
      .innerJoin(users, eq(uploadSubmissions.userId, users.id))
      .orderBy(desc(uploadSubmissions.createdAt))
      .$dynamic();

    // Apply filters via where clauses
    const conditions = [];
    if (status && status !== "all") {
      conditions.push(
        eq(
          uploadSubmissions.status,
          status as "pending" | "approved" | "rejected"
        )
      );
    }
    if (lessonId) {
      conditions.push(eq(lessons.id, lessonId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query;

    // Enrich with user progress data (cheating warnings, attempts, test scores)
    const enriched = await Promise.all(
      results.map(async (sub) => {
        const [progress] = await db
          .select({
            attempts: userProgress.attempts,
            cheatingWarnings: userProgress.cheatingWarnings,
            score: userProgress.score,
            testAnswers: userProgress.testAnswers,
          })
          .from(userProgress)
          .where(eq(userProgress.id, sub.userProgressId));

        // Get reviewer info if reviewed
        let reviewerName = null;
        if (sub.reviewerId) {
          const [reviewer] = await db
            .select({
              username: users.username,
              displayName: users.displayName,
            })
            .from(users)
            .where(eq(users.id, sub.reviewerId));
          reviewerName =
            reviewer?.displayName || reviewer?.username || null;
        }

        // Get tag on pass
        const [lesson] = await db
          .select({ tagId: lessons.tagId })
          .from(lessons)
          .where(eq(lessons.id, sub.lessonId));

        return {
          ...sub,
          cheatingWarnings: progress?.cheatingWarnings || 0,
          lessonAttempts: progress?.attempts || 0,
          autoScore: progress?.score || 0,
          reviewerName,
          tagOnPass: lesson?.tagId || null,
        };
      })
    );

    // Stats
    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(uploadSubmissions)
      .where(eq(uploadSubmissions.status, "pending"));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [approvedToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(uploadSubmissions)
      .where(
        and(
          eq(uploadSubmissions.status, "approved"),
          sql`${uploadSubmissions.reviewedAt} >= ${today}`
        )
      );

    const [rejectedToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(uploadSubmissions)
      .where(
        and(
          eq(uploadSubmissions.status, "rejected"),
          sql`${uploadSubmissions.reviewedAt} >= ${today}`
        )
      );

    return NextResponse.json({
      submissions: enriched,
      stats: {
        pending: pendingCount.count,
        approvedToday: approvedToday.count,
        rejectedToday: rejectedToday.count,
      },
    });
  } catch (err) {
    console.error("GET /api/training/reviews error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
