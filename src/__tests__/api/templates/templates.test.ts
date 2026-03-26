import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { GET, POST } from "@/app/api/templates/route";
import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/templates", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelect(rows: any[]) {
  const orderByMock = jest.fn().mockResolvedValue(rows);
  const innerJoinMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
  const limitMock = jest.fn().mockResolvedValue(rows);
  const thenableWithLimit = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const whereMock = jest.fn().mockReturnValue(thenableWithLimit);
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    limit: limitMock,
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

beforeEach(() => jest.clearAllMocks());

// ── GET /api/templates ────────────────────────────────────────────────────

describe("GET /api/templates", () => {
  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with templates for mod role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "mod-1", role: "mod" });

    const templates = [
      { id: "tpl-1", name: "Audio Recording", category: "audio", createdByUsername: "admin1", createdAt: new Date() },
    ];
    mockSelect(templates);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.templates).toHaveLength(1);
    expect(json.templates[0].name).toBe("Audio Recording");
  });
});

// ── POST /api/templates ───────────────────────────────────────────────────

describe("POST /api/templates", () => {
  it("returns 403 for mod role (only admin/supermod can create)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "mod-1", role: "mod" });
    const res = await POST(makePostReq({ name: "Test", category: "audio" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makePostReq({ category: "audio" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/name/i);
  });

  it("returns 400 when category is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makePostReq({ name: "Test" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/category/i);
  });

  it("returns 201 on success", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });

    const created = { id: "tpl-new", name: "Test Template", category: "audio", createdById: "a1" };
    mockInsert([created]);

    const res = await POST(makePostReq({ name: "Test Template", category: "audio" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.template).toBeDefined();
    expect(json.template.id).toBe("tpl-new");
  });
});
