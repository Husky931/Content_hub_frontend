import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tags, userTags } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, asc, count } from "drizzle-orm";

export async function GET() {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allTags = await db
      .select()
      .from(tags)
      .orderBy(asc(tags.name));

    return NextResponse.json({ tags: allTags });
  } catch (error) {
    console.error("Tags error:", error);
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

    const { name, nameCn, description, color } = await req.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
    }

    const existing = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.name, name.trim()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 409 }
      );
    }

    const [newTag] = await db
      .insert(tags)
      .values({
        name: name.trim(),
        nameCn: nameCn?.trim() || null,
        description: description?.trim() || null,
        color: color || "#5865f2",
      })
      .returning();

    return NextResponse.json({ tag: newTag });
  } catch (error) {
    console.error("Create tag error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 });
    }

    // Check how many users have this tag assigned
    const [usage] = await db
      .select({ total: count() })
      .from(userTags)
      .where(eq(userTags.tagId, id));

    if (usage && usage.total > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${usage.total} user(s) still have this tag assigned. Remove it from all users first.` },
        { status: 409 }
      );
    }

    const deleted = await db.delete(tags).where(eq(tags.id, id)).returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete tag error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
