/**
 * Edge-compatible auth utilities.
 * Only imports that work in Edge Runtime (Vercel middleware).
 * Do NOT import bcryptjs, next/headers, or any Node.js-only modules here.
 */
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);

const JWT_ISSUER = "content-creator-hub";
const JWT_EXPIRY = "7d";

export interface JWTPayload {
  userId: string;
  role: string;
  jti: string;
}

export async function createJWT(payload: {
  userId: string;
  role: string;
}): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const token = await new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setJti(jti)
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);

  return { token, jti, expiresAt };
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
    });
    return {
      userId: payload.userId as string,
      role: payload.role as string,
      jti: payload.jti as string,
    };
  } catch {
    return null;
  }
}
