import { createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

// Lives outside src/server/** on purpose: src/start.ts (which wires this
// into createStart()) is loaded isomorphically, and TanStack Start's
// import-protection plugin denies any client-reachable file from importing
// src/server/** (that folder is reserved for code that must never end up in
// the client bundle, like DB access). This module has no such dependency,
// so it's safe to keep isomorphic.
//
// Global security headers applied to every response. Defense-in-depth
// against XSS (CSP + nosniff), clickjacking (frame-ancestors/X-Frame-Options),
// and information leakage (Referrer-Policy).
//
// script-src allows 'unsafe-inline': TanStack Start injects a per-request
// inline <script> carrying serialized SSR hydration state
// (window.$_TSR = ...), which is required for the app to hydrate at all —
// without it the page renders blank. A nonce-based CSP is the correct fix
// (TanStack Router supports router.options.ssr.nonce for exactly this), but
// wiring a per-request nonce through to both the router and this
// isomorphic header middleware needs deeper framework plumbing than fits
// here. The residual XSS risk is small in practice: React escapes all
// rendered content by default and this codebase has no
// dangerouslySetInnerHTML/innerHTML usage, so there's no injection point
// for an attacker to place a script tag in the first place — this is
// belt-and-suspenders on top of that, not the primary defense. style-src
// allows 'unsafe-inline' too, since several UI libraries (Radix
// primitives, MapLibre GL) inject inline styles at runtime.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
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
