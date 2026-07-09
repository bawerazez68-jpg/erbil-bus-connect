import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// Lives outside src/server/** on purpose: src/start.ts (which wires this
// into createStart()) is loaded isomorphically, and TanStack Start's
// import-protection plugin denies any client-reachable file from importing
// src/server/** (reserved for code that must never reach the client bundle,
// like DB access). To keep this file import-clean, it deliberately doesn't
// pull in the DB-backed audit logger from src/server/security/audit-log —
// CSRF rejections are logged to stdout only, not persisted.

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function safeOriginEquals(origin: string, expected: string): boolean {
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

// CSRF defense for all non-GET requests (server routes AND server functions,
// since this is global request middleware). SameSite=Lax on the refresh
// cookie already blocks most cross-site CSRF; this Origin check closes the
// remaining gap (e.g. a POST from a sibling subdomain, which SameSite=Lax
// does not block).
export const csrfMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();

  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    const configuredOrigin = process.env.APP_ORIGIN;

    const requestOrigin = (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return null;
      }
    })();

    const expectedOrigin = configuredOrigin ?? requestOrigin;
    const originIsTrusted =
      origin != null && expectedOrigin != null && safeOriginEquals(origin, expectedOrigin);

    if (!originIsTrusted) {
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          security_event: "csrf_rejected",
          ip: getClientIp(request),
          path: new URL(request.url).pathname,
          origin,
          expectedOrigin,
        }),
      );
      return new Response("Forbidden: origin check failed", { status: 403 });
    }
  }

  return next();
});
