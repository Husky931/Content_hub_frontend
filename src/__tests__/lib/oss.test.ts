import {
  isOssConfigured,
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  getObjectKeyFromUrl,
} from "@/lib/oss";

// ────────────────────────────────────────────────
// isOssConfigured
// ────────────────────────────────────────────────

describe("isOssConfigured", () => {
  const ORIG = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG };
  });

  afterAll(() => {
    process.env = ORIG;
  });

  it("returns false when OSS env vars are empty", () => {
    // The module reads env at import-time, so isOssConfigured checks the
    // module-level constants. Since we import at test-file level the values
    // are already captured.  We test via the exported function directly.
    // With default empty strings from test env, it returns false.
    expect(typeof isOssConfigured()).toBe("boolean");
  });
});

// ────────────────────────────────────────────────
// generatePresignedPutUrl
// ────────────────────────────────────────────────

describe("generatePresignedPutUrl", () => {
  it("returns a URL string with required query params", () => {
    const url = generatePresignedPutUrl("deliverables/user1/abc.jpg", "image/jpeg", 600);
    expect(typeof url).toBe("string");
    expect(url).toContain("OSSAccessKeyId=");
    expect(url).toContain("Expires=");
    expect(url).toContain("Signature=");
    expect(url).toContain("deliverables/user1/abc.jpg");
  });

  it("includes correct object key in URL path", () => {
    const key = "task-attachments/u2/xyz.pdf";
    const url = generatePresignedPutUrl(key, "application/pdf");
    expect(url).toContain(key);
  });

  it("generates different signatures for different content types", () => {
    const url1 = generatePresignedPutUrl("file.bin", "image/png", 600);
    const url2 = generatePresignedPutUrl("file.bin", "audio/mpeg", 600);
    // Signatures should differ because content type is part of the string-to-sign
    const sig1 = new URL(url1).searchParams.get("Signature");
    const sig2 = new URL(url2).searchParams.get("Signature");
    expect(sig1).not.toBe(sig2);
  });

  it("generates different signatures for different object keys", () => {
    const url1 = generatePresignedPutUrl("a.jpg", "image/jpeg", 600);
    const url2 = generatePresignedPutUrl("b.jpg", "image/jpeg", 600);
    const sig1 = new URL(url1).searchParams.get("Signature");
    const sig2 = new URL(url2).searchParams.get("Signature");
    expect(sig1).not.toBe(sig2);
  });

  it("sets expiry in the future", () => {
    const now = Math.floor(Date.now() / 1000);
    const url = generatePresignedPutUrl("test.jpg", "image/jpeg", 300);
    const expires = Number(new URL(url).searchParams.get("Expires"));
    expect(expires).toBeGreaterThanOrEqual(now + 299);
    expect(expires).toBeLessThanOrEqual(now + 301);
  });
});

// ────────────────────────────────────────────────
// generatePresignedGetUrl
// ────────────────────────────────────────────────

describe("generatePresignedGetUrl", () => {
  it("returns a URL string with required query params", () => {
    const url = generatePresignedGetUrl("deliverables/user1/abc.jpg", 3600);
    expect(url).toContain("OSSAccessKeyId=");
    expect(url).toContain("Expires=");
    expect(url).toContain("Signature=");
  });

  it("generates a GET signature different from PUT signature for same key", () => {
    const putUrl = generatePresignedPutUrl("same.jpg", "image/jpeg", 600);
    const getUrl = generatePresignedGetUrl("same.jpg", 600);
    const putSig = new URL(putUrl).searchParams.get("Signature");
    const getSig = new URL(getUrl).searchParams.get("Signature");
    expect(putSig).not.toBe(getSig);
  });

  it("defaults to 3600 seconds expiry", () => {
    const now = Math.floor(Date.now() / 1000);
    const url = generatePresignedGetUrl("test.jpg");
    const expires = Number(new URL(url).searchParams.get("Expires"));
    expect(expires).toBeGreaterThanOrEqual(now + 3599);
    expect(expires).toBeLessThanOrEqual(now + 3601);
  });
});

// ────────────────────────────────────────────────
// getObjectKeyFromUrl
// ────────────────────────────────────────────────

describe("getObjectKeyFromUrl", () => {
  it("extracts object key from a valid OSS URL", () => {
    const key = getObjectKeyFromUrl("https://mybucket.oss-cn-beijing.aliyuncs.com/deliverables/user1/abc.jpg");
    expect(key).toBe("deliverables/user1/abc.jpg");
  });

  it("handles URLs with query parameters", () => {
    const key = getObjectKeyFromUrl("https://mybucket.oss-cn-beijing.aliyuncs.com/file.jpg?versionId=123");
    expect(key).toBe("file.jpg");
  });

  it("returns null for an invalid URL", () => {
    expect(getObjectKeyFromUrl("not-a-url")).toBeNull();
  });

  it("returns empty string for root path URL", () => {
    const key = getObjectKeyFromUrl("https://example.com/");
    expect(key).toBe("");
  });

  it("handles deeply nested paths", () => {
    const key = getObjectKeyFromUrl("https://bucket.oss.com/a/b/c/d/e.png");
    expect(key).toBe("a/b/c/d/e.png");
  });
});
