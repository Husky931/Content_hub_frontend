import { NextRequest } from "next/server";
import { PUT } from "@/app/api/training/lessons/[id]/publish/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/training/lessons/lesson-1/publish", {
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

function mockUpdate() {
  const whereMock = jest.fn().mockResolvedValue(undefined);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

const lessonWithTag = {
  id: "lesson-1",
  title: "Voiceover Basics",
  status: "draft",
  tagId: "tag-1",
};

const lessonNoTag = {
  id: "lesson-1",
  title: "Voiceover Basics",
  status: "draft",
  tagId: null,
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PUT /api/training/lessons/[id]/publish", () => {
  it("returns 403 for non-admin/supermod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await PUT(makeReq({ action: "publish" }), paramsFor("lesson-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // lesson not found
    const res = await PUT(makeReq({ action: "publish" }), paramsFor("lesson-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when publishing with no prompts", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([lessonWithTag]); // lesson found
    mockSelect([{ count: 0 }]); // promptCount = 0
    const res = await PUT(makeReq({ action: "publish" }), paramsFor("lesson-1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/prompt/i);
  });

  it("returns 400 when publishing with no test", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([lessonWithTag]); // lesson found
    mockSelect([{ count: 1 }]); // has prompts
    mockSelect([]); // no test found
    const res = await PUT(makeReq({ action: "publish" }), paramsFor("lesson-1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/test/i);
  });

  it("returns 400 when publishing with no test questions", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([lessonWithTag]); // lesson found
    mockSelect([{ count: 1 }]); // has prompts
    mockSelect([{ id: "test-1" }]); // test found
    mockSelect([{ count: 0 }]); // no questions
    const res = await PUT(makeReq({ action: "publish" }), paramsFor("lesson-1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/question/i);
  });

  it("returns 400 when publishing with no tag bound", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([lessonNoTag]); // lesson without tag
    mockSelect([{ count: 1 }]); // has prompts
    mockSelect([{ id: "test-1" }]); // test found
    mockSelect([{ count: 2 }]); // has questions
    const res = await PUT(makeReq({ action: "publish" }), paramsFor("lesson-1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/tag/i);
  });

  it("returns 200 on publish success", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([lessonWithTag]); // lesson found with tag
    mockSelect([{ count: 2 }]); // has prompts
    mockSelect([{ id: "test-1" }]); // test found
    mockSelect([{ count: 3 }]); // has questions
    // update to published
    mockUpdate();
    // final select to return updated lesson
    mockSelect([{ ...lessonWithTag, status: "published" }]);

    const res = await PUT(makeReq({ action: "publish" }), paramsFor("lesson-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("published");
  });

  it("returns 200 on unpublish success", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([{ ...lessonWithTag, status: "published" }]); // lesson found
    // update to draft
    mockUpdate();
    // final select
    mockSelect([{ ...lessonWithTag, status: "draft" }]);

    const res = await PUT(makeReq({ action: "unpublish" }), paramsFor("lesson-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("draft");
  });
});
