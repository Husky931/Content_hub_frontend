import { GET } from "@/app/api/admin/stats/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockCountSelect(value: number) {
  const whereResult = Object.assign(Promise.resolve([{ value }]), {});
  const whereMock = jest.fn().mockReturnValue(whereResult);
  // from must be thenable (some queries await .from() directly) AND have .where()
  const fromResult = Object.assign(Promise.resolve([{ value }]), { where: whereMock });
  const fromMock = jest.fn().mockReturnValue(fromResult);
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/admin/stats", () => {
  it("returns 403 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 for non-admin roles", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns stats for admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // These are called via Promise.all — 4 count queries
    mockCountSelect(10); // users
    mockCountSelect(3);  // active invites
    mockCountSelect(5);  // tags
    mockCountSelect(12); // channels

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalUsers).toBe(10);
    expect(json.activeInvites).toBe(3);
    expect(json.totalTags).toBe(5);
    expect(json.totalChannels).toBe(12);
  });
});
