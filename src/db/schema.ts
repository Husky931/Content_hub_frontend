import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum("user_role", [
  "creator",
  "mod",
  "supermod",
  "admin",
]);

export const userStatusEnum = pgEnum("user_status", [
  "pending_verification",
  "verified",
  "banned",
]);

export const currencyEnum = pgEnum("currency", ["usd", "rmb"]);

export const channelTypeEnum = pgEnum("channel_type", [
  "special",
  "task",
  "discussion",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "draft",
  "active",
  "locked",
  "approved",
  "paid",
  "archived",
]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "submitted",
  "approved",
  "rejected",
  "blocked",
  "paid",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "mod",
  "system",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "active",
  "used",
  "revoked",
]);

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "task_earning",
  "bonus",
  "adjustment",
  "payout",
]);

export const appealStatusEnum = pgEnum("appeal_status", [
  "pending",
  "granted",
  "denied",
]);

// ============================================================
// 1. USERS
// ============================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    username: varchar("username", { length: 50 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("creator"),
    status: userStatusEnum("status").notNull().default("pending_verification"),
    currency: currencyEnum("currency"),
    displayName: varchar("display_name", { length: 100 }),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    onboardingCompleted: boolean("onboarding_completed")
      .notNull()
      .default(false),
    banReason: text("ban_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_username_idx").on(table.username),
  ]
);

// ============================================================
// 2. VERIFICATION TOKENS
// ============================================================

export const verificationTokens = pgTable("verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// 3. INVITE CODES
// ============================================================

export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 20 }).notNull(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    status: inviteStatusEnum("status").notNull().default("active"),
    usedById: uuid("used_by_id").references(() => users.id),
    maxUses: integer("max_uses").notNull().default(1),
    useCount: integer("use_count").notNull().default(0),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("invite_codes_code_idx").on(table.code)]
);

// ============================================================
// 4. SESSIONS (for JWT invalidation)
// ============================================================

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenJti: text("token_jti").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

// ============================================================
// 5. TAGS
// ============================================================

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  nameCn: varchar("name_cn", { length: 100 }),
  description: text("description"),
  color: varchar("color", { length: 7 }).notNull().default("#5865f2"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// 6. USER TAGS (join table)
// ============================================================

export const userTags = pgTable(
  "user_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    grantedById: uuid("granted_by_id").references(() => users.id),
    grantedAt: timestamp("granted_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_tags_user_tag_idx").on(table.userId, table.tagId),
  ]
);

// ============================================================
// 7. CHANNELS
// ============================================================

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    nameCn: varchar("name_cn", { length: 100 }),
    slug: varchar("slug", { length: 100 }).notNull(),
    type: channelTypeEnum("type").notNull(),
    description: text("description"),
    descriptionCn: text("description_cn"),
    isFixed: boolean("is_fixed").notNull().default(false),
    requiredTagId: uuid("required_tag_id").references(() => tags.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("channels_slug_idx").on(table.slug)]
);

// ============================================================
// 8. CHANNEL MODS (join table)
// ============================================================

export const channelMods = pgTable(
  "channel_mods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("channel_mods_channel_user_idx").on(
      table.channelId,
      table.userId
    ),
  ]
);

// ============================================================
// 9. MESSAGES
// ============================================================

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: messageTypeEnum("type").notNull().default("text"),
    content: text("content").notNull(),
    replyToId: uuid("reply_to_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("messages_channel_id_idx").on(table.channelId),
    index("messages_created_at_idx").on(table.createdAt),
    index("messages_reply_to_id_idx").on(table.replyToId),
  ]
);

// ============================================================
// 10. TASKS (ready for P1)
// ============================================================

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }).notNull(),
    titleCn: varchar("title_cn", { length: 255 }),
    description: text("description").notNull(),
    descriptionCn: text("description_cn"),
    status: taskStatusEnum("status").notNull().default("draft"),
    bountyUsd: decimal("bounty_usd", { precision: 10, scale: 2 }),
    bountyRmb: decimal("bounty_rmb", { precision: 10, scale: 2 }),
    bonusBountyUsd: decimal("bonus_bounty_usd", { precision: 10, scale: 2 }),
    bonusBountyRmb: decimal("bonus_bounty_rmb", { precision: 10, scale: 2 }),
    maxAttempts: integer("max_attempts").notNull().default(5),
    deadline: timestamp("deadline"),
    lockedById: uuid("locked_by_id").references(() => users.id),
    lockExpiresAt: timestamp("lock_expires_at"),
    reviewClaimedById: uuid("review_claimed_by_id").references(() => users.id),
    reviewClaimedAt: timestamp("review_claimed_at"),
    templateData: jsonb("template_data"),
    /** Review checklist items — array of { label: string } */
    checklist: jsonb("checklist").$type<{ label: string }[]>(),
    /** Reference files attached to the task — array of { name, url, type, size } */
    attachments: jsonb("attachments").$type<
      { name: string; url: string; type: string; size: number }[]
    >(),
    /** 'hub' = created in hub, 'backend' = synced from Edtech backend */
    source: varchar("source", { length: 20 }).notNull().default("hub"),
    /** Correlation ID from the Edtech backend (for synced tasks) */
    externalId: varchar("external_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("tasks_channel_id_idx").on(table.channelId),
    index("tasks_status_idx").on(table.status),
  ]
);

// ============================================================
// 11. ATTEMPTS (ready for P1)
// ============================================================

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: attemptStatusEnum("status").notNull().default("submitted"),
    deliverables: jsonb("deliverables"),
    reviewerId: uuid("reviewer_id").references(() => users.id),
    reviewNote: text("review_note"),
    rejectionReason: text("rejection_reason"),
    claimedById: uuid("claimed_by_id").references(() => users.id),
    claimedAt: timestamp("claimed_at"),
    tierRating: varchar("tier_rating", { length: 50 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("attempts_task_id_idx").on(table.taskId),
    index("attempts_user_id_idx").on(table.userId),
  ]
);

// ============================================================
// 12. LEDGER ENTRIES (ready for P1)
// ============================================================

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    attemptId: uuid("attempt_id").references(() => attempts.id, { onDelete: "set null" }),
    type: ledgerEntryTypeEnum("type").notNull(),
    amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }),
    amountRmb: decimal("amount_rmb", { precision: 10, scale: 2 }),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("ledger_entries_user_id_idx").on(table.userId)]
);

// ============================================================
// 13. NOTIFICATIONS (ready for future)
// ============================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    data: jsonb("data"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("notifications_user_id_idx").on(table.userId)]
);

// ============================================================
// 14. APPEALS (ready for future)
// ============================================================

export const appeals = pgTable("appeals", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempts.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  status: appealStatusEnum("status").notNull().default("pending"),
  arbitratorId: uuid("arbitrator_id").references(() => users.id),
  arbitratorNote: text("arbitrator_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// ============================================================
// 15. CHANNEL READS (per-user unread tracking)
// ============================================================

export const channelReads = pgTable(
  "channel_reads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    lastReadMessageId: uuid("last_read_message_id"),
    lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("channel_reads_user_channel_idx").on(
      table.userId,
      table.channelId
    ),
  ]
);

// ============================================================
// RELATIONS
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  tags: many(userTags),
  messages: many(messages),
  sessions: many(sessions),
  moderatedChannels: many(channelMods),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  users: many(userTags),
  channels: many(channels),
}));

export const userTagsRelations = relations(userTags, ({ one }) => ({
  user: one(users, { fields: [userTags.userId], references: [users.id] }),
  tag: one(tags, { fields: [userTags.tagId], references: [tags.id] }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  requiredTag: one(tags, {
    fields: [channels.requiredTagId],
    references: [tags.id],
  }),
  mods: many(channelMods),
  messages: many(messages),
  tasks: many(tasks),
}));

export const channelModsRelations = relations(channelMods, ({ one }) => ({
  channel: one(channels, {
    fields: [channelMods.channelId],
    references: [channels.id],
  }),
  user: one(users, { fields: [channelMods.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
    relationName: "replies",
  }),
  replies: many(messages, { relationName: "replies" }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  channel: one(channels, {
    fields: [tasks.channelId],
    references: [channels.id],
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
  }),
  attempts: many(attempts),
}));

export const attemptsRelations = relations(attempts, ({ one }) => ({
  task: one(tasks, { fields: [attempts.taskId], references: [tasks.id] }),
  user: one(users, { fields: [attempts.userId], references: [users.id] }),
  reviewer: one(users, {
    fields: [attempts.reviewerId],
    references: [users.id],
  }),
}));

export const channelReadsRelations = relations(channelReads, ({ one }) => ({
  user: one(users, { fields: [channelReads.userId], references: [users.id] }),
  channel: one(channels, {
    fields: [channelReads.channelId],
    references: [channels.id],
  }),
}));
