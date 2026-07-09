import { createFileRoute } from "@tanstack/react-router";
import { loginSchema } from "@/server/security/validation";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { buildSetRefreshCookieHeader } from "@/server/security/session-cookies";
import {
  authenticateUser,
  issueAccessToken,
  issueRefreshToken,
  revokeAllSessionsForUser,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
} from "@/server/auth.server";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);

        if (!consumeRateLimit(`login:${ip}`, 10, 60 * 1000)) {
          logSecurityEvent({ type: "rate_limit_exceeded", ip, detail: { key: "login" } });
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid email or password" }, { status: 400 });
        }
        const { email, password } = parsed.data;

        // Extra per-account limit alongside the per-IP limit above, so a
        // credential-stuffing attempt spread across many IPs is still
        // throttled.
        if (!consumeRateLimit(`login-email:${email}`, 10, 60 * 1000)) {
          logSecurityEvent({ type: "rate_limit_exceeded", ip, detail: { key: "login-email" } });
          return Response.json(
            { error: "Too many login attempts. Please try again shortly." },
            { status: 429 },
          );
        }

        const user = await authenticateUser(email, password);
        if (!user) {
          logSecurityEvent({ type: "login_failure", ip, detail: { email } });
          // Same message regardless of whether the email exists or the
          // password was wrong — avoids user enumeration.
          return Response.json({ error: "Invalid email or password" }, { status: 401 });
        }

        // Rotate sessions on login (session-fixation defense): any
        // pre-existing refresh tokens for this user are revoked before a
        // fresh one is issued.
        revokeAllSessionsForUser(user.id);

        logSecurityEvent({ type: "login_success", userId: user.id, ip });

        const accessToken = issueAccessToken(user);
        const refreshToken = issueRefreshToken(user.id);

        return Response.json(
          { user, accessToken, expiresInSec: ACCESS_TOKEN_TTL_SEC },
          {
            status: 200,
            headers: {
              "Set-Cookie": buildSetRefreshCookieHeader(refreshToken, REFRESH_TOKEN_TTL_SEC),
            },
          },
        );
      },
    },
  },
});
