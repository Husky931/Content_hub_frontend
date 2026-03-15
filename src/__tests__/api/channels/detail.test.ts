import { NextRequest } from "next/server";
import { GET } from "@/app/api/channels/[slug]/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn() },
}));

import { db } from "@/db";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsPromise = Promise.resolve({ slug: "general" });

function makeReq() {
  return new NextRequest("http://localhost/api/channels/general");
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const orderByMock = jest.fn().mockReturnValue(orderByResult);
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock, orderBy: orderByMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const innerJoinMock = jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    innerJoin: innerJoinMock,
    orderBy: orderByMock,
    limit: limitMock,
  });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

const sampleChannel = {
  id: "ch-1",
  name: "general",
  type: "discussion",
  description: "General chat",
  slug: "general",
};

const sampleMessage = {
  id: "msg-1",
  content: "Hello world",
  type: "text",
  createdAt: new Date(),
  userId: "u1",
  username: "user1",
  displayName: "User One",
  avatarUrl: null,
  role: "creator",
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/channels/[slug]", () => {
  it("returns 404 when channel not found", async () => {
    mockSelect([]); // channel lookup
    const res = await GET(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns channel with messages", async () => {
    mockSelect([sampleChannel]); // channel found
    mockSelect([sampleMessage]); // messages

    const res = await GET(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.channel.name).toBe("general");
    expect(json.messages).toHaveLength(1);
    expect(json.messages[0].content).toBe("Hello world");
    expect(json.messages[0].user.username).toBe("user1");
  });

  it("returns channel with empty messages", async () => {
    mockSelect([sampleChannel]);
    mockSelect([]);

    const res = await GET(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.channel.name).toBe("general");
    expect(json.messages).toHaveLength(0);
  });
});
