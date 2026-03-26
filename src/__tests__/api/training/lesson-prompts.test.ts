import { NextRequest } from "next/server";
import { POST, PUT } from "@/app/api/training/lessons/[id]/prompts/route";

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

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/training/lessons/lesson-1/prompts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePutReq(body: object) {
  return new NextRequest("http://localhost/api/training/lessons/lesson-1/prompts", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByMock = jest.fn().mockResolvedValue(rows);
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock, orderBy: orderByMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const fromResult = Object.assign(Promise.resolve(rows), {
    where: whereMock,
    orderBy: orderByMock,
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
  const whereMock = jest.fn().mockResolvedValue(undefined);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

beforeEach(() => jest.clearAllMocks());

// ── POST Tests (create prompt) ─────────────────────────────────────────────

describe("POST /api/training/lessons/[id]/prompts", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makeReq({ content: "Hello" }), paramsFor("lesson-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // lesson not found
    const res = await POST(makeReq({ content: "Hello" }), paramsFor("lesson-1"));
    expect(res.status).toBe(404);
  });

  it("returns 201 and creates prompt with auto-order", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // 1. lesson exists
    mockSelect([{ id: "lesson-1" }]);
    // 2. maxOrder
    mockSelect([{ max: 2 }]);
    // 3. insert prompt
    const newPrompt = { id: "p-new", lessonId: "lesson-1", order: 3, content: "Hello" };
    mockInsert([newPrompt]);

    const res = await POST(makeReq({ content: "Hello" }), paramsFor("lesson-1"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("p-new");
  });
});

// ── PUT Tests (reorder prompts) ────────────────────────────────────────────

describe("PUT /api/training/lessons/[id]/prompts (reorder)", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await PUT(makePutReq({ ids: ["p1", "p2"] }), paramsFor("lesson-1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 and reorders prompts", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // one update per prompt id
    mockUpdate();
    mockUpdate();
    // final select to return updated list
    mockSelect([
      { id: "p2", order: 0 },
      { id: "p1", order: 1 },
    ]);

    const res = await PUT(makePutReq({ ids: ["p2", "p1"] }), paramsFor("lesson-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
  });
});
