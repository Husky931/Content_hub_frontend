/**
 * Tests for lib/ws-publish.ts
 * Verifies room construction, event names, silent failure, and timeout.
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

import {
  wsPublish,
  publishMessage,
  publishSystemMessage,
  publishTaskUpdate,
  publishNotification,
  publishWalletUpdate,
} from "@/lib/ws-publish";

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true });
});

// ────────────────────────────────────────────────
// wsPublish
// ────────────────────────────────────────────────

describe("wsPublish", () => {
  it("sends POST to WS server /emit with correct body and headers", async () => {
    await wsPublish({ room: "channel:general", event: "message:new", data: { id: "m1" } });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    expect(url).toBe("http://localhost:3001/emit");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["X-API-Key"]).toBeDefined();

    const body = JSON.parse(options.body);
    expect(body.room).toBe("channel:general");
    expect(body.event).toBe("message:new");
    expect(body.data).toEqual({ id: "m1" });
  });

  it("does not throw when fetch rejects (WS server down)", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(
      wsPublish({ room: "channel:test", event: "test", data: {} })
    ).resolves.toBeUndefined();
  });

  it("does not throw when server returns non-ok status", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(
      wsPublish({ room: "channel:test", event: "test", data: {} })
    ).resolves.toBeUndefined();
  });

  it("includes AbortSignal with timeout", async () => {
    await wsPublish({ room: "r", event: "e", data: {} });
    const options = mockFetch.mock.calls[0][1];
    expect(options.signal).toBeDefined();
  });
});

// ────────────────────────────────────────────────
// Convenience helpers — room and event mapping
// ────────────────────────────────────────────────

describe("publishMessage", () => {
  it("publishes to channel room with message:new event", async () => {
    await publishMessage("general", { id: "m1", content: "hello" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.room).toBe("channel:general");
    expect(body.event).toBe("message:new");
    expect(body.data).toEqual({ id: "m1", content: "hello" });
  });
});

describe("publishSystemMessage", () => {
  it("publishes to channel room with message:system event", async () => {
    await publishSystemMessage("audio-tasks", { id: "s1", type: "system" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.room).toBe("channel:audio-tasks");
    expect(body.event).toBe("message:system");
  });
});

describe("publishTaskUpdate", () => {
  it("publishes to channel room with task:updated event", async () => {
    await publishTaskUpdate("writing-tasks", { id: "t1", status: "active" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.room).toBe("channel:writing-tasks");
    expect(body.event).toBe("task:updated");
    expect(body.data.status).toBe("active");
  });
});

describe("publishNotification", () => {
  it("publishes to user room with notification:new event", async () => {
    await publishNotification("user-123", { type: "task_approved", title: "Approved!" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.room).toBe("user:user-123");
    expect(body.event).toBe("notification:new");
    expect(body.data.type).toBe("task_approved");
  });
});

describe("publishWalletUpdate", () => {
  it("publishes to user room with wallet:updated event", async () => {
    await publishWalletUpdate("user-456", { balanceUsd: "100.00" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.room).toBe("user:user-456");
    expect(body.event).toBe("wallet:updated");
    expect(body.data.balanceUsd).toBe("100.00");
  });
});
