import { createFileRoute } from "@tanstack/react-router";
import { getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import {
  buildClearRefreshCookieHeader,
  readRefreshCookieFromRequest,
} from "@/server/security/session-cookies";
import { revokeRefreshTokenByRaw } from "@/server/auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawToken = readRefreshCookieFromRequest(request);
        if (rawToken) {
          revokeRefreshTokenByRaw(rawToken);
          logSecurityEvent({ type: "logout", ip: getClientIp(request) });
        }
        return Response.json(
          { ok: true },
          { headers: { "Set-Cookie": buildClearRefreshCookieHeader() } },
        );
      },
    },
  },
});
