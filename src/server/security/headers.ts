import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

// Global security headers applied to every response. Defense-in-depth
// against XSS (CSP + nosniff), clickjacking (frame-ancestors/X-Frame-Options),
// and information leakage (Referrer-Policy).
//
// script-src 'self' is the header that actually matters for XSS: even if an
// attacker manages to inject markup, the browser refuses to execute any
// <script> that isn't served from this origin. style-src allows
// 'unsafe-inline' because several UI libraries (Radix primitives, MapLibre
// GL) inject inline styles at runtime; that's a much smaller attack surface
// than inline script.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS: Array<[string, string]> = [
  ["Content-Security-Policy", CSP],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(self)"],
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains"],
];

export const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  for (const [name, value] of SECURITY_HEADERS) {
    setResponseHeader(name, value);
  }
  return result;
});
