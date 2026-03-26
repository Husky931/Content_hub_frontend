import { NextRequest } from "next/server";
import { POST } from "@/app/api/tasks/[taskId]/lock/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("@/lib/ws-publish", () => ({
  publishSystemMessage: jest.fn().mockResolvedValue(undefined),
  publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
  publishNotification: jest.fn().mockResolvedValue(undefined),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsPromise = Promise.resolve({ taskId: "task-1" });

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/tasks/task-1/lock", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
  const whereResult = Object.assign(Promise.resolve(rows), {
    limit: limitMock,
    orderBy: orderByMock,
  });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, limit: limitMock, orderBy: orderByMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdate() {
  const whereMock = jest.fn().mockResolvedValue([]);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

const activeTask = {
  id: "task-1",
  title: "Test Task",
  status: "active",
  channelId: "ch-1",
};

const completedTask = {
  id: "task-1",
  title: "Test Task",
  status: "completed",
  channelId: "ch-1",
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/tasks/[taskId]/lock", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeReq({ creatorId: "c1" }), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makeReq({ creatorId: "c1" }), { params: paramsPromise });
    expect(res.status).toBe(403);
  });

  it("returns 400 when creatorId is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await POST(makeReq({}), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/creatorId/i);
  });

  it("returns 404 when task not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([]); // task not found

    const res = await POST(makeReq({ creatorId: "c1" }), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 400 when task is not active", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([completedTask]);

    const res = await POST(makeReq({ creatorId: "c1" }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/active/i);
  });

  it("returns 200 and locks the task successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "admin" });
    mockSelect([activeTask]); // task found
    mockUpdate(); // update task to locked
    mockUpdate(); // auto-reject attempt
    mockSelect([{ username: "creator1", displayName: "Creator One" }]); // creator name
    mockSelect([{ slug: "general" }]); // channel slug
    mockInsert([{ id: "msg-sys", type: "system", content: "locked", createdAt: new Date() }]); // system message
    mockInsert([{ id: "notif-1", title: "Task locked for you" }]); // notification

    const res = await POST(makeReq({ creatorId: "c1" }), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.lockExpiresAt).toBeDefined();
  });
});
