import { NextRequest } from "next/server";
import { POST } from "@/app/api/tasks/[taskId]/unlock/route";

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
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsPromise = Promise.resolve({ taskId: "task-1" });

function makeReq() {
  return new NextRequest("http://localhost/api/tasks/task-1/unlock", {
    method: "POST",
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

const lockedTask = {
  id: "task-1",
  title: "Test Task",
  status: "locked",
  channelId: "ch-1",
  lockedById: "c1",
};

const activeTask = {
  id: "task-1",
  title: "Test Task",
  status: "active",
  channelId: "ch-1",
  lockedById: null,
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/tasks/[taskId]/unlock", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(403);
  });

  it("returns 404 when task not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([]); // task not found

    const res = await POST(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 400 when task is not locked", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([activeTask]);

    const res = await POST(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/not locked/i);
  });

  it("returns 200 and unlocks the task successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "admin" });
    mockSelect([lockedTask]); // task found
    mockUpdate(); // update task to active
    mockSelect([{ username: "admin1", displayName: "Admin One" }]); // mod name
    mockSelect([{ slug: "general" }]); // channel slug
    mockInsert([{ id: "msg-sys", type: "system", content: "unlocked", createdAt: new Date() }]); // system message

    const res = await POST(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
