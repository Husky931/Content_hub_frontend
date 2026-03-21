import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { trainerPrompts, lessons } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, sql, asc } from "drizzle-orm";

// POST /api/training/lessons/:id/prompts — create a trainer prompt
export async function POST(
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
    const { content, resources } = body;

    // Verify lesson exists
    const [lesson] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.id, id));
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Auto-assign next order
    const [maxOrder] = await db
      .select({
        max: sql<number>`coalesce(max(${trainerPrompts.order}), -1)`,
      })
      .from(trainerPrompts)
      .where(eq(trainerPrompts.lessonId, id));

    const [newPrompt] = await db
      .insert(trainerPrompts)
      .values({
        lessonId: id,
        order: (maxOrder.max ?? -1) + 1,
        content: content || "",
        resources: resources || null,
      })
      .returning();

    return NextResponse.json(newPrompt, { status: 201 });
  } catch (err) {
    console.error("POST prompts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/training/lessons/:id/prompts — reorder prompts
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
    const { ids } = (await req.json()) as { ids: string[] };

    // Update order for each prompt
    await Promise.all(
      ids.map((promptId, index) =>
        db
          .update(trainerPrompts)
          .set({ order: index, updatedAt: new Date() })
          .where(eq(trainerPrompts.id, promptId))
      )
    );

    // Return updated list
    const updated = await db
      .select()
      .from(trainerPrompts)
      .where(eq(trainerPrompts.lessonId, id))
      .orderBy(asc(trainerPrompts.order));

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT prompts reorder error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
