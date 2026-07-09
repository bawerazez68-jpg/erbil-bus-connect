import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { securityHeadersMiddleware } from "./middleware/headers";

// TanStack Start's own CSRF middleware: checks Sec-Fetch-Site (modern
// browsers), falling back to Origin, falling back to Referer — stronger
// than an Origin-only check since Sec-Fetch-Site survives some proxies that
// strip Origin. CSRF only matters for state-changing requests, so the
// filter restricts checks to non-GET/HEAD — without it, top-level page
// navigation (Sec-Fetch-Site: "none", no Origin/Referer) gets rejected too,
// since its default only accepts "same-origin".
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.request.method !== "GET" && ctx.request.method !== "HEAD",
  ...(process.env.APP_ORIGIN ? { origin: process.env.APP_ORIGIN } : {}),
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  // Order matters: errorMiddleware wraps everything so it can catch errors
  // thrown by csrfMiddleware/securityHeadersMiddleware; csrfMiddleware runs
  // before the request reaches any handler so rejected requests never
  // execute application logic.
  requestMiddleware: [errorMiddleware, csrfMiddleware, securityHeadersMiddleware],
}));
