import type { Role } from "@/lib/auth";
import { verifyAccessToken, JwtVerificationError } from "./jwt";
import { getJwtAccessSecret } from "./env";

export type RequestSession = { userId: string; email: string; role: Role };

/** Verifies the Authorization: Bearer <JWT> header on a plain server-route request. Returns null if missing/invalid/expired — never throws for that case. */
export function getSessionFromRequest(request: Request): RequestSession | null {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token, getJwtAccessSecret());
    return { userId: payload.sub, email: payload.email, role: payload.role };
  } catch (err) {
    if (err instanceof JwtVerificationError) return null;
    throw err;
  }
}
