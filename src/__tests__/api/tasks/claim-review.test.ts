import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/tasks/[taskId]/claim-review/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

const paramsPromise = Promise.resolve({ taskId: "task-1" });

function makePostReq() {
  return new NextRequest("http://localhost/api/tasks/task-1/claim-review", { method: "POST" });
}

function makeDeleteReq() {
  return new NextRequest("http://localhost/api/tasks/task-1/claim-review", { method: "DELETE" });
}

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, limit: limitMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdate() {
  const whereMock = jest.fn().mockResolvedValue([]);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

const unclaimedTask = {
  id: "task-1",
  channelId: "ch-1",
  reviewClaimedById: null,
  reviewClaimedAt: null,
};

beforeEach(() => jest.clearAllMocks());

// ── POST (Claim) Tests ─────────────────────────────────────────────────────

describe("POST /api/tasks/[taskId]/claim-review", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makePostReq(), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await POST(makePostReq(), { params: paramsPromise });
    expect(res.status).toBe(403);
  });

  it("returns 404 when task not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([]);

    const res = await POST(makePostReq(), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 409 when already claimed by another user", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([{ ...unclaimedTask, reviewClaimedById: "m2" }]); // task claimed by m2
    mockSelect([{ username: "mod2", displayName: "Mod Two" }]); // claimer info

    const res = await POST(makePostReq(), { params: paramsPromise });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/already.*reviewed/i);
  });

  it("returns success (no-op) when already claimed by self", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([{ ...unclaimedTask, reviewClaimedById: "m1" }]);

    const res = await POST(makePostReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 403 when mod is not assigned to channel", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([unclaimedTask]); // task found
    mockSelect([]); // no mod assignment

    const res = await POST(makePostReq(), { params: paramsPromise });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/not assigned/i);
  });

  it("claims task successfully for admin (bypasses channel check)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([unclaimedTask]);
    mockUpdate();

    const res = await POST(makePostReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("claims task successfully for mod with channel assignment", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([unclaimedTask]);
    mockSelect([{ id: "cm-1" }]); // mod assigned to channel
    mockUpdate();

    const res = await POST(makePostReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
  });
});

// ── DELETE (Release) Tests ──────────────────────────────────────────────────

describe("DELETE /api/tasks/[taskId]/claim-review", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(401);
  });

  it("returns 403 for creator role", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "c1", role: "creator" });
    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(403);
  });

  it("returns 404 when task not found", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([]);

    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it("returns 403 when non-claimer tries to release (and not admin)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([{ reviewClaimedById: "m2" }]); // claimed by m2

    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/did not claim/i);
  });

  it("releases claim successfully by claimer", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod" });
    mockSelect([{ reviewClaimedById: "m1" }]);
    mockUpdate();

    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("allows admin to release any claim", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    mockSelect([{ reviewClaimedById: "m2" }]); // claimed by m2
    mockUpdate();

    const res = await DELETE(makeDeleteReq(), { params: paramsPromise });
    expect(res.status).toBe(200);
  });
});
