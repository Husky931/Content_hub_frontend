import { GET } from "@/app/api/auth/ws-token/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

import { cookies } from "next/headers";

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/auth/ws-token", () => {
  it("returns 401 when auth_token cookie is missing", async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue(undefined),
    });
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/not authenticated/i);
  });

  it("returns the token when auth_token cookie exists", async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "jwt-token-here" }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.token).toBe("jwt-token-here");
  });

  it("does not expose any additional data beyond the token", async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "my-secret-jwt" }),
    });
    const res = await GET();
    const json = await res.json();
    const keys = Object.keys(json);
    expect(keys).toEqual(["token"]);
  });
});
