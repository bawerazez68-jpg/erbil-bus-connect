import { createFileRoute } from "@tanstack/react-router";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import {
  buildSetRefreshCookieHeader,
  buildClearRefreshCookieHeader,
  readRefreshCookieFromRequest,
} from "@/server/security/session-cookies";
import {
  rotateRefreshToken,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
} from "@/server/auth.server";

export const Route = createFileRoute("/api/auth/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);

        if (!consumeRateLimit(`refresh:${ip}`, 30, 60 * 1000)) {
          logSecurityEvent({ type: "rate_limit_exceeded", ip, detail: { key: "refresh" } });
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        const rawToken = readRefreshCookieFromRequest(request);
        if (!rawToken) {
          return Response.json({ error: "No active session" }, { status: 401 });
        }

        const rotated = rotateRefreshToken(rawToken);
        if (!rotated) {
          logSecurityEvent({ type: "token_refresh_rejected", ip });
          return Response.json(
            { error: "Session expired, please log in again" },
            { status: 401, headers: { "Set-Cookie": buildClearRefreshCookieHeader() } },
          );
        }

        logSecurityEvent({ type: "token_refresh", userId: rotated.user.id, ip });

        return Response.json(
          {
            user: rotated.user,
            accessToken: rotated.accessToken,
            expiresInSec: ACCESS_TOKEN_TTL_SEC,
          },
          {
            status: 200,
            headers: {
              "Set-Cookie": buildSetRefreshCookieHeader(
                rotated.refreshToken,
                REFRESH_TOKEN_TTL_SEC,
              ),
            },
          },
        );
      },
    },
  },
});
