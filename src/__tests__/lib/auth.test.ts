import {
  hashPassword,
  verifyPassword,
  createJWT,
  verifyJWT,
  generateVerificationToken,
  generateInviteCode,
  getAuthFromCookies,
} from "@/lib/auth";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

// ────────────────────────────────────────────────
// hashPassword / verifyPassword
// ────────────────────────────────────────────────

describe("hashPassword / verifyPassword", () => {
  it("hashes a password and verifies it correctly", () => {
    const password = "mysecretpassword";
    const hash = hashPassword(password);
    expect(hash).not.toBe(password);
    expect(verifyPassword(password, hash)).toBe(true);
  });

  it("returns false for an incorrect password", () => {
    const hash = hashPassword("correctpassword");
    expect(verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("produces different hashes each time (random salt)", () => {
    const hash1 = hashPassword("samepassword");
    const hash2 = hashPassword("samepassword");
    expect(hash1).not.toBe(hash2);
  });
});

// ────────────────────────────────────────────────
// createJWT / verifyJWT
// ────────────────────────────────────────────────

describe("createJWT / verifyJWT", () => {
  it("creates a valid JWT with the correct payload", async () => {
    const { token, jti, expiresAt } = await createJWT({
      userId: "user-123",
      role: "creator",
    });

    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // header.payload.signature
    expect(typeof jti).toBe("string");
    expect(jti.length).toBeGreaterThan(0);
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("verifies a valid token and returns the correct payload", async () => {
    const { token, jti } = await createJWT({ userId: "user-42", role: "admin" });
    const payload = await verifyJWT(token);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe("user-42");
    expect(payload?.role).toBe("admin");
    expect(payload?.jti).toBe(jti);
  });

  it("returns null for a tampered token", async () => {
    const { token } = await createJWT({ userId: "u1", role: "creator" });
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(await verifyJWT(tampered)).toBeNull();
  });

  it("returns null for a completely invalid token", async () => {
    expect(await verifyJWT("not.a.jwt")).toBeNull();
  });

  it("returns null for an empty string", async () => {
    expect(await verifyJWT("")).toBeNull();
  });

  it("sets expiry ~7 days in the future", async () => {
    const before = Date.now();
    const { expiresAt } = await createJWT({ userId: "u", role: "creator" });
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const after = Date.now();

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });
});

// ────────────────────────────────────────────────
// generateVerificationToken
// ────────────────────────────────────────────────

describe("generateVerificationToken", () => {
  it("returns a non-empty string", () => {
    const token = generateVerificationToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("contains two UUID segments joined by a dash", () => {
    const token = generateVerificationToken();
    // Two UUIDs (each: 8-4-4-4-12) joined by '-' → 9 internal dashes + 1 joining dash = pattern
    // Simplest check: matches hex chars and dashes, and is long enough
    expect(token).toMatch(/^[0-9a-f-]+-[0-9a-f-]+$/i);
    // Length of two UUIDs + separator: 36 + 1 + 36 = 73
    expect(token.length).toBe(73);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 20 }, generateVerificationToken));
    expect(tokens.size).toBe(20);
  });
});

// ────────────────────────────────────────────────
// generateInviteCode
// ────────────────────────────────────────────────

describe("generateInviteCode", () => {
  it("returns a code matching INV-XXXX-XXXX format", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^INV-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("does not include visually ambiguous characters (I, O, 0, 1)", () => {
    for (let i = 0; i < 100; i++) {
      const charPart = generateInviteCode().replace(/^INV-|-/g, "");
      expect(charPart).not.toMatch(/[IO01]/);
    }
  });

  it("generates unique codes (statistically)", () => {
    const codes = new Set(Array.from({ length: 200 }, generateInviteCode));
    expect(codes.size).toBeGreaterThan(190);
  });
});

// ────────────────────────────────────────────────
// getAuthFromCookies
// ────────────────────────────────────────────────

describe("getAuthFromCookies", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { cookies } = require("next/headers") as { cookies: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when auth_token cookie is absent", async () => {
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue(undefined) });
    expect(await getAuthFromCookies()).toBeNull();
  });

  it("returns null when the token is invalid", async () => {
    cookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "bad-token" }),
    });
    expect(await getAuthFromCookies()).toBeNull();
  });

  it("returns the JWT payload for a valid token", async () => {
    const { token } = await createJWT({ userId: "abc", role: "mod" });
    cookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: token }),
    });
    const result = await getAuthFromCookies();
    expect(result?.userId).toBe("abc");
    expect(result?.role).toBe("mod");
  });
});
