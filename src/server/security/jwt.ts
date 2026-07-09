import crypto from "node:crypto";
import type { Role } from "@/lib/auth";

// Minimal HS256 JWT implementation (header.payload.signature, base64url) using
// node:crypto HMAC-SHA256. Avoids adding a new npm dependency; the format is
// a standard, widely-verifiable JWT (compatible with jwt.io etc.).

export type AccessTokenPayload = {
  sub: string; // user id
  email: string;
  role: Role;
  iat: number;
  exp: number;
};

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function sign(data: string, secret: string): string {
  return base64url(crypto.createHmac("sha256", secret).update(data).digest());
}

export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSec: number,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSec };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(signingInput, secret);
  return `${signingInput}.${signature}`;
}

export class JwtVerificationError extends Error {}

export function verifyJwt<T = Record<string, unknown>>(token: string, secret: string): T {
  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtVerificationError("Malformed token");
  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(signingInput, secret);

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new JwtVerificationError("Invalid signature");
  }

  let payload: T & { exp?: number };
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new JwtVerificationError("Invalid payload encoding");
  }

  if (typeof payload.exp === "number" && Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new JwtVerificationError("Token expired");
  }

  return payload;
}

export function signAccessToken(
  user: { id: string; email: string; role: Role },
  secret: string,
  expiresInSec = 15 * 60,
): string {
  return signJwt({ sub: user.id, email: user.email, role: user.role }, secret, expiresInSec);
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  return verifyJwt<AccessTokenPayload>(token, secret);
}
