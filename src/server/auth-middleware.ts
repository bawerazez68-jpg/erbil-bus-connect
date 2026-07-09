import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { Role } from "@/lib/auth";
import { verifyAccessToken, JwtVerificationError } from "./security/jwt";
import { getJwtAccessSecret } from "./security/env";
import { consumeRateLimit, getClientIp } from "./security/rate-limit";
import { logSecurityEvent } from "./security/audit-log";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
  }
}

export type SessionPrincipal = { userId: string; email: string; role: Role };

/**
 * Verifies the short-lived JWT access token sent as `Authorization: Bearer <token>`.
 * This — not any route-level guard — is the actual data security boundary:
 * apply it to every server function that reads or writes private data.
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) throw new UnauthorizedError("Missing access token");

  let payload;
  try {
    payload = verifyAccessToken(token, getJwtAccessSecret());
  } catch (err) {
    if (err instanceof JwtVerificationError) {
      throw new UnauthorizedError("Invalid or expired access token");
    }
    throw err;
  }

  const session: SessionPrincipal = {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
  };
  return next({ context: { session } });
});

/** Restricts a server function to one or more roles. Depends on authMiddleware for the session. */
export function roleMiddleware(allowedRoles: Role[]) {
  return createMiddleware({ type: "function" })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      if (!allowedRoles.includes(context.session.role)) {
        logSecurityEvent({
          type: "rbac_denied",
          userId: context.session.userId,
          ip: getClientIp(getRequest()),
          detail: { requiredRoles: allowedRoles, actualRole: context.session.role },
        });
        throw new ForbiddenError(`Requires one of roles: ${allowedRoles.join(", ")}`);
      }
      return next();
    });
}

export class RateLimitError extends Error {
  constructor(message = "Too many requests") {
    super(message);
  }
}

/** Per-IP sliding-window rate limit for a server function. */
export function rateLimitMiddleware(opts: { key: string; max: number; windowMs: number }) {
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    const request = getRequest();
    const ip = getClientIp(request);
    const bucketKey = `${opts.key}:${ip}`;
    const allowed = consumeRateLimit(bucketKey, opts.max, opts.windowMs);
    if (!allowed) {
      logSecurityEvent({ type: "rate_limit_exceeded", ip, detail: { key: opts.key } });
      throw new RateLimitError();
    }
    return next();
  });
}
