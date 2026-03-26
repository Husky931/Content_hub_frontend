import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("@/lib/ws-publish", () => ({
  publishNotification: jest.fn(),
}));

import { POST } from "@/app/api/training/reviews/[id]/route";
import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/training/reviews/sub-1", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const paramsPromise = Promise.resolve({ id: "sub-1" });

function mockSelect(rows: unknown[]) {
  const whereMock = jest.fn().mockResolvedValue(rows);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdate() {
  const whereMock = jest.fn().mockResolvedValue([]);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

function mockInsert() {
  const valuesMock = jest.fn().mockResolvedValue([]);
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/training/reviews/[id]", () => {
  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });

    const res = await POST(makeReq({ action: "approve" }), { params: paramsPromise });
    expect(res.status).toBe(403);
  });

  it("returns 403 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);

    const res = await POST(makeReq({ action: "approve" }), { params: paramsPromise });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid action", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });

    const res = await POST(makeReq({ action: "invalidAction" }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/action/i);
  });

  it("returns 404 when submission not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });

    // 1. select submission -> empty
    mockSelect([]);

    const res = await POST(makeReq({ action: "approve" }), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 400 when submission already reviewed", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });

    // 1. select submission -> already approved
    mockSelect([{ id: "sub-1", status: "approved", userProgressId: "prog-1" }]);

    const res = await POST(makeReq({ action: "approve" }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already/i);
  });

  it("returns 200 for approve with remaining pending > 0 (no finalization)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "admin" });

    // 1. select submission -> pending
    mockSelect([{ id: "sub-1", status: "pending", userProgressId: "prog-1", reviewerId: null }]);

    // 2. update submission status
    mockUpdate();

    // 3. select remainingPending count > 0
    mockSelect([{ count: 2 }]);

    const res = await POST(makeReq({ action: "approve" }), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.testStatus).toBe("pending_review");
    expect(json.tagAwarded).toBe(false);
  });

  it("returns 200 for reject with remaining pending > 0 (no finalization)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "supermod" });

    // 1. select submission -> pending
    mockSelect([{ id: "sub-1", status: "pending", userProgressId: "prog-1", reviewerId: null }]);

    // 2. update submission status
    mockUpdate();

    // 3. select remainingPending count > 0
    mockSelect([{ count: 1 }]);

    const res = await POST(makeReq({ action: "reject", reason: "blurry image" }), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.testStatus).toBe("pending_review");
    expect(json.tagAwarded).toBe(false);
  });
});
