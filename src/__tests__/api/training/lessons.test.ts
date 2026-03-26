import { NextRequest } from "next/server";
import { GET, PUT, POST } from "@/app/api/training/lessons/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn(), update: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(url: string, method: string, body?: object) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByMock = jest.fn().mockResolvedValue(rows);
  const innerJoinResult = Object.assign(Promise.resolve(rows), { where: jest.fn().mockReturnValue(Object.assign(Promise.resolve(rows), { limit: limitMock, orderBy: orderByMock })) });
  const innerJoinMock = jest.fn().mockReturnValue(innerJoinResult);
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock, orderBy: orderByMock, innerJoin: innerJoinMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const fromResult = Object.assign(Promise.resolve(rows), {
    where: whereMock,
    orderBy: orderByMock,
    limit: limitMock,
    innerJoin: innerJoinMock,
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
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

// ── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/training/lessons", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with lessons for admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });

    // 1. allLessons select
    mockSelect([sampleLesson]);

    // Per-lesson enrichment (1 lesson):
    // 2. promptCount
    mockSelect([{ count: 3 }]);
    // 3. testRow (has test)
    mockSelect([{ id: "test-1" }]);
    // 4. questionCount
    mockSelect([{ count: 5 }]);
    // 5. uploadQuestionCount
    mockSelect([{ count: 1 }]);
    // 6. passedCount
    mockSelect([{ count: 10 }]);
    // 7. totalAttempts
    mockSelect([{ count: 20 }]);
    // 8. pendingReviews (testRow exists)
    mockSelect([{ count: 2 }]);
    // 9. tagInfo (tagId exists)
    mockSelect([{ name: "Voiceover", nameCn: "配音", color: "#5865f2" }]);
    // no prereqTagInfo (prerequisiteTagId is null)

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].promptCount).toBe(3);
    expect(json[0].passRate).toBe(50);
  });
});

// ── PUT Tests (reorder) ────────────────────────────────────────────────────

describe("PUT /api/training/lessons (reorder)", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await PUT(makeReq("/api/training/lessons", "PUT", { ids: ["a"] }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when ids array missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await PUT(makeReq("/api/training/lessons", "PUT", {}));
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // one update per id
    mockUpdate();
    mockUpdate();

    const res = await PUT(makeReq("/api/training/lessons", "PUT", { ids: ["l1", "l2"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});

// ── POST Tests (create) ────────────────────────────────────────────────────

describe("POST /api/training/lessons (create)", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makeReq("/api/training/lessons", "POST", { title: "Test" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when title missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makeReq("/api/training/lessons", "POST", {}));
    expect(res.status).toBe(400);
  });

  it("returns 201 and creates lesson with auto-test", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });

    // 1. maxOrder select
    mockSelect([{ max: 2 }]);
    // 2. insert lesson
    const newLesson = { ...sampleLesson, id: "lesson-new", order: 3 };
    mockInsert([newLesson]);
    // 3. insert auto-test
    mockInsert([]);

    const res = await POST(makeReq("/api/training/lessons", "POST", { title: "New Lesson" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("lesson-new");
  });
});
