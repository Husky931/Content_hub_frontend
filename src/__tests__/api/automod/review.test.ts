import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn(), update: jest.fn() },
}));
jest.mock("@/lib/ws-publish", () => ({
  publishSystemMessage: jest.fn().mockResolvedValue(undefined),
  publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
  publishNotification: jest.fn().mockResolvedValue(undefined),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: object, apiKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  return new NextRequest("http://localhost/api/automod/review", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

const ORIG_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIG_ENV, BACKEND_API_KEY: "automod-key" };
});

afterAll(() => {
  process.env = ORIG_ENV;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/automod/review", () => {
  let POST: any;
  beforeEach(async () => {
    jest.resetModules();
    jest.mock("@/db", () => ({
      db: { select: jest.fn(), insert: jest.fn(), update: jest.fn() },
    }));
    jest.mock("@/lib/ws-publish", () => ({
      publishSystemMessage: jest.fn().mockResolvedValue(undefined),
      publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
      publishNotification: jest.fn().mockResolvedValue(undefined),
    }));
    const mod = await import("@/app/api/automod/review/route");
    POST = mod.POST;
  });

  it("returns 503 when BACKEND_API_KEY is not configured", async () => {
    delete process.env.BACKEND_API_KEY;
    jest.resetModules();
    jest.mock("@/db", () => ({
      db: { select: jest.fn(), insert: jest.fn(), update: jest.fn() },
    }));
    jest.mock("@/lib/ws-publish", () => ({
      publishSystemMessage: jest.fn().mockResolvedValue(undefined),
      publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
      publishNotification: jest.fn().mockResolvedValue(undefined),
    }));
    const { POST: P } = await import("@/app/api/automod/review/route");
    const res = await P(makeReq({ taskId: "t", attemptId: "a", status: "approved" }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when API key is wrong", async () => {
    const res = await POST(makeReq(
      { taskId: "t", attemptId: "a", status: "approved" },
      "wrong-key"
    ));
    expect(res.status).toBe(401);
  });

  it("returns 401 when API key is missing", async () => {
    const res = await POST(makeReq(
      { taskId: "t", attemptId: "a", status: "approved" }
    ));
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeReq(
      { taskId: "t" }, // missing attemptId and status
      "automod-key"
    ));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 for invalid status value", async () => {
    const res = await POST(makeReq(
      { taskId: "t", attemptId: "a", status: "pending" },
      "automod-key"
    ));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/approved.*rejected/i);
  });

  it("returns 404 when attempt not found", async () => {
    const { db: mockDb } = require("@/db");
    // Attempt lookup returns empty
    const limitMock = jest.fn().mockResolvedValue([]);
    const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: fromMock });

    const res = await POST(makeReq(
      { taskId: "t1", attemptId: "a1", status: "rejected" },
      "automod-key"
    ));
    expect(res.status).toBe(404);
  });

  it("returns 404 when task not found", async () => {
    const { db: mockDb } = require("@/db");
    // Attempt found
    const attemptLimit = jest.fn().mockResolvedValue([{ id: "a1", taskId: "t1", userId: "u1" }]);
    const attemptWhere = jest.fn().mockReturnValue({ limit: attemptLimit });
    const attemptFrom = jest.fn().mockReturnValue({ where: attemptWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: attemptFrom });

    // Task not found
    const taskLimit = jest.fn().mockResolvedValue([]);
    const taskWhere = jest.fn().mockReturnValue({ limit: taskLimit });
    const taskFrom = jest.fn().mockReturnValue({ where: taskWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: taskFrom });

    const res = await POST(makeReq(
      { taskId: "t1", attemptId: "a1", status: "approved" },
      "automod-key"
    ));
    expect(res.status).toBe(404);
  });

  it("successfully processes rejection with reason and confidence", async () => {
    const { db: mockDb } = require("@/db");
    // Attempt found
    const attemptLimit = jest.fn().mockResolvedValue([{ id: "a1", taskId: "t1", userId: "u1" }]);
    const attemptWhere = jest.fn().mockReturnValue({ limit: attemptLimit });
    const attemptFrom = jest.fn().mockReturnValue({ where: attemptWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: attemptFrom });

    // Task found
    const taskLimit = jest.fn().mockResolvedValue([{ id: "t1", channelId: "ch1", createdById: "admin1", title: "Test Task", status: "active" }]);
    const taskWhere = jest.fn().mockReturnValue({ limit: taskLimit });
    const taskFrom = jest.fn().mockReturnValue({ where: taskWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: taskFrom });

    // Channel slug
    const chLimit = jest.fn().mockResolvedValue([{ slug: "audio-tasks" }]);
    const chWhere = jest.fn().mockReturnValue({ limit: chLimit });
    const chFrom = jest.fn().mockReturnValue({ where: chWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: chFrom });

    // Submitter info
    const userLimit = jest.fn().mockResolvedValue([{ username: "alice", displayName: "Alice" }]);
    const userWhere = jest.fn().mockReturnValue({ limit: userLimit });
    const userFrom = jest.fn().mockReturnValue({ where: userWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: userFrom });

    // Mock update (reject attempt)
    const setMock = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) });
    (mockDb.update as jest.Mock).mockReturnValueOnce({ set: setMock });

    // Mock insert (system message)
    const returningMock = jest.fn().mockResolvedValue([{ id: "msg1", createdAt: new Date() }]);
    const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
    (mockDb.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });

    // Mock insert (notification)
    const notifValuesMock = jest.fn().mockResolvedValue([]);
    (mockDb.insert as jest.Mock).mockReturnValueOnce({ values: notifValuesMock });

    const res = await POST(makeReq(
      { taskId: "t1", attemptId: "a1", status: "rejected", reason: "Poor audio quality", confidence: 0.92 },
      "automod-key"
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("rejected");
  });

  it("successfully processes approval (pending human review)", async () => {
    const { db: mockDb } = require("@/db");
    // Attempt found
    const attemptLimit = jest.fn().mockResolvedValue([{ id: "a1", taskId: "t1", userId: "u1" }]);
    const attemptWhere = jest.fn().mockReturnValue({ limit: attemptLimit });
    const attemptFrom = jest.fn().mockReturnValue({ where: attemptWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: attemptFrom });

    // Task found
    const taskLimit = jest.fn().mockResolvedValue([{ id: "t1", channelId: "ch1", createdById: "admin1", title: "Test", status: "active" }]);
    const taskWhere = jest.fn().mockReturnValue({ limit: taskLimit });
    const taskFrom = jest.fn().mockReturnValue({ where: taskWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: taskFrom });

    // Channel
    const chLimit = jest.fn().mockResolvedValue([{ slug: "writing-tasks" }]);
    const chWhere = jest.fn().mockReturnValue({ limit: chLimit });
    const chFrom = jest.fn().mockReturnValue({ where: chWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: chFrom });

    // Submitter
    const userLimit = jest.fn().mockResolvedValue([{ username: "bob", displayName: "Bob" }]);
    const userWhere = jest.fn().mockReturnValue({ limit: userLimit });
    const userFrom = jest.fn().mockReturnValue({ where: userWhere });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: userFrom });

    // System message insert
    const returningMock = jest.fn().mockResolvedValue([{ id: "msg2", createdAt: new Date() }]);
    const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
    (mockDb.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });

    const res = await POST(makeReq(
      { taskId: "t1", attemptId: "a1", status: "approved", confidence: 0.85 },
      "automod-key"
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("approved");

    // Verify db.update was NOT called (approval doesn't change attempt status)
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
