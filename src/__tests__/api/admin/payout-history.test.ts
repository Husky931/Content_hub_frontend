import { GET } from "@/app/api/admin/payouts/history/route";

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

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const orderByMock = jest.fn().mockReturnValue(orderByResult);
  const whereResult = Object.assign(Promise.resolve(rows), { orderBy: orderByMock, limit: limitMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const innerJoinMock = jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock,
    limit: limitMock,
  });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

const samplePayout = {
  id: "payout-1",
  userId: "u1",
  amountUsd: "-25.00",
  amountRmb: "-175.00",
  description: "Monthly payout - 2024-01",
  createdAt: new Date(),
  username: "creator1",
  displayName: "Creator One",
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/admin/payouts/history", () => {
  it("returns 403 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 for mod role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns payout history for admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([samplePayout]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.history).toHaveLength(1);
    expect(json.history[0].username).toBe("creator1");
    expect(json.history[0].amountUsd).toBe("-25.00");
  });

  it("returns payout history for supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "sm1", role: "supermod" });
    mockSelect([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.history).toHaveLength(0);
  });
});
