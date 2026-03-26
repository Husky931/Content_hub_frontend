import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { GET } from "@/app/api/admin/channels/[channelId]/members/route";
import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const params = { params: Promise.resolve({ channelId: "ch-1" }) };

function makeReq() {
  return new NextRequest("http://localhost/api/admin/channels/ch-1/members", {
    method: "GET",
  });
}

/** Mock the channel select that uses `.then(rows => rows[0])` */
function mockChannelSelect(channel: any | undefined) {
  const thenMock = jest.fn().mockResolvedValue(channel);
  const whereMock = jest.fn().mockReturnValue({ then: thenMock });
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

/** Mock a standard select chain (mods / tagMembers) */
function mockSelect(rows: any[]) {
  const whereMock = jest.fn().mockResolvedValue(rows);
  const innerJoinMock = jest.fn().mockReturnValue({ where: whereMock });
  const fromMock = jest.fn().mockReturnValue({ innerJoin: innerJoinMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/admin/channels/[channelId]/members", () => {
  it("returns 403 for non-admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(403);
  });

  it("returns 404 when channel not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockChannelSelect(undefined);
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(404);
  });

  it("returns 200 with mods only when no requiredTagId", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockChannelSelect({ id: "ch-1", requiredTagId: null });
    mockSelect([
      { id: "u1", username: "mod1", displayName: "Mod 1", role: "mod" },
    ]);
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.noTag).toBe(true);
    expect(json.members).toHaveLength(1);
    expect(json.members[0].isMod).toBe(true);
  });

  it("returns 200 with merged mods + tag members when requiredTagId exists", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockChannelSelect({ id: "ch-1", requiredTagId: "tag-1" });
    // mods
    mockSelect([
      { id: "u1", username: "mod1", displayName: "Mod 1", role: "mod" },
    ]);
    // tag members (u1 duplicate, u2 new)
    mockSelect([
      { id: "u1", username: "mod1", displayName: "Mod 1", role: "mod", userTagId: "ut-1" },
      { id: "u2", username: "alice", displayName: "Alice", role: "creator", userTagId: "ut-2" },
    ]);
    const res = await GET(makeReq(), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tagId).toBe("tag-1");
    expect(json.members).toHaveLength(2); // u1 mod + u2 tag member (u1 not duplicated)
    expect(json.members[0].isMod).toBe(true);
    expect(json.members[1].isMod).toBe(false);
  });
});
