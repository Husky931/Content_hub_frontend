import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels, channelMods, users, userTags } from "@/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { eq } from "drizzle-orm";

// Get users who have the channel's required tag + assigned mods/supermods
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const auth = await getAuthFromCookies();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { channelId } = await params;

    const channel = await db
      .select({ id: channels.id, requiredTagId: channels.requiredTagId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .then((rows) => rows[0]);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Fetch assigned mods/supermods for this channel
    const mods = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
      })
      .from(channelMods)
      .innerJoin(users, eq(channelMods.userId, users.id))
      .where(eq(channelMods.channelId, channelId));

    if (!channel.requiredTagId) {
      return NextResponse.json({ members: mods.map((m) => ({ ...m, isMod: true })), noTag: true });
    }

    const tagMembers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        userTagId: userTags.id,
      })
      .from(userTags)
      .innerJoin(users, eq(userTags.userId, users.id))
      .where(eq(userTags.tagId, channel.requiredTagId));

    // Merge: mods on top, then tag members (excluding duplicates)
    const modIds = new Set(mods.map((m) => m.id));
    const combined = [
      ...mods.map((m) => ({ ...m, userTagId: null, isMod: true })),
      ...tagMembers.filter((m) => !modIds.has(m.id)).map((m) => ({ ...m, isMod: false })),
    ];

    return NextResponse.json({
      members: combined,
      tagId: channel.requiredTagId,
    });
  } catch (error) {
    console.error("Channel members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
