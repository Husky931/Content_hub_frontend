import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/auth-edge", () => ({
  verifyJWT: jest.fn(),
}));

import { verifyJWT } from "@/lib/auth-edge";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(pathname: string, opts?: { cookie?: string; method?: string; headers?: Record<string, string> }) {
  const url = new URL(pathname, "http://localhost");
  const headers: Record<string, string> = {};
  if (opts?.headers) {
    Object.assign(headers, opts.headers);
  }
  if (opts?.cookie) {
    headers["cookie"] = `auth_token=${opts.cookie}`;
  }
  return new NextRequest(url, {
    method: opts?.method || "GET",
    headers,
  });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("middleware", () => {
  describe("public routes", () => {
    it("allows /login without auth", async () => {
      const res = await middleware(makeRequest("/login"));
      // NextResponse.next() has no status override (defaults 200)
      expect(res.status).toBe(200);
    });

    it("allows /signup without auth", async () => {
      const res = await middleware(makeRequest("/signup"));
      expect(res.status).toBe(200);
    });

    it("allows /api/auth/login without auth", async () => {
      const res = await middleware(makeRequest("/api/auth/login"));
      expect(res.status).toBe(200);
    });

    it("allows /api/auth/signup without auth", async () => {
      const res = await middleware(makeRequest("/api/auth/signup"));
      expect(res.status).toBe(200);
    });

    it("allows /api/auth/send-otp without auth", async () => {
      const res = await middleware(makeRequest("/api/auth/send-otp"));
      expect(res.status).toBe(200);
    });
  });

  describe("static files", () => {
    it("allows /_next paths", async () => {
      const res = await middleware(makeRequest("/_next/static/chunk.js"));
      expect(res.status).toBe(200);
    });

    it("allows files with extensions", async () => {
      const res = await middleware(makeRequest("/favicon.ico"));
      expect(res.status).toBe(200);
    });
  });

  describe("API key routes", () => {
    it("allows CORS preflight for /api/tasks/sync", async () => {
      const res = await middleware(makeRequest("/api/tasks/sync", { method: "OPTIONS" }));
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });

    it("passes through /api/tasks/sync with X-API-Key", async () => {
      const res = await middleware(makeRequest("/api/tasks/sync", { headers: { "x-api-key": "test-key" } }));
      expect(res.status).toBe(200);
    });

    it("allows CORS preflight for /api/automod/review", async () => {
      const res = await middleware(makeRequest("/api/automod/review", { method: "OPTIONS" }));
      expect(res.status).toBe(204);
    });
  });

  describe("unauthenticated requests", () => {
    it("returns 401 for API routes without token", async () => {
      const res = await middleware(makeRequest("/api/channels"));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/not authenticated/i);
    });

    it("redirects page routes to /login without token", async () => {
      const res = await middleware(makeRequest("/channels"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });
  });

  describe("invalid token", () => {
    it("returns 401 for API routes with invalid token", async () => {
      (verifyJWT as jest.Mock).mockResolvedValue(null);
      const res = await middleware(makeRequest("/api/channels", { cookie: "bad-token" }));
      expect(res.status).toBe(401);
    });

    it("redirects pages with invalid token to login", async () => {
      (verifyJWT as jest.Mock).mockResolvedValue(null);
      const res = await middleware(makeRequest("/channels", { cookie: "bad-token" }));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });
  });

  describe("authenticated requests", () => {
    it("passes through and sets user headers", async () => {
      (verifyJWT as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator", jti: "j1" });
      const res = await middleware(makeRequest("/api/channels", { cookie: "valid-token" }));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-user-id")).toBe("u1");
      expect(res.headers.get("x-user-role")).toBe("creator");
    });
  });

  describe("role-based access", () => {
    it("blocks non-admin from /admin routes with 403 for API", async () => {
      (verifyJWT as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator", jti: "j1" });
      const res = await middleware(makeRequest("/admin/dashboard", { cookie: "valid-token" }));
      // Page routes redirect instead of 403
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/channels");
    });

    it("allows admin to access /admin routes", async () => {
      (verifyJWT as jest.Mock).mockResolvedValue({ userId: "a1", role: "admin", jti: "j1" });
      const res = await middleware(makeRequest("/admin/dashboard", { cookie: "valid-token" }));
      expect(res.status).toBe(200);
    });

    it("blocks creator from /mod routes", async () => {
      (verifyJWT as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator", jti: "j1" });
      const res = await middleware(makeRequest("/mod/panel", { cookie: "valid-token" }));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/channels");
    });

    it("allows mod to access /mod routes", async () => {
      (verifyJWT as jest.Mock).mockResolvedValue({ userId: "m1", role: "mod", jti: "j1" });
      const res = await middleware(makeRequest("/mod/panel", { cookie: "valid-token" }));
      expect(res.status).toBe(200);
    });

    it("allows supermod to access /mod routes", async () => {
      (verifyJWT as jest.Mock).mockResolvedValue({ userId: "s1", role: "supermod", jti: "j1" });
      const res = await middleware(makeRequest("/mod/panel", { cookie: "valid-token" }));
      expect(res.status).toBe(200);
    });
  });
});
