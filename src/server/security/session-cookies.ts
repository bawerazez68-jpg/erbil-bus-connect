import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

// The __Host- cookie prefix requires the Secure flag, which requires HTTPS.
// Local dev typically runs over plain http, so browsers would silently
// refuse to set a __Host- cookie there — fall back to a plain name + no
// Secure flag outside production.
const isProd = () => process.env.NODE_ENV === "production";
const REFRESH_COOKIE_NAME = () => (isProd() ? "__Host-refresh" : "refresh_token");

export function setRefreshCookie(token: string, maxAgeSec: number) {
  setCookie(REFRESH_COOKIE_NAME(), token, {
    httpOnly: true, // not readable from JS — an XSS bug can't exfiltrate it
    secure: isProd(),
    sameSite: "lax", // blocks most cross-site CSRF; Origin check in csrf.ts covers the rest
    path: "/",
    maxAge: maxAgeSec,
  });
}

export function clearRefreshCookie() {
  deleteCookie(REFRESH_COOKIE_NAME(), { path: "/" });
}

export function readRefreshCookie(): string | null {
  return getCookie(REFRESH_COOKIE_NAME()) ?? null;
}
