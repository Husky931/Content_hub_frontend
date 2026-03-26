import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/login-phone/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/db", () => ({
  db: { select: jest.fn(), insert: jest.fn() },
}));
jest.mock("@/lib/otp-store", () => ({ verifyOtp: jest.fn() }));
jest.mock("@/lib/auth-edge", () => ({
  createJWT: jest.fn().mockResolvedValue({
    token: "tok",
    jti: "jti-1",
    expiresAt: new Date(),
  }),
}));

// Pull mocked references AFTER jest.mock() declarations
import { db } from "@/db";
import { verifyOtp } from "@/lib/otp-store";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/login-phone", {
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

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/auth/login-phone", () => {
  describe("input validation", () => {
    it("returns 400 when fields are missing", async () => {
      const res = await POST(makeRequest({ phone: "13800138000" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("required") });
    });

    it("returns 400 for invalid phone format", async () => {
      const res = await POST(makeRequest({ phone: "555", otp: "123456" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("Invalid") });
    });
  });

  describe("OTP verification", () => {
    it("returns 400 when OTP is invalid", async () => {
      (verifyOtp as jest.Mock).mockReturnValue("Invalid or expired code");
      const res = await POST(makeRequest({ phone: "13800138000", otp: "000000" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "Invalid or expired code" });
      expect(verifyOtp).toHaveBeenCalledWith("login:13800138000", "000000");
    });
  });

  describe("user lookup", () => {
    it("returns 404 when user not found", async () => {
      (verifyOtp as jest.Mock).mockReturnValue(true);
      mockSelect([]); // no user
      const res = await POST(makeRequest({ phone: "13800138000", otp: "123456" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("No account") });
    });

    it("returns 403 when user is banned", async () => {
      (verifyOtp as jest.Mock).mockReturnValue(true);
      mockSelect([{ id: "u1", role: "creator", status: "banned" }]);
      const res = await POST(makeRequest({ phone: "13800138000", otp: "123456" }));
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("banned") });
    });
  });

  describe("successful login", () => {
    it("returns 200 and sets auth cookie", async () => {
      (verifyOtp as jest.Mock).mockReturnValue(true);
      mockSelect([{ id: "u1", role: "creator", status: "verified" }]);
      mockInsert(); // session insert

      const res = await POST(makeRequest({ phone: "13800138000", otp: "123456" }));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.message).toBe("Login successful");
      expect(res.cookies.get("auth_token")).toBeTruthy();
    });
  });
});
