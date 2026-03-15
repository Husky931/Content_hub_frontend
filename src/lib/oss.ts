import crypto from "crypto";

const OSS_REGION = process.env.OSS_REGION || "oss-cn-beijing";
const OSS_BUCKET = process.env.OSS_BUCKET || "";
const OSS_ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || "";
const OSS_ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || "";
const OSS_ENDPOINT =
  process.env.OSS_ENDPOINT || `https://${OSS_REGION}.aliyuncs.com`;
const OSS_BUCKET_DOMAIN =
  process.env.OSS_BUCKET_DOMAIN ||
  `${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com`;

export function isOssConfigured(): boolean {
  return !!(OSS_BUCKET && OSS_ACCESS_KEY_ID && OSS_ACCESS_KEY_SECRET);
}

/**
 * Generate a presigned PUT URL for direct browser-to-OSS uploads.
 * Uses OSS V1 signature (simpler, widely supported).
 */
export function generatePresignedPutUrl(
  objectKey: string,
  contentType: string,
  expiresInSeconds = 600
): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const stringToSign = `PUT\n\n${contentType}\n${expires}\n/${OSS_BUCKET}/${objectKey}`;

  const signature = crypto
    .createHmac("sha1", OSS_ACCESS_KEY_SECRET)
    .update(stringToSign)
    .digest("base64");

  const encodedSignature = encodeURIComponent(signature);
  const encodedKeyId = encodeURIComponent(OSS_ACCESS_KEY_ID);

  return `https://${OSS_BUCKET_DOMAIN}/${objectKey}?OSSAccessKeyId=${encodedKeyId}&Expires=${expires}&Signature=${encodedSignature}`;
}

/**
 * Generate a presigned GET URL for private file access.
 */
export function generatePresignedGetUrl(
  objectKey: string,
  expiresInSeconds = 3600
): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const stringToSign = `GET\n\n\n${expires}\n/${OSS_BUCKET}/${objectKey}`;

  const signature = crypto
    .createHmac("sha1", OSS_ACCESS_KEY_SECRET)
    .update(stringToSign)
    .digest("base64");

  const encodedSignature = encodeURIComponent(signature);
  const encodedKeyId = encodeURIComponent(OSS_ACCESS_KEY_ID);

  return `https://${OSS_BUCKET_DOMAIN}/${objectKey}?OSSAccessKeyId=${encodedKeyId}&Expires=${expires}&Signature=${encodedSignature}`;
}

/**
 * Get the OSS object key from a full OSS URL.
 */
export function getObjectKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.pathname.slice(1); // Remove leading /
  } catch {
    return null;
  }
}
