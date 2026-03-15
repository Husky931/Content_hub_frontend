import { NextRequest } from "next/server";
import { POST } from "@/app/api/onboarding/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/onboarding", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelectReturning(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdateReturning(rows: any[]) {
  const returningMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

const updatedUser = {
  id: "u1",
  email: "test@test.com",
  username: "testuser",
  role: "creator",
  status: "verified",
  currency: "usd",
  displayName: "Test User",
  avatarUrl: null,
  bio: null,
  onboardingCompleted: true,
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/onboarding", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeReq({ currency: "usd" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when currency is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/currency/i);
  });

  it("returns 400 for invalid currency value", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await POST(makeReq({ currency: "eur" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if onboarding already completed", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelectReturning([{ currency: "usd", onboardingCompleted: true }]);

    const res = await POST(makeReq({ currency: "rmb" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/already completed/i);
  });

  it("successfully completes onboarding with usd", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelectReturning([{ currency: null, onboardingCompleted: false }]);
    mockUpdateReturning([updatedUser]);

    const res = await POST(makeReq({ currency: "usd", displayName: "Test User" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.currency).toBe("usd");
    expect(json.user.onboardingCompleted).toBe(true);
  });

  it("successfully completes onboarding with rmb", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelectReturning([{ currency: null, onboardingCompleted: false }]);
    mockUpdateReturning([{ ...updatedUser, currency: "rmb" }]);

    const res = await POST(makeReq({ currency: "rmb" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.currency).toBe("rmb");
  });
});
