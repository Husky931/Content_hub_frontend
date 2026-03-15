import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/tasks/route";

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

function makeReq(params?: Record<string, string>) {
  const u = new URL("http://localhost/api/admin/tasks");
  if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new NextRequest(u);
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const groupByMock = jest.fn().mockResolvedValue(rows);
  const orderByResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const orderByMock = jest.fn().mockReturnValue(orderByResult);
  const whereResult = Object.assign(Promise.resolve(rows), {
    limit: limitMock,
    orderBy: orderByMock,
    groupBy: groupByMock,
  });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const innerJoinMock3 = jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  const innerJoinMock2 = jest.fn().mockReturnValue({
    where: whereMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock3,
  });
  const innerJoinMock = jest.fn().mockReturnValue({
    where: whereMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock2,
  });
  const fromResult = Object.assign(Promise.resolve(rows), {
    where: whereMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock,
    limit: limitMock,
    groupBy: groupByMock,
  });
  const fromMock = jest.fn().mockReturnValue(fromResult);
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

const sampleTask = {
  id: "task-1",
  channelId: "ch-1",
  createdById: "mod-1",
  title: "Test Task",
  status: "active",
  bountyUsd: "10.00",
  channelName: "voiceover-basic",
  channelSlug: "voiceover-basic",
  createdByUsername: "mod1",
  reviewClaimedById: null,
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/admin/tasks", () => {
  it("returns 403 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns all tasks for admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // Main tasks query
    mockSelect([sampleTask]);
    // Attempt counts
    mockSelect([{ taskId: "task-1", count: 3 }]);
    // No reviewerIds to resolve

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tasks).toHaveLength(1);
    expect(json.tasks[0].attemptCount).toBe(3);
  });

  it("filters tasks by channel for mod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    // Main tasks query (returns all, filtering happens in JS)
    mockSelect([sampleTask, { ...sampleTask, id: "task-2", channelId: "ch-2", createdById: "admin-1" }]);
    // Mod's channel assignments
    mockSelect([{ channelId: "ch-1" }]);
    // Attempt counts (for filtered tasks)
    mockSelect([{ taskId: "task-1", count: 1 }]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    // Mod should see task-1 (ch-1 assigned) but not task-2 (ch-2 not assigned, not creator)
    expect(json.tasks).toHaveLength(1);
    expect(json.tasks[0].id).toBe("task-1");
    expect(json.modChannelIds).toEqual(["ch-1"]);
  });

  it("returns empty tasks list", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // no tasks

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tasks).toHaveLength(0);
  });
});
