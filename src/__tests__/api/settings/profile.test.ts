import { NextRequest } from "next/server";
import { PUT } from "@/app/api/settings/profile/route";

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { update: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getAuthFromCookies: jest.fn(),
}));

import { db } from "@/db";
import { getAuthFromCookies } from "@/lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/settings/profile", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockUpdateReturning(rows: any[]) {
  const returningMock = jest.fn().mockResolvedValue(rows);
  const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  (db.update as jest.Mock).mockReturnValueOnce({ set: setMock });
}

const baseUser = {
  id: "u1",
  email: "test@test.com",
  username: "testuser",
  role: "creator",
  status: "verified",
  currency: "usd",
  displayName: null,
  avatarUrl: null,
  bio: null,
  onboardingCompleted: true,
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PUT /api/settings/profile", () => {
  it("returns 401 when not authenticated", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue(null);
    const res = await PUT(makeReq({ displayName: "New Name" }));
    expect(res.status).toBe(401);
  });

  it("updates display name and bio", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockUpdateReturning([{ ...baseUser, displayName: "New Name", bio: "My bio" }]);

    const res = await PUT(makeReq({ displayName: "New Name", bio: "My bio" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.displayName).toBe("New Name");
    expect(json.user.bio).toBe("My bio");
  });

  it("trims whitespace from display name and bio", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockUpdateReturning([{ ...baseUser, displayName: "Trimmed", bio: "Clean" }]);

    const res = await PUT(makeReq({ displayName: "  Trimmed  ", bio: "  Clean  " }));
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });

  it("sets null when display name is empty", async () => {
    (getAuthFromCookies as jest.Mock).mockResolvedValue({ userId: "u1", role: "creator" });
    mockUpdateReturning([{ ...baseUser, displayName: null, bio: null }]);

    const res = await PUT(makeReq({ displayName: "", bio: "" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.displayName).toBeNull();
  });
});
