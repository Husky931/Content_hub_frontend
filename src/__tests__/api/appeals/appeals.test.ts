import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("@/lib/ws-publish", () => ({
  publishMessage: jest.fn().mockResolvedValue(undefined),
  publishNotification: jest.fn().mockResolvedValue(undefined),
}));

import { POST, GET } from "@/app/api/appeals/route";
import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/appeals", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetReq(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/appeals");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByMock = jest.fn().mockReturnValue(Object.assign(Promise.resolve(rows), { limit: limitMock }));
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock, orderBy: orderByMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    limit: limitMock,
    orderBy: orderByMock,
    innerJoin: jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock }),
  });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

beforeEach(() => jest.clearAllMocks());

// ── POST /api/appeals ─────────────────────────────────────────────────────

describe("POST /api/appeals", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makePostReq({ attemptId: "a1", reason: "x".repeat(30) }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when attemptId is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await POST(makePostReq({ reason: "x".repeat(30) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/attempt/i);
  });

  it("returns 400 when reason is too short (< 20 chars)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await POST(makePostReq({ attemptId: "a1", reason: "short" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/20/);
  });

  it("returns 404 when attempt not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([]); // attempt lookup returns empty
    const res = await POST(makePostReq({ attemptId: "a1", reason: "x".repeat(30) }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when attempt belongs to another user", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([{ id: "a1", userId: "u-other", status: "rejected", taskId: "t1" }]);
    const res = await POST(makePostReq({ attemptId: "a1", reason: "x".repeat(30) }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when attempt is not rejected", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([{ id: "a1", userId: "u1", status: "submitted", taskId: "t1" }]);
    const res = await POST(makePostReq({ attemptId: "a1", reason: "x".repeat(30) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/rejected/i);
  });

  it("returns 400 when appeal already exists", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([{ id: "a1", userId: "u1", status: "rejected", taskId: "t1" }]); // attempt
    mockSelect([{ id: "existing-appeal" }]); // existing appeal
    const res = await POST(makePostReq({ attemptId: "a1", reason: "x".repeat(30) }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already exists/i);
  });

  it("returns 200 and creates appeal on success", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const reason = "This rejection is unfair because the work meets all requirements perfectly.";

    // attempt lookup
    mockSelect([{ id: "a1", userId: "u1", status: "rejected", taskId: "t1" }]);
    // existing appeal check — none
    mockSelect([]);
    // insert appeal
    mockInsert([{ id: "appeal-1", attemptId: "a1", userId: "u1", reason }]);
    // task lookup
    mockSelect([{ title: "Record Greeting", channelId: "ch-1" }]);
    // appeals channel lookup
    mockSelect([{ id: "ch-appeals" }]);
    // user display info
    mockSelect([{ id: "u1", username: "creator1", displayName: "Creator One" }]);
    // insert system message
    mockInsert([{ id: "msg-1", content: "sys", type: "system", createdAt: new Date() }]);
    // mod users
    mockSelect([{ id: "mod-1" }]);
    // supermod users
    mockSelect([]);
    // admin users
    mockSelect([]);
    // insert notification for mod-1
    mockInsert([{ id: "notif-1", title: "New appeal filed" }]);

    const res = await POST(makePostReq({ attemptId: "a1", reason }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.appeal).toBeDefined();
    expect(json.appeal.id).toBe("appeal-1");
  });
});

// ── GET /api/appeals ──────────────────────────────────────────────────────

describe("GET /api/appeals", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeGetReq());
    expect(res.status).toBe(401);
  });

  it("returns 200 with all appeals for mod role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "mod-1", role: "mod" });

    // main appeals select
    mockSelect([
      {
        id: "appeal-1",
        attemptId: "a1",
        userId: "u1",
        reason: "Unfair rejection",
        status: "pending",
        arbitratorId: null,
        arbitratorNote: null,
        createdAt: new Date(),
        resolvedAt: null,
      },
    ]);
    // enrichment: attempt lookup
    mockSelect([{ id: "a1", status: "rejected", taskId: "t1", deliverables: {}, rejectionReason: "Bad", reviewerId: "mod-2" }]);
    // enrichment: task lookup
    mockSelect([{ id: "t1", title: "Record Greeting", channelId: "ch-1" }]);
    // enrichment: channel lookup
    mockSelect([{ slug: "general", name: "General" }]);
    // enrichment: appeal user
    mockSelect([{ id: "u1", username: "creator1", displayName: "Creator", avatarUrl: null, role: "creator" }]);
    // enrichment: reviewer
    mockSelect([{ id: "mod-2", username: "mod2", displayName: "Mod Two" }]);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.appeals).toHaveLength(1);
    expect(json.appeals[0].user).toBeDefined();
    expect(json.appeals[0].task).toBeDefined();
    expect(json.appeals[0].reviewer).toBeDefined();
  });

  it("returns 200 with only own appeals for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });

    // main appeals select (filtered by userId on server)
    mockSelect([
      {
        id: "appeal-1",
        attemptId: "a1",
        userId: "u1",
        reason: "Unfair rejection",
        status: "pending",
        arbitratorId: null,
        arbitratorNote: null,
        createdAt: new Date(),
        resolvedAt: null,
      },
    ]);
    // enrichment: attempt
    mockSelect([{ id: "a1", status: "rejected", taskId: "t1", deliverables: {}, rejectionReason: "Bad", reviewerId: null }]);
    // enrichment: task
    mockSelect([{ id: "t1", title: "Record Greeting", channelId: "ch-1" }]);
    // enrichment: channel
    mockSelect([{ slug: "general", name: "General" }]);
    // enrichment: user
    mockSelect([{ id: "u1", username: "creator1", displayName: "Creator", avatarUrl: null, role: "creator" }]);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.appeals).toHaveLength(1);
    expect(json.appeals[0].id).toBe("appeal-1");
  });
});
