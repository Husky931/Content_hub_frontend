import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/tasks/[taskId]/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("@/lib/ws-publish", () => ({
  publishSystemMessage: jest.fn().mockResolvedValue(undefined),
  publishTaskUpdate: jest.fn().mockResolvedValue(undefined),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeGetReq() {
  return new NextRequest("http://localhost/api/tasks/task-1");
}

function makePatchReq(body: object) {
  return new NextRequest("http://localhost/api/tasks/task-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const paramsPromise = Promise.resolve({ taskId: "task-1" });

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  // orderBy and where must be thenable — some queries await them without .limit()
  const orderByResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const orderByMock = jest.fn().mockReturnValue(orderByResult);
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock, orderBy: orderByMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const innerJoinMock3 = jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  const innerJoinMock2 = jest.fn().mockReturnValue({
    where: whereMock,
    innerJoin: innerJoinMock3,
    orderBy: orderByMock,
  });
  const innerJoinMock = jest.fn().mockReturnValue({
    where: whereMock,
    innerJoin: innerJoinMock2,
    orderBy: orderByMock,
  });
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    innerJoin: innerJoinMock,
    orderBy: orderByMock,
    limit: limitMock,
  });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdate(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
  return { setMock };
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

const sampleTask = {
  id: "task-1",
  channelId: "ch-1",
  createdById: "mod-1",
  title: "Record Greeting",
  description: "Record a greeting",
  status: "active",
  bountyUsd: "10.00",
  bountyRmb: "70.00",
  maxAttempts: 5,
  channelName: "voiceover-basic",
  channelSlug: "voiceover-basic",
  createdByUsername: "mod1",
  createdByDisplayName: "Mod One",
};

beforeEach(() => jest.clearAllMocks());

// ── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/tasks/[taskId]", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeGetReq(), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 404 when task not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([]); // task query

    const res = await GET(makeGetReq(), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns task detail with attempts", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([sampleTask]); // task query
    mockSelect([
      { id: "a1", userId: "u1", status: "submitted", deliverables: {}, username: "creator1", displayName: "Creator" },
    ]); // attempts query

    const res = await GET(makeGetReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.task.title).toBe("Record Greeting");
    expect(json.attempts).toHaveLength(1);
  });
});

// ── PATCH Tests ────────────────────────────────────────────────────────────

describe("PATCH /api/tasks/[taskId]", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ status: "archived" }), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 404 when task not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "admin" });
    mockSelect([]); // task lookup

    const res = await PATCH(makePatchReq({ status: "archived" }), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 403 for creator trying to update non-own task", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    mockSelect([{ ...sampleTask, createdById: "mod-1" }]);

    const res = await PATCH(makePatchReq({ title: "Hacked" }), { params: paramsPromise });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid status transition", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockSelect([{ ...sampleTask, status: "paid" }]);

    const res = await PATCH(makePatchReq({ status: "active" }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/cannot transition/i);
  });

  it("successfully publishes draft task (draft → active)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "admin-1", role: "admin" });
    const draftTask = { ...sampleTask, status: "draft" };
    mockSelect([draftTask]); // existing task
    // Channel lookup for system message
    mockSelect([{ id: "ch-1", slug: "voiceover-basic", requiredTagId: "tag-1" }]);
    // Publisher name
    mockSelect([{ username: "admin", displayName: "Admin" }]);
    // Insert system message
    mockInsert([{ id: "msg-1", createdAt: new Date() }]);
    // Tagged users for notification
    mockSelect([{ userId: "c1" }]);
    // Insert notifications
    mockInsert([]);
    // Update task
    mockUpdate([{ ...draftTask, status: "active" }]);

    const res = await PATCH(makePatchReq({ status: "active" }), { params: paramsPromise });
    expect(res.status).toBe(200);
  });

  it("successfully archives active task", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockSelect([{ ...sampleTask, status: "active" }]);
    mockUpdate([{ ...sampleTask, status: "archived", title: "Record Greeting" }]);
    // Channel slug lookup for publishTaskUpdate
    mockSelect([{ slug: "voiceover-basic" }]);

    const res = await PATCH(makePatchReq({ status: "archived" }), { params: paramsPromise });
    expect(res.status).toBe(200);
  });

  it("allows task creator to archive their own active task", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "mod-1", role: "creator" });
    mockSelect([{ ...sampleTask, status: "active", createdById: "mod-1" }]);
    mockUpdate([{ ...sampleTask, status: "archived", title: "Record Greeting" }]);
    // Channel slug lookup for publishTaskUpdate
    mockSelect([{ slug: "voiceover-basic" }]);

    const res = await PATCH(makePatchReq({ status: "archived" }), { params: paramsPromise });
    expect(res.status).toBe(200);
  });
});
