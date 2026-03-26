import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/send-login-otp/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/db", () => ({ db: { select: jest.fn() } }));
jest.mock("@/lib/otp-store", () => ({
  generateOtp: jest.fn(),
  storeOtp: jest.fn(),
}));
jest.mock("@/lib/sms", () => ({ sendSmsCode: jest.fn() }));

// Pull mocked references AFTER jest.mock() declarations
import { db } from "@/db";
import { generateOtp, storeOtp } from "@/lib/otp-store";
import { sendSmsCode } from "@/lib/sms";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/send-login-otp", {
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

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/auth/send-login-otp", () => {
  describe("input validation", () => {
    it("returns 400 when phone is missing", async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("required") });
    });

    it("returns 400 for invalid phone format", async () => {
      const res = await POST(makeRequest({ phone: "abc" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("Invalid") });
    });
  });

  describe("privacy-safe responses", () => {
    it("returns 200 even when user not found", async () => {
      mockSelect([]); // no user
      const res = await POST(makeRequest({ phone: "13900139000" }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toMatch(/registered/i);
      // SMS should NOT have been called
      expect(sendSmsCode).not.toHaveBeenCalled();
    });

    it("returns 200 even when user is banned", async () => {
      mockSelect([{ id: "u1", status: "banned" }]);
      const res = await POST(makeRequest({ phone: "13900139000" }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toMatch(/registered/i);
      expect(sendSmsCode).not.toHaveBeenCalled();
    });
  });

  describe("OTP and SMS", () => {
    it("returns 429 when rate limited", async () => {
      mockSelect([{ id: "u1", status: "verified" }]);
      (generateOtp as jest.Mock).mockReturnValue("123456");
      (storeOtp as jest.Mock).mockReturnValue("Too many requests. Please wait 60 seconds.");

      const res = await POST(makeRequest({ phone: "13800138000" }));
      expect(res.status).toBe(429);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("wait") });
    });

    it("returns 200 on success with registered user", async () => {
      mockSelect([{ id: "u1", status: "verified" }]);
      (generateOtp as jest.Mock).mockReturnValue("654321");
      (storeOtp as jest.Mock).mockReturnValue(null);
      (sendSmsCode as jest.Mock).mockResolvedValue({ success: true });

      const res = await POST(makeRequest({ phone: "13800138000" }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toMatch(/registered/i);
      expect(storeOtp).toHaveBeenCalledWith("login:13800138000", "654321");
      expect(sendSmsCode).toHaveBeenCalledWith("13800138000", "654321");
    });
  });
});
