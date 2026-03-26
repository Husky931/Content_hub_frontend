import { NextRequest } from "next/server";
import { POST } from "@/app/api/channels/[slug]/read/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsPromise = Promise.resolve({ slug: "general" });

function makeReq() {
  return new NextRequest("http://localhost/api/channels/general/read", {
    method: "POST",
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
  const fromMock = jest.fn().mockReturnValue({
    where: whereMock,
    limit: limitMock,
    orderBy: orderByMock,
  });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdate() {
  const whereMock = jest.fn().mockResolvedValue([]);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

function mockInsert() {
  const valuesMock = jest.fn().mockResolvedValue([]);
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/channels/[slug]/read", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 404 when channel not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([]); // channel not found

    const res = await POST(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/channel not found/i);
  });

  it("returns 200 and creates new read record when none exists", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([{ id: "ch-gen" }]); // channel found
    mockSelect([{ id: "msg-latest" }]); // latest message
    mockSelect([]); // no existing channelReads record
    mockInsert(); // insert new record

    const res = await POST(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(db.insert).toHaveBeenCalled();
  });

  it("returns 200 and updates existing read record", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([{ id: "ch-gen" }]); // channel found
    mockSelect([{ id: "msg-latest" }]); // latest message
    mockSelect([{ id: "read-1" }]); // existing channelReads record
    mockUpdate(); // update existing record

    const res = await POST(makeReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });
});
