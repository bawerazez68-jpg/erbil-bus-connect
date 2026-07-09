import { insertAuditLog } from "@/server/db";
import { encryptAtRest } from "./crypto";

export type SecurityEventType =
  | "signup_success"
  | "signup_rejected"
  | "login_success"
  | "login_failure"
  | "logout"
  | "token_refresh"
  | "token_refresh_rejected"
  | "rate_limit_exceeded"
  | "csrf_rejected"
  | "rbac_denied"
  | "upload_rejected"
  | "upload_accepted";

export function logSecurityEvent(event: {
  type: SecurityEventType;
  userId?: string | null;
  ip?: string | null;
  detail?: Record<string, unknown>;
}) {
  // IP addresses are personal data — encrypt at rest rather than storing
  // them in the clear in the audit table.
  const ipEncrypted = event.ip ? encryptAtRest(event.ip) : null;
  const detailJson = event.detail ? JSON.stringify(event.detail) : null;

  try {
    insertAuditLog({
      eventType: event.type,
      userId: event.userId ?? null,
      ipEncrypted,
      detail: detailJson,
    });
  } catch (err) {
    // Logging must never break the request it's observing.
    console.error("[security] failed to persist audit log", err);
  }

  // Also emit to stdout/stderr as structured JSON so the hosting platform's
  // log aggregation picks it up even if the DB write fails.
  const line = {
    ts: new Date().toISOString(),
    security_event: event.type,
    userId: event.userId ?? undefined,
    ...event.detail,
  };
  if (
    event.type.endsWith("_failure") ||
    event.type.endsWith("_rejected") ||
    event.type === "rbac_denied"
  ) {
    console.warn(JSON.stringify(line));
  } else {
    console.info(JSON.stringify(line));
  }
}
