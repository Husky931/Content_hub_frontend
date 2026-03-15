import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tags, userTags } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, asc } from "drizzle-orm";

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
