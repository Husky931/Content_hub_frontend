/**
 * Tests for lib/sms.ts
 * Verifies SMS sending via Aliyun SDK with mocked dependencies.
 */

jest.mock("@alicloud/dysmsapi20170525", () => {
  const sendSmsWithOptions = jest.fn();
  const MockClient = jest.fn().mockImplementation(() => ({ sendSmsWithOptions }));
  (MockClient as any).SendSmsRequest = jest.fn().mockImplementation((args: any) => args);
  return { __esModule: true, default: MockClient, SendSmsRequest: (MockClient as any).SendSmsRequest };
});
jest.mock("@alicloud/openapi-client", () => ({ Config: jest.fn() }));
jest.mock("@alicloud/tea-util", () => ({ RuntimeOptions: jest.fn() }));

const ORIG_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  process.env = {
    ...ORIG_ENV,
    SMS_ACCESS_KEY_ID: "test-key-id",
    SMS_ACCESS_KEY_SECRET: "test-key-secret",
  };
});

afterAll(() => {
  process.env = ORIG_ENV;
});

// ────────────────────────────────────────────────
// sendSmsCode
// ────────────────────────────────────────────────

describe("sendSmsCode", () => {
  it("returns { success: true } when Aliyun returns code OK", async () => {
    const DysmsapiMod = require("@alicloud/dysmsapi20170525");
    const MockClient = DysmsapiMod.default;
    const instance = MockClient.mock.results[0]?.value ?? { sendSmsWithOptions: jest.fn() };
    // Force fresh module load
    const { sendSmsCode } = require("@/lib/sms");

    // Get the client instance that was created
    const clientInstance = MockClient.mock.results[MockClient.mock.results.length - 1]?.value;
    if (clientInstance) {
      clientInstance.sendSmsWithOptions.mockResolvedValue({
        body: { code: "OK", bizId: "biz-123", message: "OK" },
      });
    } else {
      // The client is lazily created, so mock the prototype
      MockClient.mockImplementation(() => ({
        sendSmsWithOptions: jest.fn().mockResolvedValue({
          body: { code: "OK", bizId: "biz-123", message: "OK" },
        }),
      }));
    }

    // Re-import to pick up fresh client
    jest.resetModules();
    const freshSms = require("@/lib/sms");
    const freshDysmsapi = require("@alicloud/dysmsapi20170525");
    freshDysmsapi.default.mockImplementation(() => ({
      sendSmsWithOptions: jest.fn().mockResolvedValue({
        body: { code: "OK", bizId: "biz-123", message: "OK" },
      }),
    }));

    const result = await freshSms.sendSmsCode("13800138000", "123456");
    expect(result.success).toBe(true);
  });

  it("returns { success: false } when Aliyun returns non-OK code", async () => {
    jest.resetModules();
    const DysmsapiMod = require("@alicloud/dysmsapi20170525");
    DysmsapiMod.default.mockImplementation(() => ({
      sendSmsWithOptions: jest.fn().mockResolvedValue({
        body: { code: "isv.BUSINESS_LIMIT_CONTROL", message: "Frequency limit" },
      }),
    }));

    const { sendSmsCode } = require("@/lib/sms");
    const result = await sendSmsCode("13800138000", "123456");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Frequency limit/);
  });

  it("returns { success: false } when SDK throws", async () => {
    jest.resetModules();
    const DysmsapiMod = require("@alicloud/dysmsapi20170525");
    DysmsapiMod.default.mockImplementation(() => ({
      sendSmsWithOptions: jest.fn().mockRejectedValue(new Error("Network error")),
    }));

    const { sendSmsCode } = require("@/lib/sms");
    const result = await sendSmsCode("13800138000", "123456");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Network error/);
  });

  it("throws when credentials are missing", async () => {
    delete process.env.SMS_ACCESS_KEY_ID;
    delete process.env.SMS_ACCESS_KEY_SECRET;
    jest.resetModules();

    const { sendSmsCode } = require("@/lib/sms");

    // sendSmsCode catches errors, but getClient throws for missing creds
    // The try/catch in sendSmsCode should catch it and return success: false
    const result = await sendSmsCode("13800138000", "123456");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/missing/i);
  });
});
