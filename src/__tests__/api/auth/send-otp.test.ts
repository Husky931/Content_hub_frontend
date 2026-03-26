import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/send-otp/route";

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
  return new NextRequest("http://localhost/api/auth/send-otp", {
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

describe("POST /api/auth/send-otp", () => {
  describe("input validation", () => {
    it("returns 400 when phone is missing", async () => {
      const res = await POST(makeRequest({ inviteCode: "ABC123" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("required") });
    });

    it("returns 400 when inviteCode is missing", async () => {
      const res = await POST(makeRequest({ phone: "13800138000" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("required") });
    });

    it("returns 400 for invalid phone format", async () => {
      const res = await POST(makeRequest({ phone: "12345", inviteCode: "ABC123" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("Invalid") });
    });
  });

  describe("invite code validation", () => {
    it("returns 400 when invite code not found", async () => {
      mockSelect([]); // no code found
      const res = await POST(makeRequest({ phone: "13800138000", inviteCode: "BADCODE" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("Invalid") });
    });

    it("returns 400 when invite code usage limit exceeded", async () => {
      mockSelect([{ id: "c1", code: "ABC123", status: "active", useCount: 5, maxUses: 5, expiresAt: null }]);
      const res = await POST(makeRequest({ phone: "13800138000", inviteCode: "ABC123" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("usage limit") });
    });

    it("returns 400 when invite code expired", async () => {
      const pastDate = new Date("2020-01-01");
      mockSelect([{ id: "c1", code: "ABC123", status: "active", useCount: 0, maxUses: 10, expiresAt: pastDate }]);
      const res = await POST(makeRequest({ phone: "13800138000", inviteCode: "ABC123" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("expired") });
    });
  });

  describe("OTP and SMS", () => {
    const validCode = { id: "c1", code: "ABC123", status: "active", useCount: 0, maxUses: 10, expiresAt: null };

    it("returns 429 when rate limited", async () => {
      mockSelect([validCode]);
      (generateOtp as jest.Mock).mockReturnValue("123456");
      (storeOtp as jest.Mock).mockReturnValue("Too many requests. Please wait 60 seconds.");

      const res = await POST(makeRequest({ phone: "13800138000", inviteCode: "ABC123" }));
      expect(res.status).toBe(429);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("wait") });
    });

    it("returns 502 when SMS fails", async () => {
      mockSelect([validCode]);
      (generateOtp as jest.Mock).mockReturnValue("123456");
      (storeOtp as jest.Mock).mockReturnValue(null);
      (sendSmsCode as jest.Mock).mockResolvedValue({ success: false, message: "gateway error" });

      const res = await POST(makeRequest({ phone: "13800138000", inviteCode: "ABC123" }));
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("Failed") });
    });

    it("returns 200 on success", async () => {
      mockSelect([validCode]);
      (generateOtp as jest.Mock).mockReturnValue("654321");
      (storeOtp as jest.Mock).mockReturnValue(null);
      (sendSmsCode as jest.Mock).mockResolvedValue({ success: true });

      const res = await POST(makeRequest({ phone: "+86 138 0013 8000", inviteCode: "abc123" }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("Verification code sent");
      expect(storeOtp).toHaveBeenCalledWith("13800138000", "654321");
      expect(sendSmsCode).toHaveBeenCalledWith("13800138000", "654321");
    });
  });
});
