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
  /** Returns the number of rows the statement changed (needed for ownership-guarded UPDATEs). */
  run(...params: P): number;
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
          run: (...params: P) => Number(stmt.run(...params).changes),
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
          return Number(stmt.run(...(params as unknown as any[])).changes);
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

  -- Target headway (minutes) between consecutive buses on a route, set by
  -- the bus auditor; the owner/driver dashboard reads this to know the
  -- interval they should be keeping.
  CREATE TABLE IF NOT EXISTS route_intervals (
    route_id TEXT PRIMARY KEY,
    interval_minutes INTEGER NOT NULL,
    updated_by TEXT NOT NULL REFERENCES users(id),
    updated_at INTEGER NOT NULL
  );

  -- Lateness penalties an auditor issues against a bus at a checkpoint.
  CREATE TABLE IF NOT EXISTS penalties (
    id TEXT PRIMARY KEY,
    bus_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    auditor_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    minutes_late INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_penalties_bus ON penalties(bus_id);

  -- One rating per (bus, passenger). passenger_id is kept for abuse
  -- prevention (rate limiting, one rating per ride) but is never returned
  -- by any owner/auditor-facing endpoint — only the aggregate is exposed,
  -- so the passenger's identity stays hidden from the driver/owner.
  CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    bus_id TEXT NOT NULL,
    passenger_id TEXT NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE (bus_id, passenger_id)
  );
  CREATE INDEX IF NOT EXISTS idx_ratings_bus ON ratings(bus_id);

  -- Ads an advertiser posts, shown to passengers/owners/auditors.
  CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY,
    advertiser_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ads_advertiser ON ads(advertiser_id);
  CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);

  -- One row per (ad, viewer): counts unique viewers ("reach") rather than
  -- raw impressions, so refreshing the page can't inflate the count the
  -- poster sees.
  CREATE TABLE IF NOT EXISTS ad_views (
    ad_id TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    viewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (ad_id, viewer_id)
  );

  CREATE TABLE IF NOT EXISTS ad_likes (
    ad_id TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (ad_id, user_id)
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

  upsertRouteInterval: db.prepare(
    `INSERT INTO route_intervals (route_id, interval_minutes, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (route_id) DO UPDATE SET interval_minutes = excluded.interval_minutes, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  ),
  listRouteIntervals: db.prepare<
    { route_id: string; interval_minutes: number; updated_at: number },
    []
  >(`SELECT route_id, interval_minutes, updated_at FROM route_intervals`),

  insertPenalty: db.prepare(
    `INSERT INTO penalties (id, bus_id, route_id, auditor_id, reason, minutes_late, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ),
  listPenaltiesByBus: db.prepare<
    {
      id: string;
      bus_id: string;
      route_id: string;
      reason: string;
      minutes_late: number;
      created_at: number;
    },
    [string]
  >(
    `SELECT id, bus_id, route_id, reason, minutes_late, created_at FROM penalties WHERE bus_id = ? ORDER BY created_at DESC LIMIT 50`,
  ),
  listAllPenalties: db.prepare<
    {
      id: string;
      bus_id: string;
      route_id: string;
      reason: string;
      minutes_late: number;
      created_at: number;
    },
    []
  >(
    `SELECT id, bus_id, route_id, reason, minutes_late, created_at FROM penalties ORDER BY created_at DESC LIMIT 100`,
  ),

  upsertRating: db.prepare(
    `INSERT INTO ratings (id, bus_id, passenger_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (bus_id, passenger_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = excluded.created_at`,
  ),
  ratingSummaryForBus: db.prepare<{ avg_rating: number | null; count: number }, [string]>(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM ratings WHERE bus_id = ?`,
  ),

  insertAd: db.prepare(
    `INSERT INTO ads (id, advertiser_id, title, body, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)`,
  ),
  getAdById: db.prepare<AdRow, [string]>(`SELECT * FROM ads WHERE id = ?`),
  // Active ads for the public feed, with a like count everyone can see and
  // a per-viewer likedByMe flag — but no view count, which is only ever
  // exposed to the ad's own poster (see listAdsByAdvertiser).
  listActiveAdsForViewer: db.prepare<
    AdRow & { like_count: number; liked_by_me: number; advertiser_name: string },
    [string]
  >(`
    SELECT a.*, u.name as advertiser_name,
      (SELECT COUNT(*) FROM ad_likes l WHERE l.ad_id = a.id) as like_count,
      EXISTS(SELECT 1 FROM ad_likes l2 WHERE l2.ad_id = a.id AND l2.user_id = ?) as liked_by_me
    FROM ads a
    JOIN users u ON u.id = a.advertiser_id
    WHERE a.status = 'active'
    ORDER BY a.created_at DESC
  `),
  listAdsByAdvertiser: db.prepare<AdRow & { view_count: number; like_count: number }, [string]>(`
    SELECT a.*,
      (SELECT COUNT(*) FROM ad_views v WHERE v.ad_id = a.id) as view_count,
      (SELECT COUNT(*) FROM ad_likes l WHERE l.ad_id = a.id) as like_count
    FROM ads a
    WHERE a.advertiser_id = ?
    ORDER BY a.created_at DESC
  `),
  setAdStatus: db.prepare(`UPDATE ads SET status = ? WHERE id = ? AND advertiser_id = ?`),

  recordAdView: db.prepare(
    `INSERT OR IGNORE INTO ad_views (ad_id, viewer_id, created_at) VALUES (?, ?, ?)`,
  ),

  findAdLike: db.prepare<{ ad_id: string }, [string, string]>(
    `SELECT ad_id FROM ad_likes WHERE ad_id = ? AND user_id = ?`,
  ),
  insertAdLike: db.prepare(`INSERT INTO ad_likes (ad_id, user_id, created_at) VALUES (?, ?, ?)`),
  deleteAdLike: db.prepare(`DELETE FROM ad_likes WHERE ad_id = ? AND user_id = ?`),
  countAdLikes: db.prepare<{ count: number }, [string]>(
    `SELECT COUNT(*) as count FROM ad_likes WHERE ad_id = ?`,
  ),
};

type AdRow = {
  id: string;
  advertiser_id: string;
  title: string;
  body: string;
  status: "active" | "paused";
  created_at: number;
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

export function setRouteInterval(routeId: string, intervalMinutes: number, updatedBy: string) {
  stmts.upsertRouteInterval.run(routeId, intervalMinutes, updatedBy, Date.now());
}

export function listRouteIntervals() {
  return stmts.listRouteIntervals.all();
}

export function insertPenalty(entry: {
  id: string;
  busId: string;
  routeId: string;
  auditorId: string;
  reason: string;
  minutesLate: number;
}) {
  stmts.insertPenalty.run(
    entry.id,
    entry.busId,
    entry.routeId,
    entry.auditorId,
    entry.reason,
    entry.minutesLate,
    Date.now(),
  );
}

export function listPenaltiesByBus(busId: string) {
  return stmts.listPenaltiesByBus.all(busId);
}

export function listAllPenalties() {
  return stmts.listAllPenalties.all();
}

export function upsertRating(entry: {
  id: string;
  busId: string;
  passengerId: string;
  rating: number;
  comment: string | null;
}) {
  stmts.upsertRating.run(
    entry.id,
    entry.busId,
    entry.passengerId,
    entry.rating,
    entry.comment,
    Date.now(),
  );
}

export function getRatingSummary(busId: string): { avgRating: number | null; count: number } {
  const row = stmts.ratingSummaryForBus.get(busId);
  return { avgRating: row?.avg_rating ?? null, count: row?.count ?? 0 };
}

export function insertAd(entry: { id: string; advertiserId: string; title: string; body: string }) {
  stmts.insertAd.run(entry.id, entry.advertiserId, entry.title, entry.body, Date.now());
}

export function getAdById(id: string) {
  return stmts.getAdById.get(id);
}

export function listActiveAdsForViewer(viewerId: string) {
  return stmts.listActiveAdsForViewer.all(viewerId);
}

export function listAdsByAdvertiser(advertiserId: string) {
  return stmts.listAdsByAdvertiser.all(advertiserId);
}

/** Returns true if the update actually matched (i.e. the caller owns the ad). */
export function setAdStatus(
  adId: string,
  advertiserId: string,
  status: "active" | "paused",
): boolean {
  return stmts.setAdStatus.run(status, adId, advertiserId) > 0;
}

export function recordAdView(adId: string, viewerId: string) {
  stmts.recordAdView.run(adId, viewerId, Date.now());
}

/** Toggles the current user's like on an ad. Returns the new liked state and the updated like count. */
export function toggleAdLike(adId: string, userId: string): { liked: boolean; likeCount: number } {
  const existing = stmts.findAdLike.get(adId, userId);
  if (existing) {
    stmts.deleteAdLike.run(adId, userId);
  } else {
    stmts.insertAdLike.run(adId, userId, Date.now());
  }
  const count = stmts.countAdLikes.get(adId)?.count ?? 0;
  return { liked: !existing, likeCount: count };
}
