import { NextRequest } from "next/server";
import { PUT } from "@/app/api/settings/locale/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { update: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/settings/locale", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockUpdateChain() {
  const whereMock = jest.fn().mockResolvedValue(undefined);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PUT /api/settings/locale", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await PUT(makeReq({ locale: "en" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when locale is invalid", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await PUT(makeReq({ locale: "fr" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid locale/i);
  });

  it("returns 400 when locale is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await PUT(makeReq({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid locale/i);
  });

  it("returns 200 and sets cookie for locale 'en'", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockUpdateChain();

    const res = await PUT(makeReq({ locale: "en" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(db.update).toHaveBeenCalled();

    const cookie = res.cookies.get("NEXT_LOCALE");
    expect(cookie?.value).toBe("en");
  });

  it("returns 200 and sets cookie for locale 'zh'", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockUpdateChain();

    const res = await PUT(makeReq({ locale: "zh" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const cookie = res.cookies.get("NEXT_LOCALE");
    expect(cookie?.value).toBe("zh");
  });
});
