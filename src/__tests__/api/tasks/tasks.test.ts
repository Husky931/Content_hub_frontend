import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/tasks/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeGetReq(params?: Record<string, string>) {
  const u = new URL("http://localhost/api/tasks");
  if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new NextRequest(u);
}

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/tasks", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/** Multi-purpose select mock that handles various chain shapes.
 *  All terminal methods (where, orderBy, groupBy) are thenable so
 *  routes that await them without calling .limit() still work. */
function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const groupByMock = jest.fn().mockResolvedValue(rows);
  const orderByResult = Object.assign(Promise.resolve(rows), { limit: limitMock, where: undefined as any });
  const orderByMock = jest.fn().mockReturnValue(orderByResult);
  const whereResult = Object.assign(Promise.resolve(rows), {
    limit: limitMock,
    orderBy: orderByMock,
    groupBy: groupByMock,
  });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  // Fix circular ref
  orderByResult.where = whereMock;
  const innerJoinMock3 = jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  const innerJoinMock2 = jest.fn().mockReturnValue({
    where: whereMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock3,
  });
  const innerJoinMock = jest.fn().mockReturnValue({
    where: whereMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock2,
  });
  const fromResult = Object.assign(Promise.resolve(rows), {
    where: whereMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock,
    limit: limitMock,
    groupBy: groupByMock,
  });
  const fromMock = jest.fn().mockReturnValue(fromResult);
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
  return { fromMock, whereMock };
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
  return { valuesMock, returningMock };
}

const sampleTaskRow = {
  id: "task-1",
  channelId: "ch-1",
  title: "Test Task",
  titleCn: null,
  description: "A test task",
  descriptionCn: null,
  status: "active",
  bountyUsd: "10.00",
  bountyRmb: "70.00",
  bonusBountyUsd: null,
  bonusBountyRmb: null,
  maxAttempts: 5,
  deadline: null,
  createdAt: new Date(),
  channelName: "voiceover-basic",
  channelSlug: "voiceover-basic",
  createdByUsername: "mod1",
  createdByDisplayName: "Mod One",
  reviewClaimedById: null,
};

beforeEach(() => jest.clearAllMocks());

// ── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/tasks", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeGetReq());
    expect(res.status).toBe(401);
  });

  it("returns tasks list for admin (bypasses tag filter)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "admin-1", role: "admin" });
    // Main tasks query
    mockSelect([sampleTaskRow]);
    // Attempt counts
    mockSelect([{ taskId: "task-1", count: 2 }]);
    // Submitted counts
    mockSelect([{ taskId: "task-1", count: 1 }]);
    // Reviewer names (no reviewers)
    // myAttempts
    mockSelect([]);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tasks).toHaveLength(1);
    expect(json.tasks[0].title).toBe("Test Task");
    expect(json.tasks[0].attemptCount).toBe(2);
    expect(json.tasks[0].submittedCount).toBe(1);
  });

  it("filters by tag for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    // User tags query
    mockSelect([{ tagId: "tag-1" }]);
    // Main tasks query
    mockSelect([sampleTaskRow]);
    // Attempt counts
    mockSelect([{ taskId: "task-1", count: 0 }]);
    // Submitted counts
    mockSelect([]);
    // myAttempts
    mockSelect([]);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
  });
});

// ── POST Tests ─────────────────────────────────────────────────────────────

describe("POST /api/tasks", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makePostReq({ channelId: "ch-1", title: "t", description: "d" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makePostReq({ channelId: "ch-1", title: "t", description: "d" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await POST(makePostReq({ title: "t" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 404 when channel not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([]); // channel lookup returns empty

    const res = await POST(makePostReq({
      channelId: "nonexistent",
      title: "Test",
      description: "Desc",
    }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when channel is not a task channel", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([{ id: "ch-general", type: "discussion", slug: "general" }]);

    const res = await POST(makePostReq({
      channelId: "ch-general",
      title: "Test",
      description: "Desc",
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/task channel/i);
  });

  it("creates draft task successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const channel = { id: "ch-1", type: "task", slug: "voiceover-basic", requiredTagId: "tag-1" };
    mockSelect([channel]); // channel lookup
    const newTask = {
      id: "task-new",
      channelId: "ch-1",
      status: "draft",
      title: "New Task",
      description: "Desc",
      bountyUsd: "15.00",
      bountyRmb: "100.00",
    };
    mockInsert([newTask]); // insert task

    const res = await POST(makePostReq({
      channelId: "ch-1",
      title: "New Task",
      description: "Desc",
      bountyUsd: "15.00",
      bountyRmb: "100.00",
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.task.title).toBe("New Task");
  });

  it("creates active task with system message and notifications", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const channel = { id: "ch-1", type: "task", slug: "voiceover-basic", requiredTagId: "tag-1" };
    mockSelect([channel]); // channel lookup
    const newTask = {
      id: "task-active",
      channelId: "ch-1",
      status: "active",
      title: "Active Task",
    };
    mockInsert([newTask]); // insert task
    // Get creator display name
    mockSelect([{ username: "mod1", displayName: "Mod One" }]);
    // Insert system message
    mockInsert([]);
    // Notify tagged users
    mockSelect([{ userId: "c1" }, { userId: "c2" }]);
    mockInsert([]); // insert notifications

    const res = await POST(makePostReq({
      channelId: "ch-1",
      title: "Active Task",
      description: "Desc",
      status: "active",
    }));
    expect(res.status).toBe(201);
  });
});
