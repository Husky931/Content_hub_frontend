import { NextRequest } from "next/server";
import { POST, PUT } from "@/app/api/training/lessons/[id]/questions/route";

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
  return new NextRequest("http://localhost/api/training/lessons/lesson-1/questions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePutReq(body: object) {
  return new NextRequest("http://localhost/api/training/lessons/lesson-1/questions", {
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

// ── POST Tests (create question) ───────────────────────────────────────────

describe("POST /api/training/lessons/[id]/questions", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makeReq({ type: "mcq", prompt: "What?" }), paramsFor("lesson-1"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when type or prompt missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makeReq({ type: "" }), paramsFor("lesson-1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/type.*prompt/i);
  });

  it("returns 404 when test not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // test not found
    const res = await POST(makeReq({ type: "mcq", prompt: "What?" }), paramsFor("lesson-1"));
    expect(res.status).toBe(404);
  });

  it("returns 201 and creates question with auto-order", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // 1. test found
    mockSelect([{ id: "test-1", lessonId: "lesson-1" }]);
    // 2. maxOrder
    mockSelect([{ max: 1 }]);
    // 3. insert question
    const newQ = { id: "q-new", testId: "test-1", type: "mcq", prompt: "What?", sortOrder: 2 };
    mockInsert([newQ]);

    const res = await POST(makeReq({ type: "mcq", prompt: "What?" }), paramsFor("lesson-1"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("q-new");
  });
});

// ── PUT Tests (reorder questions) ──────────────────────────────────────────

describe("PUT /api/training/lessons/[id]/questions (reorder)", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await PUT(makePutReq({ ids: ["q1", "q2"] }), paramsFor("lesson-1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 and reorders questions", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // one update per question id
    mockUpdate();
    mockUpdate();

    const res = await PUT(makePutReq({ ids: ["q2", "q1"] }), paramsFor("lesson-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reordered).toBe(true);
  });
});
