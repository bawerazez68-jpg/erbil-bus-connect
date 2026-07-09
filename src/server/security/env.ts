import crypto from "node:crypto";

// Secrets are read from process.env lazily (inside functions), never cached
// in a module-level const at import time — see execution-model guidance for
// isomorphic/edge runtimes. This file is server-only; never import it from
// client code.

const isProduction = () => process.env.NODE_ENV === "production";

// Ephemeral fallback so `bun dev` boots without a .env file. Generated once
// per process start, held only in memory. All existing sessions/tokens are
// invalidated on restart. Production must set these explicitly — see
// .env.example — or the process refuses to start.
const devFallbackSecrets = {
  jwtAccess: crypto.randomBytes(48).toString("base64"),
  jwtRefresh: crypto.randomBytes(48).toString("base64"),
  encryptionKey: crypto.randomBytes(32).toString("base64"),
};
let warnedFallback = false;

function requireSecret(envVar: string, fallback: string): string {
  const value = process.env[envVar];
  if (value && value.length > 0) return value;
  if (isProduction()) {
    throw new Error(
      `Missing required environment variable ${envVar}. Refusing to start in production without it.`,
    );
  }
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn(
      `[security] ${envVar} (and possibly other secrets) not set — using an ephemeral in-memory value for local development only. Set real secrets in .env before deploying. See .env.example.`,
    );
  }
  return fallback;
}

export function getJwtAccessSecret(): string {
  return requireSecret("JWT_ACCESS_SECRET", devFallbackSecrets.jwtAccess);
}

export function getJwtRefreshSecret(): string {
  return requireSecret("JWT_REFRESH_SECRET", devFallbackSecrets.jwtRefresh);
}

export function getEncryptionKey(): Buffer {
  const b64 = requireSecret("ENCRYPTION_KEY", devFallbackSecrets.encryptionKey);
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of 32 random bytes).");
  }
  return key;
}

export function getAppOrigin(): string | undefined {
  return process.env.APP_ORIGIN;
}
