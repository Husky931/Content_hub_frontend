import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { update: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { PATCH, DELETE } from "@/app/api/templates/[id]/route";
import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makePatchReq(body: object) {
  return new NextRequest("http://localhost/api/templates/tpl-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteReq() {
  return new NextRequest("http://localhost/api/templates/tpl-1", {
    method: "DELETE",
  });
}

const paramsPromise = Promise.resolve({ id: "tpl-1" });

function mockUpdate(returned: any[]) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

function mockDelete(returned: any[]) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.delete as jest.Mock).mockReturnValueOnce({ where: whereMock });
}

beforeEach(() => jest.clearAllMocks());

// ── PATCH /api/templates/[id] ─────────────────────────────────────────────

describe("PATCH /api/templates/[id]", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "mod" });
    const res = await PATCH(makePatchReq({ name: "Updated" }), { params: paramsPromise });
    expect(res.status).toBe(403);
  });

  it("returns 404 when template not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockUpdate([]); // returning empty = not found
    const res = await PATCH(makePatchReq({ name: "Updated" }), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "supermod" });
    const updated = { id: "tpl-1", name: "Updated Template", category: "video" };
    mockUpdate([updated]);
    const res = await PATCH(makePatchReq({ name: "Updated Template" }), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.template.name).toBe("Updated Template");
  });
});

// ── DELETE /api/templates/[id] ────────────────────────────────────────────

describe("DELETE /api/templates/[id]", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(403);
  });

  it("returns 404 when template not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockDelete([]);
    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockDelete([{ id: "tpl-1", name: "Deleted" }]);
    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
