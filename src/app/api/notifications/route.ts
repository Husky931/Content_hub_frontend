import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { publishNotification } from "@/lib/ws-publish";

// GET /api/notifications — list user's notifications
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";

    const conditions = [eq(notifications.userId, auth.userId)];
    if (unreadOnly) {
      conditions.push(isNull(notifications.readAt));
    }

    const notifs = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    // Get unread count
    const [unreadCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, auth.userId), isNull(notifications.readAt))
      );

    return NextResponse.json({
      notifications: notifs,
      unreadCount: unreadCount.count,
    });
  } catch (error) {
    console.error("List notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications — mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { notificationIds, markAll } = body;

    if (markAll) {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, auth.userId),
            isNull(notifications.readAt)
          )
        );
    } else if (notificationIds && Array.isArray(notificationIds)) {
      for (const id of notificationIds) {
        await db
          .update(notifications)
          .set({ readAt: new Date() })
          .where(
            and(eq(notifications.id, id), eq(notifications.userId, auth.userId))
          );
      }
    }

    // Emit socket event so navbar badge updates in real time
    await publishNotification(auth.userId, { type: "read" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
