import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { signupSchema, loginSchema } from "./security/validation";
import { authMiddleware, rateLimitMiddleware, UnauthorizedError } from "./auth-middleware";
import { getClientIp, consumeRateLimit } from "./security/rate-limit";
import { logSecurityEvent } from "./security/audit-log";
import {
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
} from "./security/session-cookies";
import {
  createUser,
  authenticateUser,
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshTokenByRaw,
  revokeAllSessionsForUser,
  getPublicUserById,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  type PublicUser,
} from "./auth.server";

export type AuthResult = { user: PublicUser; accessToken: string; expiresInSec: number };

export const signup = createServerFn({ method: "POST" })
  .middleware([rateLimitMiddleware({ key: "signup", max: 5, windowMs: 60 * 60 * 1000 })])
  .validator(signupSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
    const request = getRequest();
    const ip = getClientIp(request);

    let user: PublicUser;
    try {
      user = await createUser(data);
    } catch (err) {
      logSecurityEvent({ type: "signup_rejected", ip, detail: { email: data.email } });
      throw err instanceof Error ? err : new Error("Unable to create account");
    }

    logSecurityEvent({ type: "signup_success", userId: user.id, ip });

    const accessToken = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user.id);
    setRefreshCookie(refreshToken, REFRESH_TOKEN_TTL_SEC);

    return { user, accessToken, expiresInSec: ACCESS_TOKEN_TTL_SEC };
  });

export const login = createServerFn({ method: "POST" })
  .middleware([rateLimitMiddleware({ key: "login", max: 10, windowMs: 60 * 1000 })])
  .validator(loginSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
    const request = getRequest();
    const ip = getClientIp(request);

    // Extra per-account limit alongside the per-IP middleware limit, so a
    // credential-stuffing attempt spread across many IPs is still throttled.
    const perAccountOk = consumeRateLimit(`login-email:${data.email}`, 10, 60 * 1000);
    if (!perAccountOk) {
      logSecurityEvent({ type: "rate_limit_exceeded", ip, detail: { key: "login-email" } });
      throw new Error("Too many login attempts. Please try again shortly.");
    }

    const user = await authenticateUser(data.email, data.password);
    if (!user) {
      logSecurityEvent({ type: "login_failure", ip, detail: { email: data.email } });
      // Same message regardless of whether the email exists or the password
      // was wrong — avoids user enumeration.
      throw new Error("Invalid email or password");
    }

    // Rotate sessions on login (session-fixation defense): any pre-existing
    // refresh tokens for this user are revoked before a fresh one is issued.
    revokeAllSessionsForUser(user.id);

    logSecurityEvent({ type: "login_success", userId: user.id, ip });

    const accessToken = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user.id);
    setRefreshCookie(refreshToken, REFRESH_TOKEN_TTL_SEC);

    return { user, accessToken, expiresInSec: ACCESS_TOKEN_TTL_SEC };
  });

export const refresh = createServerFn({ method: "POST" })
  .middleware([rateLimitMiddleware({ key: "refresh", max: 30, windowMs: 60 * 1000 })])
  .handler(async (): Promise<AuthResult> => {
    const request = getRequest();
    const ip = getClientIp(request);
    const rawToken = readRefreshCookie();

    if (!rawToken) throw new UnauthorizedError("No active session");

    const rotated = rotateRefreshToken(rawToken);
    if (!rotated) {
      clearRefreshCookie();
      logSecurityEvent({ type: "token_refresh_rejected", ip });
      throw new UnauthorizedError("Session expired, please log in again");
    }

    setRefreshCookie(rotated.refreshToken, REFRESH_TOKEN_TTL_SEC);
    logSecurityEvent({ type: "token_refresh", userId: rotated.user.id, ip });

    return {
      user: rotated.user,
      accessToken: rotated.accessToken,
      expiresInSec: ACCESS_TOKEN_TTL_SEC,
    };
  });

export const logout = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const request = getRequest();
    const rawToken = readRefreshCookie();
    if (rawToken) {
      revokeRefreshTokenByRaw(rawToken);
      logSecurityEvent({ type: "logout", ip: getClientIp(request) });
    }
    clearRefreshCookie();
    return { ok: true };
  },
);

export const me = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PublicUser> => {
    const user = getPublicUserById(context.session.userId);
    if (!user) throw new UnauthorizedError("Account no longer exists");
    return user;
  });
