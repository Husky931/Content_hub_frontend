import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/channels/route";

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

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/admin/channels", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, limit: limitMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/admin/channels", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await POST(makeReq({ name: "test", type: "task" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 for creator", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makeReq({ name: "test", type: "task" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makeReq({ type: "task" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makeReq({ name: "test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid channel type", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makeReq({ name: "test", type: "special" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/task.*discussion/i);
  });

  it("returns 409 when channel name already exists", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([{ id: "existing" }]); // slug check

    const res = await POST(makeReq({ name: "General", type: "discussion" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 when required tag not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // slug check (unique)
    mockSelect([]); // tag not found

    const res = await POST(makeReq({ name: "New Task", type: "task", requiredTagId: "nonexistent" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/tag not found/i);
  });

  it("creates discussion channel successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // slug unique
    const newChannel = {
      id: "ch-new",
      name: "New Discussion",
      slug: "new-discussion",
      type: "discussion",
    };
    mockInsert([newChannel]);

    const res = await POST(makeReq({ name: "New Discussion", type: "discussion" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.channel.name).toBe("New Discussion");
  });

  it("creates task channel with tag and mods", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // slug unique
    mockSelect([{ id: "tag-1" }]); // tag found
    const newChannel = {
      id: "ch-new-task",
      name: "New Task Channel",
      slug: "new-task-channel",
      type: "task",
      requiredTagId: "tag-1",
    };
    mockInsert([newChannel]); // insert channel
    mockInsert([]); // insert channelMods

    const res = await POST(makeReq({
      name: "New Task Channel",
      type: "task",
      requiredTagId: "tag-1",
      modUserIds: ["m1", "m2"],
    }));
    expect(res.status).toBe(201);
  });
});
