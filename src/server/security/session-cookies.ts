// Pure helpers (no ambient request-context dependency) so they work
// identically whether called from a createServerFn handler or from a plain
// server-route handler that constructs its own Response.

// The __Host- cookie prefix requires the Secure flag, which requires HTTPS.
// Local dev typically runs over plain http, so browsers would silently
// refuse to set a __Host- cookie there — fall back to a plain name + no
// Secure flag outside production.
const isProd = () => process.env.NODE_ENV === "production";
const REFRESH_COOKIE_NAME = () => (isProd() ? "__Host-refresh" : "refresh_token");

export function buildSetRefreshCookieHeader(token: string, maxAgeSec: number): string {
  const parts = [
    `${REFRESH_COOKIE_NAME()}=${token}`,
    "HttpOnly", // not readable from JS — an XSS bug can't exfiltrate it
    "SameSite=Lax", // blocks most cross-site CSRF; Origin check in csrf.ts covers the rest
    "Path=/",
    `Max-Age=${maxAgeSec}`,
  ];
  if (isProd()) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearRefreshCookieHeader(): string {
  const parts = [`${REFRESH_COOKIE_NAME()}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (isProd()) parts.push("Secure");
  return parts.join("; ");
}

export function readRefreshCookieFromRequest(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const name = REFRESH_COOKIE_NAME();
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}
