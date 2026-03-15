import { GET } from "@/app/api/auth/me/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/db", () => ({ db: { select: jest.fn() } }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockSelect(rows: object[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  // where must be thenable (some queries await .where() directly without .limit())
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const innerJoinMock = jest.fn().mockReturnValue({ where: whereMock });
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, innerJoin: innerJoinMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

const authPayload = { userId: "user-1", role: "creator", jti: "jti-abc" };

const fullUser = {
  id: "user-1",
  email: "alice@example.com",
  username: "alice",
  role: "creator",
  status: "verified",
  displayName: "Alice",
  avatarUrl: null,
  bio: null,
  currency: "usd",
  onboardingCompleted: false,
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Not authenticated" });
  });

  it("returns 401 when session no longer exists in the database", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(authPayload);
    mockSelect([]); // no matching session
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Session expired" });
  });

  it("returns 403 when user is not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(authPayload);
    mockSelect([{ id: "session-1" }]); // session found
    mockSelect([]);                     // user not found
    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Account unavailable" });
  });

  it("returns 403 when user is banned", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(authPayload);
    mockSelect([{ id: "session-1" }]);
    mockSelect([{ ...fullUser, status: "banned" }]);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "Account unavailable" });
  });

  it("returns 200 with user data when authenticated and session is valid", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(authPayload);
    mockSelect([{ id: "session-1" }]); // session found
    mockSelect([fullUser]);             // user found
    mockSelect([{ id: "tag-1", name: "Voiceover", nameCn: null, color: "#5865f2" }]); // user tags

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toMatchObject({
      id: "user-1",
      email: "alice@example.com",
      username: "alice",
      role: "creator",
      status: "verified",
    });
    expect(json.user.tags).toHaveLength(1);
  });
});
