/**
 * Tests for lib/otp-store.ts
 * Verifies OTP generation, storage, rate-limiting, verification, and expiry.
 */

import { generateOtp, storeOtp, verifyOtp } from "@/lib/otp-store";

beforeEach(() => {
  jest.clearAllMocks();
});

// ────────────────────────────────────────────────
// generateOtp
// ────────────────────────────────────────────────

describe("generateOtp", () => {
  it("returns a 6-digit string", () => {
    const otp = generateOtp();
    expect(typeof otp).toBe("string");
    expect(otp).toMatch(/^\d{6}$/);
  });
});

// ────────────────────────────────────────────────
// storeOtp
// ────────────────────────────────────────────────

describe("storeOtp", () => {
  it("returns null on success (first call)", () => {
    const phone = "+8613000000001";
    const result = storeOtp(phone, "123456");
    expect(result).toBeNull();
  });

  it("returns rate-limit error string on second call within 60s", () => {
    const phone = "+8613000000002";
    storeOtp(phone, "111111");
    const result = storeOtp(phone, "222222");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/wait/i);
  });
});

// ────────────────────────────────────────────────
// verifyOtp
// ────────────────────────────────────────────────

describe("verifyOtp", () => {
  it("returns true for correct code", () => {
    const phone = "+8613000000010";
    storeOtp(phone, "654321");
    expect(verifyOtp(phone, "654321")).toBe(true);
  });

  it("returns error string for wrong code", () => {
    const phone = "+8613000000011";
    storeOtp(phone, "654321");
    const result = verifyOtp(phone, "000000");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/incorrect/i);
  });

  it("returns error string when no code stored", () => {
    const result = verifyOtp("+8613000099999", "123456");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/no verification code/i);
  });

  it("consumes OTP after success (second verify fails)", () => {
    const phone = "+8613000000012";
    storeOtp(phone, "111222");
    expect(verifyOtp(phone, "111222")).toBe(true);

    const second = verifyOtp(phone, "111222");
    expect(typeof second).toBe("string");
    expect(second).toMatch(/no verification code/i);
  });

  it("returns error after 5 wrong attempts (brute-force protection)", () => {
    const phone = "+8613000000013";
    storeOtp(phone, "999888");

    for (let i = 0; i < 5; i++) {
      verifyOtp(phone, "000000");
    }

    const result = verifyOtp(phone, "999888");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/too many/i);
  });

  it("returns expired error after TTL (5+ minutes)", () => {
    jest.useFakeTimers();
    const phone = "+8613000000014";
    storeOtp(phone, "445566");

    // Advance time by 6 minutes (past the 5-minute TTL)
    jest.advanceTimersByTime(6 * 60 * 1000);

    const result = verifyOtp(phone, "445566");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/expired/i);

    jest.useRealTimers();
  });
});
