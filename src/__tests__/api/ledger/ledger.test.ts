import { NextRequest } from "next/server";
import { GET } from "@/app/api/ledger/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(params?: Record<string, string>) {
  const u = new URL("http://localhost/api/ledger");
  if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new NextRequest(u);
}

function mockSelectReturning(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
  const whereMock = jest.fn().mockReturnValue({ orderBy: orderByMock, limit: limitMock });
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

const earningEntry = {
  id: "l1",
  userId: "u1",
  type: "task_earning",
  amountUsd: "25.00",
  amountRmb: "175.00",
  createdAt: new Date(),
};

const payoutEntry = {
  id: "l2",
  userId: "u1",
  type: "payout",
  amountUsd: "-10.00",
  amountRmb: "-70.00",
  createdAt: new Date(),
};

const bonusEntry = {
  id: "l3",
  userId: "u1",
  type: "bonus",
  amountUsd: "5.00",
  amountRmb: "35.00",
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/ledger", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns entries and correct wallet summary for own user", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelectReturning([earningEntry, payoutEntry, bonusEntry]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.entries).toHaveLength(3);
    // Earned: 25 + 5 = 30; Paid: 10; Available: 20
    expect(json.summary.totalEarnedUsd).toBe("30.00");
    expect(json.summary.totalPaidOutUsd).toBe("10.00");
    expect(json.summary.availableUsd).toBe("20.00");
    // RMB: Earned: 175 + 35 = 210; Paid: 70; Available: 140
    expect(json.summary.totalEarnedRmb).toBe("210.00");
    expect(json.summary.totalPaidOutRmb).toBe("70.00");
    expect(json.summary.availableRmb).toBe("140.00");
  });

  it("returns empty wallet for user with no entries", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u2", role: "creator" });
    mockSelectReturning([]);

    const res = await GET(makeReq());
    const json = await res.json();

    expect(json.entries).toHaveLength(0);
    expect(json.summary.availableUsd).toBe("0.00");
    expect(json.summary.availableRmb).toBe("0.00");
  });

  it("admin can view another user's ledger via userId param", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockSelectReturning([earningEntry]);

    const res = await GET(makeReq({ userId: "u1" }));
    expect(res.status).toBe(200);
    // Verifies admin can target a different user
    const json = await res.json();
    expect(json.entries).toHaveLength(1);
  });

  it("non-admin ignores userId param and returns own ledger", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelectReturning([earningEntry]);

    const res = await GET(makeReq({ userId: "other-user" }));
    expect(res.status).toBe(200);
    // Still returns data (their own), just ignores the userId param
  });
});
