import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { locale } = await req.json();
    if (!locale || !["en", "zh"].includes(locale)) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }

    await db
      .update(users)
      .set({ locale, updatedAt: new Date() })
      .where(eq(users.id, auth.userId));

    const response = NextResponse.json({ ok: true });
    // Also set cookie so next-intl picks it up on next request
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Locale update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
