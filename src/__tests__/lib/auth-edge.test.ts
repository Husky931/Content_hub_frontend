/**
 * Tests for lib/auth-edge.ts
 * Verifies JWT creation and verification using the real jose library.
 */

import { createJWT, verifyJWT } from "@/lib/auth-edge";

beforeEach(() => {
  jest.clearAllMocks();
});

// ────────────────────────────────────────────────
// createJWT
// ────────────────────────────────────────────────

describe("createJWT", () => {
  it("returns { token, jti, expiresAt } with valid data", async () => {
    const result = await createJWT({ userId: "user-1", role: "creator" });

    expect(typeof result.token).toBe("string");
    expect(result.token.split(".").length).toBe(3);
    expect(typeof result.jti).toBe("string");
    expect(result.jti.length).toBeGreaterThan(0);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("generates unique jti values across calls", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => createJWT({ userId: "u", role: "creator" }))
    );
    const jtis = new Set(results.map((r) => r.jti));
    expect(jtis.size).toBe(10);
  });
});

// ────────────────────────────────────────────────
// verifyJWT
// ────────────────────────────────────────────────

describe("verifyJWT", () => {
  it("returns payload for a valid token", async () => {
    const { token, jti } = await createJWT({ userId: "user-42", role: "admin" });
    const payload = await verifyJWT(token);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe("user-42");
    expect(payload?.role).toBe("admin");
    expect(payload?.jti).toBe(jti);
  });

  it("returns null for an invalid/tampered token", async () => {
    const { token } = await createJWT({ userId: "u1", role: "creator" });
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(await verifyJWT(tampered)).toBeNull();
  });

  it("returns null for a completely invalid string", async () => {
    expect(await verifyJWT("not.a.jwt")).toBeNull();
  });

  it("returns null for an expired token", async () => {
    // Use fake timers so jose sees the advanced clock
    jest.useFakeTimers();

    const { token } = await createJWT({ userId: "u1", role: "creator" });

    // Advance time past the 7-day expiry
    jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

    const payload = await verifyJWT(token);
    expect(payload).toBeNull();

    jest.useRealTimers();
  });
});

// ────────────────────────────────────────────────
// Round-trip: createJWT → verifyJWT
// ────────────────────────────────────────────────

describe("round-trip createJWT → verifyJWT", () => {
  it("returns the same userId and role", async () => {
    const { token } = await createJWT({ userId: "round-trip-user", role: "mod" });
    const payload = await verifyJWT(token);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe("round-trip-user");
    expect(payload?.role).toBe("mod");
  });
});
