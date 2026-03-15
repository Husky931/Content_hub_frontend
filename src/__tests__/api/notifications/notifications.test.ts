import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/notifications/route";

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

function makeGetReq(params?: Record<string, string>) {
  const u = new URL("http://localhost/api/notifications");
  if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new NextRequest(u);
}

function makePatchReq(body: object) {
  return new NextRequest("http://localhost/api/notifications", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const sampleNotifs = [
  { id: "n1", userId: "u1", type: "task_approved", title: "Approved", body: "msg", readAt: null, createdAt: new Date() },
  { id: "n2", userId: "u1", type: "payout", title: "Payout", body: "msg2", readAt: new Date(), createdAt: new Date() },
];

function mockSelectReturning(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const orderByResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const orderByMock = jest.fn().mockReturnValue(orderByResult);
  const whereResult = Object.assign(Promise.resolve(rows), { orderBy: orderByMock, limit: limitMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, orderBy: orderByMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdate() {
  const whereMock = jest.fn().mockResolvedValue([]);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
  return { setMock, whereMock };
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/notifications", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeGetReq());
    expect(res.status).toBe(401);
  });

  it("returns notifications and unread count", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    // First select: notifications list
    mockSelectReturning(sampleNotifs);
    // Second select: unread count
    mockSelectReturning([{ count: 1 }]);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notifications).toHaveLength(2);
    expect(json.unreadCount).toBe(1);
  });

  it("supports unread-only filter", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelectReturning([sampleNotifs[0]]);
    mockSelectReturning([{ count: 1 }]);

    const res = await GET(makeGetReq({ unread: "true" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notifications).toHaveLength(1);
  });
});

describe("PATCH /api/notifications", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ markAll: true }));
    expect(res.status).toBe(401);
  });

  it("marks all notifications as read", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockUpdate();

    const res = await PATCH(makePatchReq({ markAll: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });

  it("marks specific notifications as read", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockUpdate(); // for notif n1
    mockUpdate(); // for notif n2

    const res = await PATCH(makePatchReq({ notificationIds: ["n1", "n2"] }));
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledTimes(2);
  });
});
