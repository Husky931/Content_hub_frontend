import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload/presign/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("@/lib/oss", () => ({
  isOssConfigured: jest.fn(),
  generatePresignedPutUrl: jest.fn(),
}));

import { getAuthFromCookies } from "@/lib/auth";
import { isOssConfigured, generatePresignedPutUrl } from "@/lib/oss";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/upload/presign", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/upload/presign", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeReq({ fileName: "test.jpg", contentType: "image/jpeg", fileSize: 1000 }));
    expect(res.status).toBe(401);
  });

  it("returns 503 when OSS is not configured", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    (isOssConfigured as jest.Mock).mockReturnValue(false);

    const res = await POST(makeReq({ fileName: "test.jpg", contentType: "image/jpeg", fileSize: 1000 }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
  });

  it("returns 400 when required fields are missing", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    (isOssConfigured as jest.Mock).mockReturnValue(true);

    const res = await POST(makeReq({ fileName: "test.jpg" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 for disallowed file type", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    (isOssConfigured as jest.Mock).mockReturnValue(true);

    const res = await POST(makeReq({
      fileName: "malware.exe",
      contentType: "application/x-msdownload",
      fileSize: 1000,
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/not allowed/i);
  });

  it("returns 400 for oversized file (>500MB)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    (isOssConfigured as jest.Mock).mockReturnValue(true);

    const res = await POST(makeReq({
      fileName: "huge.mp4",
      contentType: "video/mp4",
      fileSize: 600 * 1024 * 1024, // 600 MB
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/exceeds maximum/i);
  });

  it("returns presigned URL for valid request", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "user-1", role: "creator" });
    (isOssConfigured as jest.Mock).mockReturnValue(true);
    (generatePresignedPutUrl as jest.Mock).mockReturnValue("https://bucket.oss.com/deliverables/user-1/abc.jpg?signed");

    const res = await POST(makeReq({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      fileSize: 50000,
      context: "attempt-deliverable",
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.presignedUrl).toBeDefined();
    expect(json.objectKey).toMatch(/^deliverables\/user-1\/.+\.jpg$/);
    expect(json.publicUrl).toBeDefined();
  });

  it("uses task-attachments folder for task-attachment context", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "user-1", role: "admin" });
    (isOssConfigured as jest.Mock).mockReturnValue(true);
    (generatePresignedPutUrl as jest.Mock).mockReturnValue("https://signed-url");

    const res = await POST(makeReq({
      fileName: "reference.pdf",
      contentType: "application/pdf",
      fileSize: 10000,
      context: "task-attachment",
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.objectKey).toMatch(/^task-attachments\//);
  });

  it("allows all valid MIME types (images, audio, video, docs)", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    (isOssConfigured as jest.Mock).mockReturnValue(true);
    (generatePresignedPutUrl as jest.Mock).mockReturnValue("https://signed");

    const validTypes = [
      ["test.png", "image/png"],
      ["test.mp3", "audio/mpeg"],
      ["test.mp4", "video/mp4"],
      ["test.pdf", "application/pdf"],
      ["test.wav", "audio/wav"],
      ["test.webm", "video/webm"],
    ];

    for (const [fileName, contentType] of validTypes) {
      const res = await POST(makeReq({ fileName, contentType, fileSize: 1000 }));
      expect(res.status).toBe(200);
    }
  });
});
