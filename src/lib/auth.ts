// Re-export Edge-compatible JWT utilities (safe for middleware)
export { createJWT, verifyJWT } from "./auth-edge";
export type { JWTPayload } from "./auth-edge";

// Import for local use in this file
import { verifyJWT as _verifyJWT } from "./auth-edge";
import type { JWTPayload as _JWTPayload } from "./auth-edge";

// Node.js-only imports below — NOT safe for Edge Runtime / middleware
import { hashSync, compareSync } from "bcryptjs";
import { cookies } from "next/headers";

export function hashPassword(password: string): string {
  return hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

export async function getAuthFromCookies(): Promise<_JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return _verifyJWT(token);
}

export function generateVerificationToken(): string {
  return crypto.randomUUID() + "-" + crypto.randomUUID();
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (len: number) =>
    Array.from({ length: len }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `INV-${part(4)}-${part(4)}`;
}
