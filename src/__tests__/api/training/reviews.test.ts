import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { GET } from "@/app/api/training/reviews/route";
import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/training/reviews");
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

/**
 * Mock a db.select() chain that resolves to `rows`.
 * Handles: select(cols).from(table).where(...) / innerJoin / orderBy / $dynamic
 */
function mockSelect(rows: unknown[]) {
  const whereMock = jest.fn().mockResolvedValue(rows);
  const dynamicMock = jest.fn().mockReturnValue({ where: whereMock, then: (cb: (v: unknown) => void) => Promise.resolve(rows).then(cb) });
  const orderByMock = jest.fn().mockReturnValue({ $dynamic: dynamicMock });
  const innerJoinMock = jest.fn().mockImplementation(function (this: any) { return this; });
  const fromResult: any = {
    where: whereMock,
    innerJoin: innerJoinMock,
    orderBy: orderByMock,
    $dynamic: dynamicMock,
  };
  // innerJoin returns the same chainable object
  innerJoinMock.mockReturnValue(fromResult);
  const fromMock = jest.fn().mockReturnValue(fromResult);
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

/**
 * Mock a simple db.select() -> from -> where chain that resolves to `rows`.
 * Used for stats queries and enrichment sub-queries.
 */
function mockSimpleSelect(rows: unknown[]) {
  const whereMock = jest.fn().mockResolvedValue(rows);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/training/reviews", () => {
  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 403 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 200 with empty submissions and zero stats", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "admin" });

    // 1. Main query: select...from...innerJoin x4...orderBy...$dynamic -> []
    mockSelect([]);

    // 2. Stats: pendingCount
    mockSimpleSelect([{ count: 0 }]);
    // 3. Stats: approvedToday
    mockSimpleSelect([{ count: 0 }]);
    // 4. Stats: rejectedToday
    mockSimpleSelect([{ count: 0 }]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.submissions).toEqual([]);
    expect(json.stats).toEqual({ pending: 0, approvedToday: 0, rejectedToday: 0 });
  });

  it("returns 200 with enriched submissions for mod role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });

    const submissionRow = {
      id: "sub-1",
      fileUrl: "https://example.com/file.png",
      fileName: "file.png",
      fileType: "image/png",
      fileSize: 1024,
      status: "pending",
      rejectionReason: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
      questionPrompt: "Upload your work",
      questionType: "upload",
      questionSortOrder: 1,
      lessonTitle: "Lesson 1",
      lessonId: "les-1",
      userName: "alice",
      userDisplayName: "Alice",
      userAvatarUrl: null,
      userId: "u-alice",
      userProgressId: "prog-1",
      reviewerId: null,
    };

    // 1. Main query returns one submission
    mockSelect([submissionRow]);

    // 2. Enrichment: userProgress for sub-1
    mockSimpleSelect([{ attempts: 1, cheatingWarnings: 0, score: 80, testAnswers: [] }]);
    // 3. Enrichment: lesson tagId for sub-1 (no reviewerId so no reviewer query)
    mockSimpleSelect([{ tagId: "tag-1" }]);

    // 4. Stats: pendingCount
    mockSimpleSelect([{ count: 1 }]);
    // 5. Stats: approvedToday
    mockSimpleSelect([{ count: 2 }]);
    // 6. Stats: rejectedToday
    mockSimpleSelect([{ count: 3 }]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.submissions).toHaveLength(1);
    expect(json.submissions[0].id).toBe("sub-1");
    expect(json.submissions[0].cheatingWarnings).toBe(0);
    expect(json.submissions[0].lessonAttempts).toBe(1);
    expect(json.submissions[0].autoScore).toBe(80);
    expect(json.submissions[0].tagOnPass).toBe("tag-1");
    expect(json.stats).toEqual({ pending: 1, approvedToday: 2, rejectedToday: 3 });
  });
});
