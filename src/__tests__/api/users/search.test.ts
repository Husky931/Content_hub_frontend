import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { GET } from "@/app/api/users/search/route";
import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(query = "") {
  const url = query
    ? `http://localhost/api/users/search?q=${encodeURIComponent(query)}`
    : "http://localhost/api/users/search";
  return new NextRequest(new URL(url));
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
  const whereMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/users/search", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeReq("alice"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty array when q is empty", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await GET(makeReq(""));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.users).toEqual([]);
  });

  it("returns 200 with matching users", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const results = [
      { id: "u2", username: "alice", displayName: "Alice", avatarUrl: null, role: "creator" },
    ];
    mockSelect(results);
    const res = await GET(makeReq("alice"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.users).toHaveLength(1);
    expect(json.users[0].username).toBe("alice");
  });
});
