import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/admin/users/tags/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { insert: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/admin/users/tags", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteReq(body: object) {
  return new NextRequest("http://localhost/api/admin/users/tags", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockInsert() {
  const onConflictMock = jest.fn().mockResolvedValue([]);
  const valuesMock = jest.fn().mockReturnValue({ onConflictDoNothing: onConflictMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

function mockDelete() {
  const whereMock = jest.fn().mockResolvedValue([]);
  (db.delete as jest.Mock).mockReturnValueOnce({ where: whereMock });
}

beforeEach(() => jest.clearAllMocks());

// ── POST (Assign Tag) Tests ────────────────────────────────────────────────

describe("POST /api/admin/users/tags", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await POST(makePostReq({ userId: "u1", tagId: "t1" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 for creator", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makePostReq({ userId: "u1", tagId: "t1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when userId is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makePostReq({ tagId: "t1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tagId is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makePostReq({ userId: "u1" }));
    expect(res.status).toBe(400);
  });

  it("assigns tag successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockInsert();

    const res = await POST(makePostReq({ userId: "u1", tagId: "t1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

// ── DELETE (Remove Tag) Tests ──────────────────────────────────────────────

describe("DELETE /api/admin/users/tags", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await DELETE(makeDeleteReq({ userId: "u1", tagId: "t1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when userId is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await DELETE(makeDeleteReq({ tagId: "t1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tagId is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await DELETE(makeDeleteReq({ userId: "u1" }));
    expect(res.status).toBe(400);
  });

  it("removes tag successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockDelete();

    const res = await DELETE(makeDeleteReq({ userId: "u1", tagId: "t1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
