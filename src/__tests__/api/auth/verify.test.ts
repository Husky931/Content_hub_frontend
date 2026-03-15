import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/verify/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn(), update: jest.fn() },
}));

import { db } from "@/db";
import { cookies } from "next/headers";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(token?: string) {
  const url = token
    ? `http://localhost/api/auth/verify?token=${token}`
    : "http://localhost/api/auth/verify";
  return new NextRequest(url);
}

const validTokenRecord = {
  id: "vt-1",
  userId: "user-1",
  token: "valid-token-abc",
  expiresAt: new Date(Date.now() + 60_000), // expires in 1 minute
  usedAt: null,
};

function mockSelect(rows: object[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdate(returning: object[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returning);
  const whereMock = jest.fn().mockReturnValue(
    returning.length > 0 ? { returning: returningMock } : Promise.resolve([])
  );
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

function mockInsert() {
  const valuesMock = jest.fn().mockResolvedValue([]);
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

const mockCookieStore = { set: jest.fn(), get: jest.fn(), delete: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (cookies as jest.Mock).mockResolvedValue(mockCookieStore);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/auth/verify", () => {
  it("returns 400 when token query param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("required") });
  });

  it("returns 400 when the token is not found / already used", async () => {
    mockSelect([]); // no matching token record
    const res = await GET(makeRequest("nonexistent-token"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("Invalid") });
  });

  it("returns 400 when the token has expired", async () => {
    mockSelect([{ ...validTokenRecord, expiresAt: new Date(Date.now() - 1000) }]);
    const res = await GET(makeRequest("valid-token-abc"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("expired") });
  });

  it("redirects to /onboarding on successful verification", async () => {
    mockSelect([validTokenRecord]); // token lookup

    // update verificationTokens (mark used) — no returning
    const whereAfterSet1 = jest.fn().mockResolvedValue([]);
    const setMock1 = jest.fn().mockReturnValue({ where: whereAfterSet1 });
    (db.update as jest.Mock).mockReturnValueOnce({ set: setMock1 });

    // update users (set verified) — with returning
    const returningMock = jest.fn().mockResolvedValue([{ id: "user-1", role: "creator" }]);
    const whereAfterSet2 = jest.fn().mockReturnValue({ returning: returningMock });
    const setMock2 = jest.fn().mockReturnValue({ where: whereAfterSet2 });
    (db.update as jest.Mock).mockReturnValueOnce({ set: setMock2 });

    mockInsert(); // sessions insert

    const res = await GET(makeRequest("valid-token-abc"));
    expect(res.status).toBe(307); // NextResponse.redirect returns 307 by default
    expect(res.headers.get("location")).toMatch(/\/onboarding/);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "auth_token",
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });
});
