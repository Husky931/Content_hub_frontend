// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { POST, DELETE } from "@/app/api/templates/seed/route";
import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const fromResult = Object.assign(Promise.resolve(rows), { where: whereMock, limit: limitMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: jest.fn().mockReturnValue(fromResult) });
}

function mockInsert(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const valuesMock = jest.fn().mockReturnValue({ returning: returningMock });
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

function mockDeleteAll() {
  (db.delete as jest.Mock).mockReturnValueOnce(Promise.resolve());
}

beforeEach(() => jest.clearAllMocks());

// ── POST /api/templates/seed ──────────────────────────────────────────────

describe("POST /api/templates/seed", () => {
  it("returns 403 for non-admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "mod-1", role: "mod" });
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns 200 when templates already exist (seeded: false)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // count query returns > 0
    mockSelect([{ count: 3 }]);

    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.seeded).toBe(false);
  });

  it("returns 201 when seeding succeeds", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // count query returns 0
    mockSelect([{ count: 0 }]);
    // insert templates
    const seeded = [
      { id: "tpl-1", name: "Audio Recording" },
      { id: "tpl-2", name: "Video Recording" },
      { id: "tpl-3", name: "Image Capture" },
    ];
    mockInsert(seeded);

    const res = await POST();
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.seeded).toBe(true);
    expect(json.templates).toHaveLength(3);
  });
});

// ── DELETE /api/templates/seed ─────────────────────────────────────────────

describe("DELETE /api/templates/seed", () => {
  it("returns 403 for non-admin", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "supermod" });
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  it("returns 200 and re-seeds successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin" });
    // delete all templates
    mockDeleteAll();
    // insert seeded templates
    const seeded = [
      { id: "tpl-1", name: "Audio Recording" },
      { id: "tpl-2", name: "Video Recording" },
      { id: "tpl-3", name: "Image Capture" },
    ];
    mockInsert(seeded);

    const res = await DELETE();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reseeded).toBe(true);
    expect(json.templates).toHaveLength(3);
  });
});
