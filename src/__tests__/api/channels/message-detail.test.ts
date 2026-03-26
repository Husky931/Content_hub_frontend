import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/channels/[slug]/messages/[messageId]/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("@/lib/ws-publish", () => ({
  wsPublish: jest.fn().mockResolvedValue(undefined),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsPromise = Promise.resolve({ slug: "general", messageId: "msg-1" });

function makePatchReq(body: object) {
  return new NextRequest("http://localhost/api/channels/general/messages/msg-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteReq() {
  return new NextRequest("http://localhost/api/channels/general/messages/msg-1", {
    method: "DELETE",
  });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
  const whereResult = Object.assign(Promise.resolve(rows), {
    limit: limitMock,
    orderBy: orderByMock,
  });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const innerJoinMock = jest.fn().mockReturnValue({ where: whereMock, limit: limitMock });
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    limit: limitMock,
    orderBy: orderByMock,
    innerJoin: innerJoinMock,
  });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdateReturning(rows: any[]) {
  const returningMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

function mockUpdate() {
  const whereMock = jest.fn().mockResolvedValue([]);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

const generalChannel = { id: "ch-gen" };

const ownMessage = {
  id: "msg-1",
  userId: "u1",
  channelId: "ch-gen",
  deletedAt: null,
  privateToUserId: null,
};

const otherMessage = {
  id: "msg-1",
  userId: "u2",
  channelId: "ch-gen",
  deletedAt: null,
  privateToUserId: null,
};

beforeEach(() => jest.clearAllMocks());

// ── PATCH Tests ────────────────────────────────────────────────────────────

describe("PATCH /api/channels/[slug]/messages/[messageId]", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ content: "hi" }), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 400 when content is empty", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await PATCH(makePatchReq({ content: "" }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 when content exceeds 2000 chars", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await PATCH(makePatchReq({ content: "x".repeat(2001) }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/2000/);
  });

  it("returns 404 when channel not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([]); // channel not found

    const res = await PATCH(makePatchReq({ content: "hello" }), { params: paramsPromise });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/channel not found/i);
  });

  it("returns 404 when message not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([generalChannel]); // channel found
    mockSelect([]); // message not found

    const res = await PATCH(makePatchReq({ content: "hello" }), { params: paramsPromise });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/message not found/i);
  });

  it("returns 403 when editing another user's message", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([generalChannel]); // channel found
    mockSelect([otherMessage]); // message by u2

    const res = await PATCH(makePatchReq({ content: "hello" }), { params: paramsPromise });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/own messages/i);
  });

  it("returns 200 and updates own message", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([generalChannel]); // channel found
    mockSelect([ownMessage]); // own message
    const now = new Date();
    mockUpdateReturning([{ id: "msg-1", content: "updated text", updatedAt: now }]);

    const res = await PATCH(makePatchReq({ content: "updated text" }), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message.content).toBe("updated text");
  });
});

// ── DELETE Tests ───────────────────────────────────────────────────────────

describe("DELETE /api/channels/[slug]/messages/[messageId]", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 404 when channel not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([]); // channel not found

    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/channel not found/i);
  });

  it("returns 404 when message not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([generalChannel]); // channel found
    mockSelect([]); // message not found

    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/message not found/i);
  });

  it("returns 403 when creator tries to delete mod's message", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([generalChannel]); // channel found
    mockSelect([{
      id: "msg-1",
      userId: "m1",
      channelId: "ch-gen",
      deletedAt: null,
      privateToUserId: null,
      userRole: "mod",
    }]);

    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/permission/i);
  });

  it("returns 200 when deleting own message", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([generalChannel]); // channel found
    mockSelect([{
      id: "msg-1",
      userId: "u1",
      channelId: "ch-gen",
      deletedAt: null,
      privateToUserId: null,
      userRole: "creator",
    }]);
    mockUpdate(); // soft delete

    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 200 when admin deletes anyone's message", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([generalChannel]); // channel found
    mockSelect([{
      id: "msg-1",
      userId: "m1",
      channelId: "ch-gen",
      deletedAt: null,
      privateToUserId: null,
      userRole: "mod",
    }]);
    mockUpdate(); // soft delete

    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
