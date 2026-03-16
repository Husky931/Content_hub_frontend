/**
 * Tests for lib/email.ts
 * Verifies email sending, verification email construction, and graceful failure.
 */

jest.mock("resend", () => {
  const mockSend = jest.fn();
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
    __mockSend: mockSend,
  };
});

const ORIG_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIG_ENV,
    RESEND_API_KEY: "re_test_key",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  };
});

afterAll(() => {
  process.env = ORIG_ENV;
});

// ────────────────────────────────────────────────
// sendEmail
// ────────────────────────────────────────────────

describe("sendEmail", () => {
  it("returns success:false when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    jest.resetModules();
    const { sendEmail } = require("@/lib/email");

    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });

  it("calls Resend API with correct parameters", async () => {
    jest.resetModules();
    const { sendEmail } = require("@/lib/email");
    // Access the mock send function
    const { __mockSend } = require("resend");
    __mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

    const result = await sendEmail({
      to: "alice@example.com",
      subject: "Welcome",
      html: "<h1>Welcome Alice</h1>",
    });

    expect(result.success).toBe(true);
    expect(__mockSend).toHaveBeenCalledWith({
      from: expect.stringContaining("Content Creator Hub"),
      to: ["alice@example.com"],
      subject: "Welcome",
      html: "<h1>Welcome Alice</h1>",
    });
  });

  it("returns error when Resend API fails", async () => {
    jest.resetModules();
    const { sendEmail } = require("@/lib/email");
    const { __mockSend } = require("resend");
    __mockSend.mockResolvedValue({ data: null, error: { message: "Rate limited" } });

    const result = await sendEmail({
      to: "bob@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Rate limited");
  });
});

// ────────────────────────────────────────────────
// sendVerificationEmail
// ────────────────────────────────────────────────

describe("sendVerificationEmail", () => {
  it("sends email with correct verification URL", async () => {
    jest.resetModules();
    const { sendVerificationEmail } = require("@/lib/email");
    const { __mockSend } = require("resend");
    __mockSend.mockResolvedValue({ data: { id: "email-2" }, error: null });

    const result = await sendVerificationEmail("newuser@example.com", "my-token-abc");

    expect(result.success).toBe(true);
    expect(__mockSend).toHaveBeenCalledTimes(1);

    const callArgs = __mockSend.mock.calls[0][0];
    expect(callArgs.to).toEqual(["newuser@example.com"]);
    expect(callArgs.subject).toMatch(/verify/i);
    expect(callArgs.html).toContain("http://localhost:3000/api/auth/verify?token=my-token-abc");
    expect(callArgs.html).toContain("Verify Email");
  });

  it("includes app URL from NEXT_PUBLIC_APP_URL env var", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://myapp.vercel.app";
    jest.resetModules();
    const { sendVerificationEmail } = require("@/lib/email");
    const { __mockSend } = require("resend");
    __mockSend.mockResolvedValue({ data: { id: "email-3" }, error: null });

    await sendVerificationEmail("user@test.com", "token-xyz");

    const html = __mockSend.mock.calls[0][0].html;
    expect(html).toContain("https://myapp.vercel.app/api/auth/verify?token=token-xyz");
  });
});
