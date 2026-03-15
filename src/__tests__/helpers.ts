/**
 * Shared test helpers for API route testing.
 * Provides mock builders for Drizzle ORM chains and common fixtures.
 */
import { NextRequest } from "next/server";

// ── Request Builders ────────────────────────────────────────────────────────

export function makeGetRequest(url: string, params?: Record<string, string>) {
  const u = new URL(url, "http://localhost");
  if (params) {
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  }
  return new NextRequest(u);
}

export function makePostRequest(url: string, body: object) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export function makePatchRequest(url: string, body: object) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export function makePutRequest(url: string, body: object) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export function makeDeleteRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost"), { method: "DELETE" });
}

// ── Drizzle Mock Builders ───────────────────────────────────────────────────

/** Mocks db.select().from().where().limit() or shorter chains */
export function mockSelectChain(db: any, rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
  const whereMock = jest.fn().mockReturnValue({ limit: limitMock, orderBy: orderByMock });
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    orderBy: jest.fn().mockReturnValue({ limit: limitMock, where: whereMock }),
    innerJoin: jest.fn().mockReturnValue({
      where: whereMock,
      innerJoin: jest.fn().mockReturnValue({
        where: whereMock,
        innerJoin: jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock }),
        orderBy: orderByMock,
      }),
      orderBy: orderByMock,
    }),
    limit: limitMock,
  });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
  return { fromMock, whereMock, limitMock, orderByMock };
}

/** Mocks db.insert().values().returning() */
export function mockInsertChain(db: any, returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  // Also handle cases where .returning() is not called (insert without returning)
  valuesMock.mockReturnValue({ returning: returningMock, then: returningMock.then });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
  return { valuesMock, returningMock };
}

/** Mocks db.update().set().where().returning() */
export function mockUpdateChain(db: any, returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  const setMock = jest.fn().mockReturnValue({ where: whereMock, returning: returningMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
  return { setMock, whereMock, returningMock };
}

/** Mocks db.delete().where() */
export function mockDeleteChain(db: any) {
  const whereMock = jest.fn().mockResolvedValue([]);
  (db.delete as jest.Mock).mockReturnValueOnce({ where: whereMock });
  return { whereMock };
}

// ── Common Fixtures ─────────────────────────────────────────────────────────

export const fixtures = {
  adminAuth: { userId: "admin-1", role: "admin", jti: "jti-admin" },
  modAuth: { userId: "mod-1", role: "mod", jti: "jti-mod" },
  supermodAuth: { userId: "smod-1", role: "supermod", jti: "jti-smod" },
  creatorAuth: { userId: "creator-1", role: "creator", jti: "jti-creator" },

  sampleUser: {
    id: "creator-1",
    email: "creator@test.com",
    username: "creator1",
    displayName: "Creator One",
    role: "creator",
    status: "verified",
    currency: "usd",
    avatarUrl: null,
    bio: "A test creator",
    onboardingCompleted: true,
    createdAt: new Date("2024-01-01"),
  },

  sampleChannel: {
    id: "ch-1",
    name: "voiceover-basic",
    nameCn: null,
    slug: "voiceover-basic",
    type: "task",
    description: "Basic voiceover tasks",
    descriptionCn: null,
    isFixed: false,
    requiredTagId: "tag-1",
    sortOrder: 1,
  },

  sampleTask: {
    id: "task-1",
    channelId: "ch-1",
    createdById: "mod-1",
    title: "Record Greeting",
    titleCn: null,
    description: "Record a greeting message",
    descriptionCn: null,
    status: "active",
    bountyUsd: "10.00",
    bountyRmb: "70.00",
    bonusBountyUsd: null,
    bonusBountyRmb: null,
    maxAttempts: 5,
    deadline: null,
    reviewClaimedById: null,
    reviewClaimedAt: null,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },

  sampleAttempt: {
    id: "attempt-1",
    taskId: "task-1",
    userId: "creator-1",
    status: "submitted",
    deliverables: { text: "My deliverable" },
    reviewerId: null,
    reviewNote: null,
    rejectionReason: null,
    createdAt: new Date("2024-01-16"),
    updatedAt: new Date("2024-01-16"),
  },

  sampleTag: {
    id: "tag-1",
    name: "Voiceover",
    nameCn: "配音",
    description: "Basic voiceover",
    color: "#5865f2",
    createdAt: new Date("2024-01-01"),
  },

  sampleLedgerEntry: {
    id: "ledger-1",
    userId: "creator-1",
    taskId: "task-1",
    attemptId: "attempt-1",
    type: "task_earning",
    amountUsd: "10.00",
    amountRmb: "70.00",
    description: "Earning for task: Record Greeting",
    createdAt: new Date("2024-01-17"),
  },

  sampleNotification: {
    id: "notif-1",
    userId: "creator-1",
    type: "task_approved",
    title: "Task approved!",
    body: 'Your submission for "Record Greeting" was approved.',
    data: { taskId: "task-1" },
    readAt: null,
    createdAt: new Date("2024-01-17"),
  },
};
