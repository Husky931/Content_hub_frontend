import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/tags/route";

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

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/admin/tags", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ limit: limitMock, orderBy: orderByMock });
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    orderBy: orderByMock,
    limit: limitMock,
  });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

const sampleTag = {
  id: "tag-1",
  name: "Voiceover",
  nameCn: "配音",
  description: "Basic voiceover",
  color: "#5865f2",
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

// ── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/admin/tags", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 for mod", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns all tags for admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([sampleTag, { ...sampleTag, id: "tag-2", name: "Translation" }]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tags).toHaveLength(2);
  });
});

// ── POST Tests ─────────────────────────────────────────────────────────────

describe("POST /api/admin/tags", () => {
  it("returns 403 when not admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makePostReq({ name: "Test" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is empty", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makePostReq({ name: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/name/i);
  });

  it("returns 409 when tag name already exists", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([{ id: "existing" }]); // existing tag found

    const res = await POST(makePostReq({ name: "Voiceover" }));
    expect(res.status).toBe(409);
  });

  it("creates tag successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]); // no existing tag
    mockInsert([{ ...sampleTag, id: "tag-new", name: "New Tag" }]);

    const res = await POST(makePostReq({ name: "New Tag", color: "#ff0000" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tag.name).toBe("New Tag");
  });

  it("uses default color when not provided", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([]);
    mockInsert([{ ...sampleTag, name: "No Color Tag" }]);

    const res = await POST(makePostReq({ name: "No Color Tag" }));
    expect(res.status).toBe(200);
  });
});
