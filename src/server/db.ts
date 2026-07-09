import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Role } from "@/lib/auth";

// Runtime-adaptive SQLite: uses bun:sqlite when actually running under Bun,
// and Node's built-in node:sqlite otherwise (e.g. Vite's SSR dev pipeline
// runs isolated modules through a plain Node ESM loader that doesn't
// understand the `bun:` URL scheme, and a production build may well be
// started with `node .output/server/index.mjs` rather than `bun`). Both are
// runtime built-ins — no external dependency, so this works even when the
// package registry is unreachable. Deploying to an edge runtime without a
// persistent filesystem (e.g. Cloudflare Workers) would need a different
// storage backend (D1, etc.) instead of a local file.

type Row = Record<string, unknown>;

interface PreparedStatement<T, P extends readonly unknown[]> {
  get(...params: P): T | null;
  all(...params: P): T[];
  run(...params: P): void;
}

interface SqliteHandle {
  exec(sql: string): void;
  prepare<T = Row, P extends readonly unknown[] = unknown[]>(sql: string): PreparedStatement<T, P>;
}

async function openDatabase(filename: string): Promise<SqliteHandle> {
  if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") {
    const { Database } = await import("bun:sqlite");
    const raw = new Database(filename);
    return {
      exec: (sql) => raw.exec(sql),
      prepare: <T, P extends readonly unknown[]>(sql: string) => {
        const stmt = raw.query<T, P>(sql);
        return {
          get: (...params: P) => stmt.get(...params) ?? null,
          all: (...params: P) => stmt.all(...params),
          run: (...params: P) => {
            stmt.run(...params);
          },
        };
      },
    };
  }

  const { DatabaseSync } = await import("node:sqlite");
  const raw = new DatabaseSync(filename);
  return {
    exec: (sql) => raw.exec(sql),
    prepare: <T, P extends readonly unknown[]>(sql: string) => {
      const stmt = raw.prepare(sql);
      // node:sqlite's SQLInputValue is narrower than `unknown` — this glue
      // code crosses from our generic param type into its concrete one, so
      // a double cast through `any` is the pragmatic choice here.
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: (...params: P) => (stmt.get(...(params as unknown as any[])) as T | undefined) ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        all: (...params: P) => stmt.all(...(params as unknown as any[])) as T[],
        run: (...params: P) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stmt.run(...(params as unknown as any[]));
        },
      };
    },
  };
}

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const db = await openDatabase(path.join(dataDir, "app.db"));
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
  insertUser: db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ),
  findUserByEmail: db.prepare<UserRow, [string]>(
    `SELECT * FROM users WHERE email = ? COLLATE NOCASE`,
  ),
  findUserById: db.prepare<UserRow, [string]>(`SELECT * FROM users WHERE id = ?`),

  insertRefreshToken: db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
  ),
  findRefreshTokenByHash: db.prepare<
    {
      id: string;
      user_id: string;
      token_hash: string;
      expires_at: number;
      revoked_at: number | null;
    },
    [string]
  >(`SELECT * FROM refresh_tokens WHERE token_hash = ?`),
  revokeRefreshToken: db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`),
  revokeAllRefreshTokensForUser: db.prepare(
    `UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
  ),

  insertAuditLog: db.prepare(
    `INSERT INTO audit_logs (event_type, user_id, ip_encrypted, detail, created_at) VALUES (?, ?, ?, ?, ?)`,
  ),

  insertAvatarUpload: db.prepare(
    `INSERT INTO avatar_uploads (id, user_id, filename, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ),
  findAvatarUploadById: db.prepare<
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
  return stmts.findUserByEmail.get(email);
}

export function findUserById(id: string): UserRow | null {
  return stmts.findUserById.get(id);
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
  return stmts.findRefreshTokenByHash.get(tokenHash);
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
  return stmts.findAvatarUploadById.get(id);
}
