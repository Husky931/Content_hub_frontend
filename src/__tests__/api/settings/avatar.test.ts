import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/settings/avatar/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));
jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockSelect(rows: any[]) {
  const limitMock = jest.fn().mockResolvedValue(rows);
  const whereResult = Object.assign(Promise.resolve(rows), { limit: limitMock });
  const whereMock = jest.fn().mockReturnValue(whereResult);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock, limit: limitMock });
  (db.select as jest.Mock).mockReturnValueOnce({ from: fromMock });
}

function mockUpdate(returned: any[] = []) {
  const returningMock = jest.fn().mockResolvedValue(returned);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

function makeFileRequest(fileName: string, type: string, size: number) {
  const content = new Uint8Array(size);
  const file = new File([content], fileName, { type });
  const formData = new FormData();
  formData.set("avatar", file);
  return new NextRequest("http://localhost/api/settings/avatar", {
    method: "POST",
    body: formData,
  });
}

const updatedUser = {
  id: "u1",
  email: "test@test.com",
  username: "testuser",
  role: "creator",
  status: "verified",
  currency: "usd",
  displayName: "Test",
  avatarUrl: "/uploads/avatars/u1.png",
  bio: null,
  onboardingCompleted: true,
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

// ── POST (Upload) Tests ────────────────────────────────────────────────────

describe("POST /api/settings/avatar", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const req = makeFileRequest("test.png", "image/png", 100);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const formData = new FormData();
    const req = new NextRequest("http://localhost/api/settings/avatar", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/no file/i);
  });

  it("returns 400 for invalid file type", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const req = makeFileRequest("test.gif", "image/gif", 100);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/png.*jpg/i);
  });

  it("returns 400 when file exceeds 2MB", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    const req = makeFileRequest("big.png", "image/png", 3 * 1024 * 1024);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/2 MB/i);
  });

  it("uploads PNG avatar successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockUpdate([updatedUser]);

    const req = makeFileRequest("avatar.png", "image/png", 500);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.avatarUrl).toMatch(/u1\.png/);
  });
});

// ── DELETE Tests ────────────────────────────────────────────────────────────

describe("DELETE /api/settings/avatar", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/settings/avatar", { method: "DELETE" });
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("deletes avatar successfully", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([{ avatarUrl: "/uploads/avatars/u1.png" }]); // current user
    mockUpdate(); // set avatarUrl null

    const res = await DELETE();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("succeeds even if no avatar exists", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockSelect([{ avatarUrl: null }]); // no avatar
    mockUpdate();

    const res = await DELETE();
    expect(res.status).toBe(200);
  });
});
