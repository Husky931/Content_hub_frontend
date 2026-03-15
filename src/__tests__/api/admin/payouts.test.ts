import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/payouts/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn(), update: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/admin/payouts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const orderByMock = jest.fn().mockReturnValue(orderByResult);
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock, orderBy: orderByMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const innerJoinMock = jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  const fromResult = Object.assign(Promise.resolve(rows), {
    where: whereMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock,
    limit: limitMock,
  });
  const fromMock = jest.fn().mockReturnValue(fromResult);
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

function mockUpdate() {
  const whereMock = jest.fn().mockResolvedValue([]);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

beforeEach(() => jest.clearAllMocks());

// ── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/admin/payouts", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 for supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "sm1", role: "supermod" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns empty payouts when no users owe money", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // no users

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.payouts).toHaveLength(0);
  });
});

// ── POST Tests ─────────────────────────────────────────────────────────────

describe("POST /api/admin/payouts", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await POST(makePostReq({ userIds: ["u1"] }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when userIds is empty", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makePostReq({ userIds: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when userIds is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makePostReq({}));
    expect(res.status).toBe(400);
  });

  it("executes payout for user with positive balance", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // Ledger entries for user
    mockSelect([
      { type: "task_earning", amountUsd: "25.00", amountRmb: "175.00", taskId: "t1", attemptId: "a1" },
    ]);
    // Insert payout ledger entry
    mockInsert([{ id: "payout-1" }]);
    // Update tasks to paid
    mockUpdate();
    // Update attempts to paid
    mockUpdate();
    // Insert notification
    mockInsert([]);

    const res = await POST(makePostReq({ userIds: ["u1"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(1);
    expect(json.results[0].paidUsd).toBe("25.00");
    expect(json.results[0].paidRmb).toBe("175.00");
  });

  it("skips users with zero balance", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // Ledger entries - already paid out
    mockSelect([
      { type: "task_earning", amountUsd: "10.00", amountRmb: "70.00", taskId: "t1", attemptId: "a1" },
      { type: "payout", amountUsd: "-10.00", amountRmb: "-70.00", taskId: null, attemptId: null },
    ]);

    const res = await POST(makePostReq({ userIds: ["u1"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(0); // No payout needed
  });
});
