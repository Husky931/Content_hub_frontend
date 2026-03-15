import { NextRequest } from "next/server";
import { POST } from "@/app/api/channels/[slug]/messages/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsPromise = Promise.resolve({ slug: "general" });
const announceParams = Promise.resolve({ slug: "announcements" });

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/channels/general/messages", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, limit: limitMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

const generalChannel = { id: "ch-gen", name: "general", slug: "general", type: "discussion" };
const announceChannel = { id: "ch-ann", name: "announcements", slug: "announcements", type: "special" };

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/channels/[slug]/messages", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeReq({ content: "hi" }), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 400 when content is empty", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await POST(makeReq({ content: "" }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 when content exceeds 2000 chars", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await POST(makeReq({ content: "x".repeat(2001) }), { params: paramsPromise });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/2000/);
  });

  it("returns 404 when channel not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([]); // channel not found

    const res = await POST(makeReq({ content: "hello" }), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 403 when creator posts to announcements", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([announceChannel]);

    const res = await POST(makeReq({ content: "hello" }), { params: announceParams });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/cannot post/i);
  });

  it("allows admin to post in announcements", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([announceChannel]); // channel found
    const newMsg = { id: "msg-1", content: "Important!", type: "mod", createdAt: new Date() };
    mockInsert([newMsg]); // insert message
    mockSelect([{ id: "a1", username: "admin", displayName: "Admin", avatarUrl: null, role: "admin" }]);

    const res = await POST(makeReq({ content: "Important!" }), { params: announceParams });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message.type).toBe("mod");
  });

  it("creates text message in general channel", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([generalChannel]);
    const newMsg = { id: "msg-2", content: "Hello!", type: "text", createdAt: new Date() };
    mockInsert([newMsg]);
    mockSelect([{ id: "u1", username: "user1", displayName: "User One", avatarUrl: null, role: "creator" }]);

    const res = await POST(makeReq({ content: "Hello!" }), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message.content).toBe("Hello!");
    expect(json.message.user.username).toBe("user1");
  });
});
