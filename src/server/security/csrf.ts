import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getAppOrigin } from "./env";
import { logSecurityEvent } from "./audit-log";
import { getClientIp } from "./rate-limit";

// CSRF defense for all non-GET requests (server routes AND server functions,
// since this is global request middleware). SameSite=Lax on the refresh
// cookie already blocks most cross-site CSRF; this Origin check closes the
// remaining gap (e.g. a POST from a sibling subdomain, which SameSite=Lax
// does not block).
export const csrfMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();

  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    const configuredOrigin = getAppOrigin();

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
      logSecurityEvent({
        type: "csrf_rejected",
        ip: getClientIp(request),
        detail: { path: new URL(request.url).pathname, origin, expectedOrigin },
      });
      return new Response("Forbidden: origin check failed", { status: 403 });
    }
  }

  return next();
});

function safeOriginEquals(origin: string, expected: string): boolean {
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
