import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Role } from "@/lib/auth";

// Local SQLite database (bun:sqlite is built into the Bun runtime — no
// external dependency, so it works even when the package registry is
// unreachable). Deploying to an edge runtime without a persistent
// filesystem (e.g. Cloudflare Workers/D1) would need a different storage
// backend; this is fine for a Node/Bun server deployment.

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "app.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    user_id TEXT,
    ip_encrypted TEXT,
    detail TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS avatar_uploads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: number;
};

// All statements below use `?` placeholders bound at call time — never
// string-concatenate user input into SQL.

const stmts = {
  insertUser: db.query(
    `INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ),
  findUserByEmail: db.query<UserRow, [string]>(
    `SELECT * FROM users WHERE email = ? COLLATE NOCASE`,
  ),
  findUserById: db.query<UserRow, [string]>(`SELECT * FROM users WHERE id = ?`),

  insertRefreshToken: db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
  ),
  findRefreshTokenByHash: db.query<
    {
      id: string;
      user_id: string;
      token_hash: string;
      expires_at: number;
      revoked_at: number | null;
    },
    [string]
  >(`SELECT * FROM refresh_tokens WHERE token_hash = ?`),
  revokeRefreshToken: db.query(`UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`),
  revokeAllRefreshTokensForUser: db.query(
    `UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
  ),

  insertAuditLog: db.query(
    `INSERT INTO audit_logs (event_type, user_id, ip_encrypted, detail, created_at) VALUES (?, ?, ?, ?, ?)`,
  ),

  insertAvatarUpload: db.query(
    `INSERT INTO avatar_uploads (id, user_id, filename, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ),
  findAvatarUploadById: db.query<
    {
      id: string;
      user_id: string;
      filename: string;
      mime: string;
      size: number;
      created_at: number;
    },
    [string]
  >(`SELECT * FROM avatar_uploads WHERE id = ?`),
};

export function insertUser(user: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}) {
  stmts.insertUser.run(user.id, user.name, user.email, user.passwordHash, user.role, Date.now());
}

export function findUserByEmail(email: string): UserRow | null {
  return (stmts.findUserByEmail.get(email) as UserRow | null) ?? null;
}

export function findUserById(id: string): UserRow | null {
  return (stmts.findUserById.get(id) as UserRow | null) ?? null;
}

export function insertRefreshToken(entry: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
}) {
  stmts.insertRefreshToken.run(
    entry.id,
    entry.userId,
    entry.tokenHash,
    entry.expiresAt,
    Date.now(),
  );
}

export function findRefreshTokenByHash(tokenHash: string) {
  return stmts.findRefreshTokenByHash.get(tokenHash) ?? null;
}

export function revokeRefreshToken(id: string) {
  stmts.revokeRefreshToken.run(Date.now(), id);
}

export function revokeAllRefreshTokensForUser(userId: string) {
  stmts.revokeAllRefreshTokensForUser.run(Date.now(), userId);
}

export function insertAuditLog(entry: {
  eventType: string;
  userId: string | null;
  ipEncrypted: string | null;
  detail: string | null;
}) {
  stmts.insertAuditLog.run(
    entry.eventType,
    entry.userId,
    entry.ipEncrypted,
    entry.detail,
    Date.now(),
  );
}

export function insertAvatarUpload(entry: {
  id: string;
  userId: string;
  filename: string;
  mime: string;
  size: number;
}) {
  stmts.insertAvatarUpload.run(
    entry.id,
    entry.userId,
    entry.filename,
    entry.mime,
    entry.size,
    Date.now(),
  );
}

export function findAvatarUploadById(id: string) {
  return stmts.findAvatarUploadById.get(id) ?? null;
}
