// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@/db", () => ({
  db: { execute: jest.fn() },
}));

import { GET } from "@/app/api/health/route";
import { db } from "@/db";

// ── Helpers ────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 when DB is healthy", async () => {
    (db.execute as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.db).toBe("connected");
  });

  it("returns 503 when DB is down", async () => {
    (db.execute as jest.Mock).mockRejectedValue(new Error("connection refused"));
    const res = await GET();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("error");
    expect(json.db).toBe("disconnected");
  });
});
