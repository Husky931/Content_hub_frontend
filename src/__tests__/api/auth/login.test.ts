import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/login/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/db", () => ({ db: { select: jest.fn(), insert: jest.fn() } }));

// Pull mocked references AFTER jest.mock() declarations
import { db } from "@/db";
import { cookies } from "next/headers";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockSelect(rows: object[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockInsert() {
  const valuesMock = jest.fn().mockResolvedValue([]);
  (db.insert as jest.Mock).mockReturnValueOnce({ values: valuesMock });
}

const mockCookieStore = { set: jest.fn(), get: jest.fn(), delete: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (cookies as jest.Mock).mockResolvedValue(mockCookieStore);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  describe("input validation", () => {
    it("returns 400 when email is missing", async () => {
      const res = await POST(makeRequest({ password: "pass1234" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("required") });
    });

    it("returns 400 when password is missing", async () => {
      const res = await POST(makeRequest({ email: "a@b.com" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("required") });
    });
  });

  describe("authentication failures", () => {
    it("returns 401 when user is not found", async () => {
      mockSelect([]); // no user
      const res = await POST(makeRequest({ email: "nobody@example.com", password: "pass1234" }));
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "Invalid email or password" });
    });

    it("returns 403 when account is banned", async () => {
      mockSelect([{ id: "u1", status: "banned", banReason: "spamming", passwordHash: "x" }]);
      const res = await POST(makeRequest({ email: "banned@example.com", password: "pass1234" }));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/banned/i);
    });

    it("returns 403 when account is pending verification", async () => {
      mockSelect([{ id: "u1", status: "pending_verification", passwordHash: "x" }]);
      const res = await POST(makeRequest({ email: "unverified@example.com", password: "pass1234" }));
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("verify") });
    });

    it("returns 401 when password is wrong", async () => {
      // Real bcrypt hash of "correctpassword"
      const { hashPassword } = await import("@/lib/auth");
      const hash = hashPassword("correctpassword");
      mockSelect([{ id: "u1", status: "verified", role: "creator", passwordHash: hash }]);
      const res = await POST(makeRequest({ email: "user@example.com", password: "wrongpassword" }));
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "Invalid email or password" });
    });
  });

  describe("successful login", () => {
    it("returns 200 with user data and sets auth cookie", async () => {
      const { hashPassword } = await import("@/lib/auth");
      const hash = hashPassword("mypassword");
      mockSelect([
        {
          id: "user-1",
          email: "alice@example.com",
          username: "alice",
          role: "creator",
          status: "verified",
          displayName: "Alice",
          avatarUrl: null,
          onboardingCompleted: false,
          currency: "usd",
          passwordHash: hash,
        },
      ]);
      mockInsert(); // sessions insert

      const res = await POST(makeRequest({ email: "alice@example.com", password: "mypassword" }));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.user).toMatchObject({
        id: "user-1",
        email: "alice@example.com",
        username: "alice",
        role: "creator",
      });
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "auth_token",
        expect.any(String),
        expect.objectContaining({ httpOnly: true })
      );
    });
  });
});
