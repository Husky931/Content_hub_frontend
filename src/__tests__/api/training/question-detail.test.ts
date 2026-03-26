import { NextRequest } from "next/server";
import { PUT, DELETE } from "@/app/api/training/questions/[id]/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { update: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

function makeReq(method: string, body?: object) {
  return new NextRequest("http://localhost/api/training/questions/q1", {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

function mockUpdate(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

function mockDelete() {
  const whereMock = jest.fn().mockResolvedValue(undefined);
  (db.delete as jest.Mock).mockReturnValueOnce({ where: whereMock });
}

beforeEach(() => jest.clearAllMocks());

// ── PUT Tests ──────────────────────────────────────────────────────────────

describe("PUT /api/training/questions/[id]", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await PUT(makeReq("PUT", { prompt: "Updated?" }), paramsFor("q1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when question not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockUpdate([]); // returning empty
    const res = await PUT(makeReq("PUT", { prompt: "Updated?" }), paramsFor("q1"));
    expect(res.status).toBe(404);
  });

  it("returns 200 and updates question", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const updated = { id: "q1", type: "mcq", prompt: "Updated?", sortOrder: 0 };
    mockUpdate([updated]);
    const res = await PUT(makeReq("PUT", { prompt: "Updated?" }), paramsFor("q1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.prompt).toBe("Updated?");
  });
});

// ── DELETE Tests ────────────────────────────────────────────────────────────

describe("DELETE /api/training/questions/[id]", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await DELETE(makeReq("DELETE"), paramsFor("q1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 and deletes question", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockDelete();
    const res = await DELETE(makeReq("DELETE"), paramsFor("q1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(true);
  });
});
