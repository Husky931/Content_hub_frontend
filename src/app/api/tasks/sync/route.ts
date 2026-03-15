import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, channels, users, messages, notifications, userTags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { publishSystemMessage, publishTaskUpdate } from "@/lib/ws-publish";

const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

/**
 * POST /api/tasks/sync — incoming endpoint for Edtech backend to push new tasks.
 *
 * Auth: X-API-Key header must match BACKEND_API_KEY env var.
 *
 * Body:
 * {
 *   channelSlug: string,         // target channel slug
 *   title: string,
 *   titleCn?: string,
 *   description: string,
 *   descriptionCn?: string,
 *   bountyUsd?: string,
 *   bountyRmb?: string,
 *   bonusBountyUsd?: string,
 *   bonusBountyRmb?: string,
 *   maxAttempts?: number,
 *   deadline?: string (ISO),
 *   externalId?: string,          // backend's task ID for correlation
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Validate API key
    if (!BACKEND_API_KEY) {
      return NextResponse.json(
        { error: "Backend integration not configured" },
        { status: 503 }
      );
    }

    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== BACKEND_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      channelSlug,
      title,
      titleCn,
      description,
      descriptionCn,
      bountyUsd,
      bountyRmb,
      bonusBountyUsd,
      bonusBountyRmb,
      maxAttempts,
      deadline,
      externalId,
    } = body;

    // Validate required fields
    if (!channelSlug || !title || !description) {
      return NextResponse.json(
        { error: "channelSlug, title, and description are required" },
        { status: 400 }
      );
    }

    // Find the target channel
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.slug, channelSlug))
      .limit(1);

    if (!channel) {
      return NextResponse.json(
        { error: `Channel '${channelSlug}' not found` },
        { status: 404 }
      );
    }

    if (channel.type !== "task") {
      return NextResponse.json(
        { error: "Target channel must be a task channel" },
        { status: 400 }
      );
    }

    // Use the first admin as the creator for synced tasks
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    if (!admin) {
      return NextResponse.json(
        { error: "No admin user found to assign as task creator" },
        { status: 500 }
      );
    }

    // Create the task
    const [newTask] = await db
      .insert(tasks)
      .values({
        channelId: channel.id,
        createdById: admin.id,
        title,
        titleCn: titleCn || null,
        description,
        descriptionCn: descriptionCn || null,
        bountyUsd: bountyUsd || null,
        bountyRmb: bountyRmb || null,
        bonusBountyUsd: bonusBountyUsd || null,
        bonusBountyRmb: bonusBountyRmb || null,
        maxAttempts: maxAttempts || 5,
        deadline: deadline ? new Date(deadline) : null,
        status: "active",
        source: "backend",
        externalId: externalId || null,
      })
      .returning();

    // Post system message
    const sysContent = `New task synced: "${title}". Bounty: $${bountyUsd || "0"} / ¥${bountyRmb || "0"}`;
    const [sysMsg] = await db.insert(messages).values({
      channelId: channel.id,
      userId: admin.id,
      type: "system",
      content: sysContent,
    }).returning();

    // Notify users with the required tag
    if (channel.requiredTagId) {
      const taggedUsers = await db
        .select({ userId: userTags.userId })
        .from(userTags)
        .where(eq(userTags.tagId, channel.requiredTagId));

      if (taggedUsers.length > 0) {
        await db.insert(notifications).values(
          taggedUsers.map((u) => ({
            userId: u.userId,
            type: "new_task",
            title: "New task available",
            body: `"${title}" is now available.`,
            data: { taskId: newTask.id, channelSlug },
          }))
        );
      }
    }

    // Real-time broadcast
    publishSystemMessage(channelSlug, { id: sysMsg.id, type: "system", content: sysContent, createdAt: sysMsg.createdAt });
    publishTaskUpdate(channelSlug, { id: newTask.id, status: "active", title });

    return NextResponse.json(
      {
        task: {
          id: newTask.id,
          title: newTask.title,
          status: newTask.status,
          channelSlug,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Task sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
