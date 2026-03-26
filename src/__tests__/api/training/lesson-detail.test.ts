import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "@/app/api/training/lessons/[id]/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

function makeReq(url: string, method: string, body?: object) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
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

function mockUpdate(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const whereResult = Object.assign(Promise.resolve(returned), { returning: returningMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

function mockDelete() {
  const whereMock = jest.fn().mockResolvedValue(undefined);
  (db.delete as jest.Mock).mockReturnValueOnce({ where: whereMock });
}

const sampleLesson = {
  id: "lesson-1",
  title: "Intro to Voiceover",
  titleCn: null,
  description: "Learn the basics",
  order: 1,
  status: "draft",
  tagId: "tag-1",
  prerequisiteTagId: null,
  passingScore: 70,
  retryAfterHours: 24,
  createdAt: new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

// ── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/training/lessons/[id]", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const req = makeReq("/api/training/lessons/lesson-1", "GET");
    const res = await GET(req, paramsFor("lesson-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // lesson not found
    const req = makeReq("/api/training/lessons/nope", "GET");
    const res = await GET(req, paramsFor("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with full lesson detail", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });

    // 1. lesson
    mockSelect([sampleLesson]);
    // 2. prompts
    mockSelect([{ id: "p1", content: "Hi", order: 0 }]);
    // 3. test
    const testObj = { id: "test-1", lessonId: "lesson-1" };
    mockSelect([testObj]);
    // 4. questions (test exists)
    mockSelect([{ id: "q1", prompt: "What?", sortOrder: 0 }]);
    // 5. tagInfo (tagId exists)
    mockSelect([{ id: "tag-1", name: "Voiceover" }]);
    // no prereqTagInfo (null)
    // 6. passedCount
    mockSelect([{ count: 5 }]);
    // 7. totalCount
    mockSelect([{ count: 10 }]);

    const req = makeReq("/api/training/lessons/lesson-1", "GET");
    const res = await GET(req, paramsFor("lesson-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.prompts).toHaveLength(1);
    expect(json.test.questions).toHaveLength(1);
    expect(json.stats.passRate).toBe(50);
  });
});

// ── PUT Tests (update) ─────────────────────────────────────────────────────

describe("PUT /api/training/lessons/[id]", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const req = makeReq("/api/training/lessons/lesson-1", "PUT", { title: "X" });
    const res = await PUT(req, paramsFor("lesson-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockUpdate([]); // returning empty
    const req = makeReq("/api/training/lessons/nope", "PUT", { title: "X" });
    const res = await PUT(req, paramsFor("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const updated = { ...sampleLesson, title: "Updated" };
    mockUpdate([updated]);
    const req = makeReq("/api/training/lessons/lesson-1", "PUT", { title: "Updated" });
    const res = await PUT(req, paramsFor("lesson-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Updated");
  });
});

// ── DELETE Tests ────────────────────────────────────────────────────────────

describe("DELETE /api/training/lessons/[id]", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const req = makeReq("/api/training/lessons/lesson-1", "DELETE");
    const res = await DELETE(req, paramsFor("lesson-1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with archived:true when progress exists", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // progressCount > 0
    mockSelect([{ count: 5 }]);
    // soft archive update
    mockUpdate();
    const req = makeReq("/api/training/lessons/lesson-1", "DELETE");
    const res = await DELETE(req, paramsFor("lesson-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.archived).toBe(true);
  });

  it("returns 200 with deleted:true when no progress", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // progressCount === 0
    mockSelect([{ count: 0 }]);
    // hard delete
    mockDelete();
    const req = makeReq("/api/training/lessons/lesson-1", "DELETE");
    const res = await DELETE(req, paramsFor("lesson-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(true);
  });
});
