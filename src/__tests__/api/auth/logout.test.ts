import { POST } from "@/app/api/auth/logout/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/db", () => ({ db: { delete: jest.fn() } }));
jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { cookies } from "next/headers";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockDelete() {
  const whereMock = jest.fn().mockResolvedValue([]);
  (db.delete as jest.Mock).mockReturnValueOnce({ where: whereMock });
}

const mockCookieStore = { set: jest.fn(), get: jest.fn(), delete: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (cookies as jest.Mock).mockResolvedValue(mockCookieStore);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("returns 200 and clears the cookie when authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({
      userId: "user-1",
      role: "creator",
      jti: "token-jti-abc",
    });
    mockDelete(); // sessions.delete

    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ message: "Logged out" });
    expect(db.delete).toHaveBeenCalled();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth_token");
  });

  it("still returns 200 and clears cookie when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);

    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ message: "Logged out" });
    expect(db.delete).not.toHaveBeenCalled(); // no session to delete
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth_token");
  });
});
