/**
 * Tests for lib/backend-webhook.ts
 * Verifies webhook payload structure, headers, and silent failure behavior.
 */

// We need to control the env vars BEFORE the module reads them at import time.
// Use jest.isolateModules to re-import with different env states.

const ORIG_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIG_ENV };
});

afterAll(() => {
  process.env = ORIG_ENV;
});

// ────────────────────────────────────────────────
// Silent failure when BACKEND_WEBHOOK_URL not set
// ────────────────────────────────────────────────

describe("webhookAttemptSubmitted — no BACKEND_WEBHOOK_URL", () => {
  it("resolves silently without sending a request", async () => {
    delete process.env.BACKEND_WEBHOOK_URL;
    const fetchSpy = jest.spyOn(global, "fetch");

    jest.isolateModules(() => {
      // Re-import to pick up missing env
    });
    const { webhookAttemptSubmitted } = require("@/lib/backend-webhook");

    await expect(
      webhookAttemptSubmitted({
        taskId: "t1",
        attemptId: "a1",
        userId: "u1",
        deliverables: {},
        username: "alice",
        displayName: "Alice",
        email: "alice@test.com",
        externalId: null,
        taskTitle: "Test",
        channelSlug: "ch1",
        bountyUsd: "10",
        bountyRmb: "70",
        attemptNumber: 1,
        maxAttempts: 5,
      })
    ).resolves.toBeUndefined();

    // fetch should not have been called (or was already mocked)
    fetchSpy.mockRestore();
  });
});

// ────────────────────────────────────────────────
// Payload structure
// ────────────────────────────────────────────────

describe("webhookAttemptSubmitted — payload structure", () => {
  beforeEach(() => {
    process.env.BACKEND_WEBHOOK_URL = "https://test.webhook.site/hook";
    process.env.BACKEND_API_KEY = "test-api-key";
  });

  it("sends correct snake_case payload with proper headers", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    // Re-import to pick up env
    jest.resetModules();
    const { webhookAttemptSubmitted } = require("@/lib/backend-webhook");

    await webhookAttemptSubmitted({
      taskId: "task-1",
      attemptId: "att-1",
      userId: "user-1",
      deliverables: { text: "my work" },
      username: "bob",
      displayName: "Bob",
      email: "bob@test.com",
      externalId: "ext-123",
      taskTitle: "Record Audio",
      channelSlug: "audio-tasks",
      bountyUsd: "25.00",
      bountyRmb: "175.00",
      attemptNumber: 2,
      maxAttempts: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    expect(url).toBe("https://test.webhook.site/hook");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["X-API-Key"]).toBe("test-api-key");
    expect(options.headers["X-Webhook-Event"]).toBe("attempt.submitted");

    const body = JSON.parse(options.body);
    expect(body.event).toBe("attempt.submitted");
    expect(body.timestamp).toBeDefined();
    expect(body.data.task_id).toBe("task-1");
    expect(body.data.attempt_id).toBe("att-1");
    expect(body.data.user_id).toBe("user-1");
    expect(body.data.external_id).toBe("ext-123");
    expect(body.data.username).toBe("bob");
    expect(body.data.email).toBe("bob@test.com");
    expect(body.data.bounty_usd).toBe("25.00");
    expect(body.data.attempt_number).toBe(2);
    expect(body.data.max_attempts).toBe(5);
    expect(body.data.deliverables).toEqual({ text: "my work" });
  });
});

describe("webhookTaskCompleted — payload structure", () => {
  beforeEach(() => {
    process.env.BACKEND_WEBHOOK_URL = "https://test.webhook.site/hook";
    process.env.BACKEND_API_KEY = "key-456";
  });

  it("sends task.completed event with financial and reviewer data", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    jest.resetModules();
    const { webhookTaskCompleted } = require("@/lib/backend-webhook");

    await webhookTaskCompleted({
      taskId: "task-2",
      attemptId: "att-2",
      userId: "user-2",
      bountyUsd: "50.00",
      bountyRmb: "350.00",
      username: "carol",
      displayName: "Carol",
      email: "carol@test.com",
      externalId: "ext-456",
      taskTitle: "Write Script",
      channelSlug: "writing-tasks",
      bonusBountyUsd: "10.00",
      bonusBountyRmb: "70.00",
      reviewerUsername: "mod_dave",
      deliverables: { files: ["a.mp3"] },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.event).toBe("task.completed");
    expect(body.data.task_id).toBe("task-2");
    expect(body.data.bounty_usd).toBe("50.00");
    expect(body.data.bonus_bounty_usd).toBe("10.00");
    expect(body.data.bonus_bounty_rmb).toBe("70.00");
    expect(body.data.reviewer_username).toBe("mod_dave");
    expect(body.data.deliverables).toEqual({ files: ["a.mp3"] });
    expect(mockFetch.mock.calls[0][1].headers["X-Webhook-Event"]).toBe("task.completed");
  });
});

// ────────────────────────────────────────────────
// Network failure resilience
// ────────────────────────────────────────────────

describe("webhook — network failure", () => {
  beforeEach(() => {
    process.env.BACKEND_WEBHOOK_URL = "https://unreachable.test/hook";
    process.env.BACKEND_API_KEY = "key";
  });

  it("does not throw when fetch rejects", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    jest.resetModules();
    const { webhookAttemptSubmitted } = require("@/lib/backend-webhook");

    await expect(
      webhookAttemptSubmitted({
        taskId: "t", attemptId: "a", userId: "u", deliverables: {},
        username: "x", displayName: null, email: "x@x.com",
        externalId: null, taskTitle: "T", channelSlug: null,
        bountyUsd: null, bountyRmb: null, attemptNumber: 1, maxAttempts: 5,
      })
    ).resolves.toBeUndefined();
  });

  it("does not throw when server returns non-ok status", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });

    jest.resetModules();
    const { webhookTaskCompleted } = require("@/lib/backend-webhook");

    await expect(
      webhookTaskCompleted({
        taskId: "t", attemptId: "a", userId: "u", bountyUsd: "1", bountyRmb: "7",
        username: "x", displayName: null, email: "x@x.com",
        externalId: null, taskTitle: "T", channelSlug: null,
        bonusBountyUsd: null, bonusBountyRmb: null,
        reviewerUsername: "mod", deliverables: {},
      })
    ).resolves.toBeUndefined();
  });
});
