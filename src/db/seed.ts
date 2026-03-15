import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hashSync } from "bcryptjs";
import { eq } from "drizzle-orm";
import { users, channels, tags, inviteCodes } from "./schema";

async function seed() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  console.log("Seeding database (idempotent)...\n");

  // ============================================================
  // 1. ADMIN USER (upsert)
  // ============================================================
  console.log("Admin user...");
  const [existingAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@creatorhub.local"))
    .limit(1);

  let adminId: string;
  if (existingAdmin) {
    adminId = existingAdmin.id;
    console.log("  Already exists, skipping");
  } else {
    const [admin] = await db
      .insert(users)
      .values({
        email: "admin@creatorhub.local",
        username: "admin",
        passwordHash: hashSync("admin123", 12),
        role: "admin",
        status: "verified",
        displayName: "System Admin",
        onboardingCompleted: true,
        currency: "usd",
      })
      .returning();
    adminId = admin.id;
    console.log(`  Created: ${admin.email} (password: admin123)`);
  }

  // ============================================================
  // 2. TAGS (upsert by name)
  // ============================================================
  console.log("\nTags...");
  const tagData = [
    { name: "Voiceover", nameCn: "配音", description: "Voice recording tasks", color: "#5865f2" },
    { name: "Pro Voiceover", nameCn: "专业配音", description: "Advanced voiceover tasks", color: "#9b59b6" },
    { name: "Video Acting", nameCn: "视频表演", description: "Video performance tasks", color: "#e74c3c" },
    { name: "Translation", nameCn: "翻译", description: "Text translation tasks", color: "#2ecc71" },
    { name: "Illustration", nameCn: "插画", description: "Illustration and image tasks", color: "#f39c12" },
  ];

  const tagMap: Record<string, string> = {};
  for (const td of tagData) {
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.name, td.name))
      .limit(1);

    if (existing) {
      tagMap[td.name] = existing.id;
      console.log(`  Tag: ${td.name} (exists)`);
    } else {
      const [inserted] = await db.insert(tags).values(td).returning();
      tagMap[td.name] = inserted.id;
      console.log(`  Tag: ${td.name} (created)`);
    }
  }

  // ============================================================
  // 3. SPECIAL CHANNELS (upsert by slug)
  // ============================================================
  console.log("\nSpecial channels...");
  const specialChannels = [
    { name: "announcements", nameCn: "公告", slug: "announcements", type: "special" as const, description: "System-wide updates, read-only for creators", descriptionCn: "系统公告，创作者只读", isFixed: true, sortOrder: 0 },
    { name: "beginner-training", nameCn: "新手训练", slug: "beginner-training", type: "special" as const, description: "New user training and orientation", descriptionCn: "新用户培训和入门", isFixed: true, sortOrder: 1 },
    { name: "appeals", nameCn: "申诉", slug: "appeals", type: "special" as const, description: "Dispute resolution for rejected tasks", descriptionCn: "被拒任务的争议解决", isFixed: true, sortOrder: 2 },
    { name: "payment-issues", nameCn: "支付问题", slug: "payment-issues", type: "special" as const, description: "Private payment discussions - only visible to supermods and admins", descriptionCn: "私密支付讨论 - 仅超级管理员和管理员可见", isFixed: true, sortOrder: 3 },
  ];

  for (const ch of specialChannels) {
    const [existing] = await db.select({ id: channels.id }).from(channels).where(eq(channels.slug, ch.slug)).limit(1);
    if (existing) {
      console.log(`  #${ch.name} (exists)`);
    } else {
      await db.insert(channels).values(ch);
      console.log(`  #${ch.name} (created)`);
    }
  }

  // ============================================================
  // 4. TASK CHANNELS (upsert by slug)
  // ============================================================
  console.log("\nTask channels...");
  const taskChannels = [
    { name: "voiceover-basic", nameCn: "基础配音", slug: "voiceover-basic", type: "task" as const, description: "Entry-level voiceover tasks", descriptionCn: "入门级配音任务", requiredTagId: tagMap["Voiceover"], sortOrder: 10 },
    { name: "voiceover-pro", nameCn: "专业配音", slug: "voiceover-pro", type: "task" as const, description: "Advanced voiceover tasks", descriptionCn: "高级配音任务", requiredTagId: tagMap["Pro Voiceover"], sortOrder: 11 },
    { name: "video-acting", nameCn: "视频表演", slug: "video-acting", type: "task" as const, description: "Video performance tasks", descriptionCn: "视频表演任务", requiredTagId: tagMap["Video Acting"], sortOrder: 12 },
    { name: "translation", nameCn: "翻译", slug: "translation", type: "task" as const, description: "Text translation tasks", descriptionCn: "文本翻译任务", requiredTagId: tagMap["Translation"], sortOrder: 13 },
    { name: "illustration", nameCn: "插画", slug: "illustration", type: "task" as const, description: "Illustration and image tasks", descriptionCn: "插画和图像任务", requiredTagId: tagMap["Illustration"], sortOrder: 14 },
  ];

  for (const ch of taskChannels) {
    const [existing] = await db.select({ id: channels.id }).from(channels).where(eq(channels.slug, ch.slug)).limit(1);
    if (existing) {
      console.log(`  #${ch.name} (exists)`);
    } else {
      await db.insert(channels).values(ch);
      console.log(`  #${ch.name} (created)`);
    }
  }

  // ============================================================
  // 5. DISCUSSION CHANNELS (upsert by slug)
  // ============================================================
  console.log("\nDiscussion channels...");
  const discussionChannels = [
    { name: "general", nameCn: "综合讨论", slug: "general", type: "discussion" as const, description: "Open discussion for all users", descriptionCn: "所有用户的开放讨论", sortOrder: 20 },
    { name: "feedback", nameCn: "反馈", slug: "feedback", type: "discussion" as const, description: "Product feedback and suggestions", descriptionCn: "产品反馈和建议", sortOrder: 21 },
    { name: "tips", nameCn: "技巧分享", slug: "tips", type: "discussion" as const, description: "Best practices and creator tips", descriptionCn: "最佳实践和创作者技巧", sortOrder: 22 },
    { name: "off-topic", nameCn: "闲聊", slug: "off-topic", type: "discussion" as const, description: "Casual chat", descriptionCn: "休闲聊天", sortOrder: 23 },
  ];

  for (const ch of discussionChannels) {
    const [existing] = await db.select({ id: channels.id }).from(channels).where(eq(channels.slug, ch.slug)).limit(1);
    if (existing) {
      console.log(`  #${ch.name} (exists)`);
    } else {
      await db.insert(channels).values(ch);
      console.log(`  #${ch.name} (created)`);
    }
  }

  // ============================================================
  // 6. INITIAL INVITE CODES (upsert by code)
  // ============================================================
  console.log("\nInvite codes...");
  const codes = [
    { code: "INV-BETA-2024", createdById: adminId, maxUses: 50 },
    { code: "INV-TEST-DEV1", createdById: adminId, maxUses: 10 },
  ];

  for (const c of codes) {
    const [existing] = await db.select({ id: inviteCodes.id }).from(inviteCodes).where(eq(inviteCodes.code, c.code)).limit(1);
    if (existing) {
      console.log(`  ${c.code} (exists)`);
    } else {
      await db.insert(inviteCodes).values(c);
      console.log(`  ${c.code} (created)`);
    }
  }

  console.log("\nSeed completed successfully!");
  console.log("\n--- Login credentials ---");
  console.log("Admin: admin@creatorhub.local / admin123");
  console.log("Invite codes: INV-BETA-2024, INV-TEST-DEV1");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
