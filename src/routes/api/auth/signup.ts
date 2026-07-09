import { createFileRoute } from "@tanstack/react-router";
import { signupSchema } from "@/server/security/validation";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { buildSetRefreshCookieHeader } from "@/server/security/session-cookies";
import {
  createUser,
  issueAccessToken,
  issueRefreshToken,
  EmailAlreadyExistsError,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
} from "@/server/auth.server";

// A plain server route (not createServerFn) because this project's import
// protection denies any client-reachable file from importing src/server/**
// — including createServerFn RPC wrapper files that merely re-export server
// logic. Server routes under src/routes/api/** are the pattern this repo
// already verified works (see the avatar upload routes).
export const Route = createFileRoute("/api/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);

        if (!consumeRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) {
          logSecurityEvent({ type: "rate_limit_exceeded", ip, detail: { key: "signup" } });
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = signupSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          );
        }

        let user;
        try {
          user = await createUser(parsed.data);
        } catch (err) {
          logSecurityEvent({ type: "signup_rejected", ip, detail: { email: parsed.data.email } });
          if (err instanceof EmailAlreadyExistsError) {
            return Response.json({ error: err.message }, { status: 409 });
          }
          // Unexpected error (hashing/DB failure) — log the real cause
          // server-side but never leak internal error details to the client.
          console.error("[signup] unexpected error", err);
          return Response.json({ error: "Unable to create account" }, { status: 500 });
        }

        logSecurityEvent({ type: "signup_success", userId: user.id, ip });

        const accessToken = issueAccessToken(user);
        const refreshToken = issueRefreshToken(user.id);

        return Response.json(
          { user, accessToken, expiresInSec: ACCESS_TOKEN_TTL_SEC },
          {
            status: 201,
            headers: {
              "Set-Cookie": buildSetRefreshCookieHeader(refreshToken, REFRESH_TOKEN_TTL_SEC),
            },
          },
        );
      },
    },
  },
});
