import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload/local/route";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(file?: { name: string; type: string; size: number; content?: string }, context?: string) {
  const formData = new FormData();
  if (file) {
    const blob = new Blob([file.content || "test file content"], { type: file.type });
    const f = new File([blob], file.name, { type: file.type });
    // Override size for testing (File.size is read-only, so we use the real blob size)
    formData.append("file", f);
  }
  if (context) {
    formData.append("context", context);
  }

  return new NextRequest("http://localhost/api/upload/local", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/upload/local", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeReq({ name: "test.jpg", type: "image/jpeg", size: 1000 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file is provided", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    // Send request without file
    const req = new NextRequest("http://localhost/api/upload/local", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/no file/i);
  });

  it("uploads file successfully and returns correct metadata", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });

    const res = await POST(makeReq({
      name: "photo.jpg",
      type: "image/jpeg",
      size: 5000,
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(/^\/uploads\/deliverables\/.+\.jpg$/);
    expect(json.name).toBe("photo.jpg");
    expect(json.type).toBe("image/jpeg");
    expect(json.size).toBeDefined();
  });

  it("uses task-attachments folder when context is task-attachment", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "admin" });

    const res = await POST(makeReq(
      { name: "ref.pdf", type: "application/pdf", size: 3000 },
      "task-attachment"
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(/^\/uploads\/task-attachments\//);
  });

  it("defaults to deliverables folder when no context specified", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });

    const res = await POST(makeReq({ name: "work.mp3", type: "audio/mpeg", size: 2000 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(/^\/uploads\/deliverables\//);
  });
});
