import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { csrfMiddleware } from "./server/security/csrf";
import { securityHeadersMiddleware } from "./server/security/headers";

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
