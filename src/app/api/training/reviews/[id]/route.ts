import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  uploadSubmissions,
  userProgress,
  lessons,
  userTags,
  testQuestions,
  tests,
  notifications,
} from "@/db/schema";
import { publishNotification } from "@/lib/ws-publish";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";

// POST /api/training/reviews/:id — approve or reject an upload submission
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || !["admin", "supermod", "mod"].includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reason } = body as {
      action: "approve" | "reject";
      reason?: string;
    };

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Get the submission
    const [submission] = await db
      .select()
      .from(uploadSubmissions)
      .where(eq(uploadSubmissions.id, id));

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (submission.status !== "pending") {
      return NextResponse.json(
        { error: "Already reviewed" },
        { status: 400 }
      );
    }

    // Update submission
    await db
      .update(uploadSubmissions)
      .set({
        status: action === "approve" ? "approved" : "rejected",
        reviewerId: auth.userId,
        reviewedAt: new Date(),
        rejectionReason: action === "reject" ? reason || null : null,
      })
      .where(eq(uploadSubmissions.id, id));

    // Check if this was the last pending upload for this user progress
    const [remainingPending] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(uploadSubmissions)
      .where(
        and(
          eq(uploadSubmissions.userProgressId, submission.userProgressId),
          eq(uploadSubmissions.status, "pending")
        )
      );

    let testStatus: string = "pending_review";
    let tagAwarded = false;
    let tagId: string | null = null;

    if (remainingPending.count === 0) {
      // All uploads reviewed — finalize test
      const [progress] = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.id, submission.userProgressId));

      if (progress) {
        // Check if any upload was rejected
        const [rejectedCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(uploadSubmissions)
          .where(
            and(
              eq(uploadSubmissions.userProgressId, submission.userProgressId),
              eq(uploadSubmissions.status, "rejected")
            )
          );

        const [lesson] = await db
          .select()
          .from(lessons)
          .where(eq(lessons.id, progress.lessonId));

        if (rejectedCount.count > 0) {
          // Failed — any rejection fails the test
          testStatus = "failed";
          await db
            .update(userProgress)
            .set({
              status: "failed",
              retryAfter: new Date(
                Date.now() +
                  (lesson?.retryAfterHours || 24) * 60 * 60 * 1000
              ),
              updatedAt: new Date(),
            })
            .where(eq(userProgress.id, submission.userProgressId));
        } else {
          // All approved — check score
          const score = progress.score || 0;
          const passingScore = lesson?.passingScore || 100;

          if (score >= passingScore) {
            testStatus = "passed";
            await db
              .update(userProgress)
              .set({
                status: "passed",
                completedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(userProgress.id, submission.userProgressId));

            // Award tag
            if (lesson?.tagId) {
              tagId = lesson.tagId;
              const [existing] = await db
                .select()
                .from(userTags)
                .where(
                  and(
                    eq(userTags.userId, progress.userId),
                    eq(userTags.tagId, lesson.tagId)
                  )
                );

              if (!existing) {
                await db.insert(userTags).values({
                  userId: progress.userId,
                  tagId: lesson.tagId,
                  grantedAt: new Date(),
                });
                tagAwarded = true;

                // Fire webhook
                const webhookUrl = process.env.BACKEND_WEBHOOK_URL;
                if (webhookUrl) {
                  fetch(webhookUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "X-Webhook-Event": "tag.awarded",
                      "X-API-Key": process.env.BACKEND_API_KEY || "",
                    },
                    body: JSON.stringify({
                      userId: progress.userId,
                      tagId: lesson.tagId,
                      lessonId: lesson.id,
                      score,
                      passedAt: new Date().toISOString(),
                    }),
                  }).catch(() => {});
                }
              }
            }
          } else {
            testStatus = "failed";
            await db
              .update(userProgress)
              .set({
                status: "failed",
                retryAfter: new Date(
                  Date.now() +
                    (lesson?.retryAfterHours || 24) * 60 * 60 * 1000
                ),
                updatedAt: new Date(),
              })
              .where(eq(userProgress.id, submission.userProgressId));
          }
        }
      }
    }

    // Notify the creator of the final result (after all uploads reviewed)
    if (testStatus === "passed" || testStatus === "failed") {
      const [progress] = await db
        .select({ userId: userProgress.userId, lessonId: userProgress.lessonId, score: userProgress.score })
        .from(userProgress)
        .where(eq(userProgress.id, submission.userProgressId));

      if (progress) {
        const [lessonInfo] = await db
          .select({ title: lessons.title })
          .from(lessons)
          .where(eq(lessons.id, progress.lessonId));

        const lessonTitle = lessonInfo?.title || "Training";

        if (testStatus === "passed") {
          await db.insert(notifications).values({
            userId: progress.userId,
            type: "training_passed",
            title: "Training passed!",
            body: `Your upload for "${lessonTitle}" was approved. You passed with ${progress.score}%! A new tag has been awarded.`,
            data: { lessonId: progress.lessonId, score: progress.score },
          });
        } else {
          await db.insert(notifications).values({
            userId: progress.userId,
            type: "training_failed",
            title: "Training not passed",
            body: `Your upload for "${lessonTitle}" was reviewed. Unfortunately you did not pass. You can retry later.`,
            data: { lessonId: progress.lessonId, score: progress.score },
          });
        }

        publishNotification(progress.userId, {
          type: testStatus === "passed" ? "training_passed" : "training_failed",
          title: testStatus === "passed" ? "Training passed!" : "Training not passed",
          unreadCount: -1,
        });
      }
    }

    return NextResponse.json({
      testStatus,
      tagAwarded,
      tagId,
    });
  } catch (err) {
    console.error("POST /api/training/reviews/:id error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
