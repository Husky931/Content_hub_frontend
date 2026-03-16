import { NextRequest } from "next/server";
import { GET } from "@/app/api/upload/signed-url/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("@/lib/oss", () => ({
  isOssConfigured: jest.fn(),
  getObjectKeyFromUrl: jest.fn(),
  generatePresignedGetUrl: jest.fn(),
}));

import { getAuthFromCookies } from "@/lib/auth";
import { isOssConfigured, getObjectKeyFromUrl, generatePresignedGetUrl } from "@/lib/oss";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(url?: string) {
  const base = "http://localhost/api/upload/signed-url";
  const fullUrl = url ? `${base}?url=${encodeURIComponent(url)}` : base;
  return new NextRequest(fullUrl, { method: "GET" });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/upload/signed-url", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await GET(makeReq("https://bucket.oss.com/file.jpg"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when url parameter is missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/url.*required/i);
  });

  it("returns local URLs as-is without signing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const res = await GET(makeReq("/uploads/deliverables/abc.jpg"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signedUrl).toBe("/uploads/deliverables/abc.jpg");
  });

  it("returns 503 when OSS is not configured for remote URLs", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    (isOssConfigured as jest.Mock).mockReturnValue(false);
    const res = await GET(makeReq("https://bucket.oss.com/file.jpg"));
    expect(res.status).toBe(503);
  });

  it("returns 400 for invalid OSS URL", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    (isOssConfigured as jest.Mock).mockReturnValue(true);
    (getObjectKeyFromUrl as jest.Mock).mockReturnValue(null);

    const res = await GET(makeReq("https://bucket.oss.com/file.jpg"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it("returns signed URL for valid OSS file", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    (isOssConfigured as jest.Mock).mockReturnValue(true);
    (getObjectKeyFromUrl as jest.Mock).mockReturnValue("deliverables/u1/abc.jpg");
    (generatePresignedGetUrl as jest.Mock).mockReturnValue("https://bucket.oss.com/deliverables/u1/abc.jpg?signed=true");

    const res = await GET(makeReq("https://bucket.oss.com/deliverables/u1/abc.jpg"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signedUrl).toContain("signed=true");
    expect(generatePresignedGetUrl).toHaveBeenCalledWith("deliverables/u1/abc.jpg", 3600);
  });
});
