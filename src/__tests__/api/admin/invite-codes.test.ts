import { NextRequest } from "next/server";
import { GET, POST, PATCH } from "@/app/api/admin/invite-codes/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn(), update: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
  generateInviteCode: jest.fn().mockReturnValue("INV-TEST-1234"),
}));

import { db } from "@/db";
import { getAuthFromCookies, generateInviteCode } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/admin/invite-codes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePatchReq(body: object) {
  return new NextRequest("http://localhost/api/admin/invite-codes", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelect(rows: any[]) {
  const orderByMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
  const innerJoinMock = jest.fn().mockReturnValue({ orderBy: orderByMock, where: whereMock });
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock,
  });
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

const sampleCode = {
  id: "inv-1",
  code: "INV-BETA-2024",
  status: "active",
  maxUses: 10,
  useCount: 3,
  expiresAt: null,
  createdAt: new Date(),
  createdByUsername: "admin",
};

beforeEach(() => jest.clearAllMocks());

// ── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/admin/invite-codes", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns invite codes for admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([sampleCode]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.codes).toHaveLength(1);
    expect(json.codes[0].code).toBe("INV-BETA-2024");
  });
});

// ── POST Tests ─────────────────────────────────────────────────────────────

describe("POST /api/admin/invite-codes", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makePostReq({ maxUses: 5 }));
    expect(res.status).toBe(403);
  });

  it("creates invite code successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const newCode = { id: "inv-new", code: "INV-TEST-1234", maxUses: 5, status: "active" };
    mockInsert([newCode]);

    const res = await POST(makePostReq({ maxUses: 5 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code.code).toBe("INV-TEST-1234");
    expect(generateInviteCode).toHaveBeenCalled();
  });

  it("creates invite code with expiry", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockInsert([{ id: "inv-exp", code: "INV-TEST-1234", maxUses: 1, expiresAt: new Date() }]);

    const res = await POST(makePostReq({ maxUses: 1, expiresInDays: 7 }));
    expect(res.status).toBe(200);
  });
});

// ── PATCH Tests ────────────────────────────────────────────────────────────

describe("PATCH /api/admin/invite-codes", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await PATCH(makePatchReq({ codeId: "inv-1", action: "revoke" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid request", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await PATCH(makePatchReq({ codeId: "inv-1", action: "activate" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when codeId is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await PATCH(makePatchReq({ action: "revoke" }));
    expect(res.status).toBe(400);
  });

  it("revokes invite code successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockUpdate();

    const res = await PATCH(makePatchReq({ codeId: "inv-1", action: "revoke" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
