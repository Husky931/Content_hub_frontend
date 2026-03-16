import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/ws-publish", () => ({
  publishSystemMessage: jest.fn().mockResolvedValue(undefined),
  publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
}));

import { db } from "@/db";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: object, apiKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  return new NextRequest("http://localhost/api/tasks/sync", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

function makeGetReq(apiKey?: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  return new NextRequest("http://localhost/api/tasks/sync", {
    method: "GET",
    headers,
  });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
  const orderByMock = jest.fn().mockResolvedValue(rows);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock, limit: limitMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

const ORIG_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIG_ENV, BACKEND_API_KEY: "test-backend-key" };
});

afterAll(() => {
  process.env = ORIG_ENV;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/tasks/sync", () => {
  // Need to re-import after setting env
  let POST: any, GET: any;
  beforeEach(async () => {
    jest.resetModules();
    // Re-mock after resetModules
    jest.mock("@/db", () => ({ db: { select: jest.fn(), insert: jest.fn() } }));
    jest.mock("@/lib/ws-publish", () => ({
      publishSystemMessage: jest.fn().mockResolvedValue(undefined),
      publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
    }));
    const mod = await import("@/app/api/tasks/sync/route");
    POST = mod.POST;
    GET = mod.GET;
  });

  it("returns 503 when BACKEND_API_KEY is not configured", async () => {
    delete process.env.BACKEND_API_KEY;
    jest.resetModules();
    jest.mock("@/db", () => ({ db: { select: jest.fn(), insert: jest.fn() } }));
    jest.mock("@/lib/ws-publish", () => ({
      publishSystemMessage: jest.fn().mockResolvedValue(undefined),
      publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
    }));
    const { POST: P } = await import("@/app/api/tasks/sync/route");

    const res = await P(makeReq({ channelSlug: "test", title: "T", description: "D" }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when API key is wrong", async () => {
    const res = await POST(makeReq(
      { channelSlug: "test", title: "T", description: "D" },
      "wrong-key"
    ));
    expect(res.status).toBe(401);
  });

  it("returns 401 when API key is missing", async () => {
    const res = await POST(makeReq(
      { channelSlug: "test", title: "T", description: "D" }
      // no apiKey
    ));
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeReq(
      { channelSlug: "test" }, // missing title and description
      "test-backend-key"
    ));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 404 when channel not found", async () => {
    const { db: mockDb } = require("@/db");
    // Channel lookup returns empty
    const limitMock = jest.fn().mockResolvedValue([]);
    const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: fromMock });

    const res = await POST(makeReq(
      { channelSlug: "nonexistent", title: "T", description: "D" },
      "test-backend-key"
    ));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 400 when target channel is not a task channel", async () => {
    const { db: mockDb } = require("@/db");
    const limitMock = jest.fn().mockResolvedValue([{ id: "ch1", type: "discussion", requiredTagId: null }]);
    const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: fromMock });

    const res = await POST(makeReq(
      { channelSlug: "general", title: "T", description: "D" },
      "test-backend-key"
    ));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/task channel/i);
  });
});

describe("GET /api/tasks/sync", () => {
  let GET: any;
  beforeEach(async () => {
    jest.resetModules();
    jest.mock("@/db", () => ({ db: { select: jest.fn(), insert: jest.fn() } }));
    jest.mock("@/lib/ws-publish", () => ({
      publishSystemMessage: jest.fn().mockResolvedValue(undefined),
      publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
    }));
    const mod = await import("@/app/api/tasks/sync/route");
    GET = mod.GET;
  });

  it("returns 401 with wrong API key", async () => {
    const res = await GET(makeGetReq("wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when BACKEND_API_KEY not set", async () => {
    delete process.env.BACKEND_API_KEY;
    jest.resetModules();
    jest.mock("@/db", () => ({ db: { select: jest.fn(), insert: jest.fn() } }));
    jest.mock("@/lib/ws-publish", () => ({
      publishSystemMessage: jest.fn().mockResolvedValue(undefined),
      publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
    }));
    const { GET: G } = await import("@/app/api/tasks/sync/route");

    const res = await G(makeGetReq("any-key"));
    expect(res.status).toBe(503);
  });

  it("returns channel list with valid API key", async () => {
    const { db: mockDb } = require("@/db");
    const channelData = [
      { slug: "audio-tasks", name: "Audio Tasks", nameCn: "音频任务" },
      { slug: "writing-tasks", name: "Writing Tasks", nameCn: "写作任务" },
    ];
    const orderByMock = jest.fn().mockResolvedValue(channelData);
    const whereMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    (mockDb.select as jest.Mock).mockReturnValueOnce({ from: fromMock });

    const res = await GET(makeGetReq("test-backend-key"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.channels).toHaveLength(2);
    expect(json.channels[0].slug).toBe("audio-tasks");
  });
});
