import { NextRequest } from "next/server";
import { POST } from "@/app/api/tasks/[taskId]/attempts/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("@/lib/ws-publish", () => ({
  publishSystemMessage: jest.fn().mockResolvedValue(undefined),
  publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
  publishNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/backend-webhook", () => ({
  webhookAttemptSubmitted: jest.fn().mockResolvedValue(undefined),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/tasks/task-1/attempts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const paramsPromise = Promise.resolve({ taskId: "task-1" });

/**
 * Mock db.select() chains. The key challenge: some Drizzle queries end with
 * .where() (no .limit()), so .where() must be thenable AND have .limit().
 */
function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const thenableWithLimit = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const whereMock = jest.fn().mockReturnValue(thenableWithLimit);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, limit: limitMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

const activeTask = {
  id: "task-1",
  channelId: "ch-1",
  createdById: "mod-1",
  title: "Record Greeting",
  status: "active",
  maxAttempts: 5,
  deadline: null,
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/tasks/[taskId]/attempts", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeReq({ deliverables: { text: "test" } }), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 400 when deliverables are empty", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makeReq({ deliverables: {} }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/deliverables/i);
  });

  it("returns 404 when task not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    mockSelect([]); // task lookup

    const res = await POST(makeReq({ deliverables: { text: "test" } }), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 400 when task is not active", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    mockSelect([{ ...activeTask, status: "draft" }]);

    const res = await POST(makeReq({ deliverables: { text: "test" } }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/not accepting/i);
  });

  it("returns 400 when deadline has passed", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    mockSelect([{ ...activeTask, deadline: new Date("2020-01-01") }]);

    const res = await POST(makeReq({ deliverables: { text: "test" } }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/deadline/i);
  });

  it("returns 400 when max attempts reached", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    mockSelect([{ ...activeTask, maxAttempts: 2 }]); // task
    mockSelect([{ count: 2 }]); // attempt count = max

    const res = await POST(makeReq({ deliverables: { text: "test" } }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/maximum attempts/i);
  });

  it("returns 403 when user is blocked", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    mockSelect([activeTask]); // task
    mockSelect([{ count: 0 }]); // attempt count
    mockSelect([{ id: "blocked-attempt" }]); // blocked attempt found

    const res = await POST(makeReq({ deliverables: { text: "test" } }), { params: paramsPromise });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/blocked/i);
  });

  it("successfully submits an attempt", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    mockSelect([activeTask]); // task
    mockSelect([{ count: 0 }]); // attempt count
    mockSelect([]); // no blocked attempt
    const newAttempt = { id: "attempt-new", taskId: "task-1", userId: "c1", status: "submitted" };
    mockInsert([newAttempt]); // insert attempt
    // Get submitter info
    mockSelect([{ username: "creator1", displayName: "Creator One" }]);
    // Insert system message
    mockInsert([{ id: "msg-1", createdAt: new Date() }]);
    // Get channel slug
    mockSelect([{ slug: "voiceover-basic" }]);
    // Insert notification (task creator)
    mockInsert([]);
    // Channel mods query
    mockSelect([]);

    const res = await POST(makeReq({ deliverables: { text: "My submission" } }), { params: paramsPromise });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.attempt.status).toBe("submitted");
  });
});
