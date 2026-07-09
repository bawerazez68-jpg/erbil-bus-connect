import crypto from "node:crypto";
import type { Role } from "@/lib/auth";
import {
  findUserByEmail,
  findUserById,
  insertUser,
  insertRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken as revokeRefreshTokenRow,
  revokeAllRefreshTokensForUser,
} from "./db";
import {
  hashPassword,
  verifyPassword,
  getDummyPasswordHash,
  randomToken,
  sha256Hex,
} from "./security/crypto";
import { signAccessToken } from "./security/jwt";
import { getJwtAccessSecret } from "./security/env";

export const ACCESS_TOKEN_TTL_SEC = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("An account with this email already exists");
  }
}

export type PublicUser = { id: string; name: string; email: string; role: Role };

function toPublicUser(row: { id: string; name: string; email: string; role: Role }): PublicUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<PublicUser> {
  const existing = findUserByEmail(input.email);
  if (existing) {
    throw new EmailAlreadyExistsError();
  }
  const passwordHash = await hashPassword(input.password);
  const id = crypto.randomUUID();
  insertUser({ id, name: input.name, email: input.email, passwordHash, role: input.role });
  return { id, name: input.name, email: input.email, role: input.role };
}

/**
 * Verifies credentials. Always runs the password hash comparison — even
 * when the user doesn't exist — using a dummy hash of the same algorithm,
 * so a timing side-channel can't reveal whether the email is registered.
 */
export async function authenticateUser(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const row = findUserByEmail(email);
  const hashToCheck = row?.password_hash ?? (await getDummyPasswordHash());
  const passwordMatches = await verifyPassword(hashToCheck, password);
  if (!row || !passwordMatches) return null;
  return toPublicUser(row);
}

export function issueAccessToken(user: PublicUser): string {
  return signAccessToken(user, getJwtAccessSecret(), ACCESS_TOKEN_TTL_SEC);
}

/** Issues a new opaque refresh token, storing only its SHA-256 hash (never the raw token). */
export function issueRefreshToken(userId: string): string {
  const raw = randomToken(32);
  const tokenHash = sha256Hex(raw);
  const expiresAt = Date.now() + REFRESH_TOKEN_TTL_SEC * 1000;
  insertRefreshToken({ id: crypto.randomUUID(), userId, tokenHash, expiresAt });
  return raw;
}

export function revokeAllSessionsForUser(userId: string) {
  revokeAllRefreshTokensForUser(userId);
}

/**
 * Validates a raw refresh token and, if valid, rotates it: the old token is
 * revoked and a new one issued. Rotation limits the blast radius of a stolen
 * refresh token to a single use.
 */
export function rotateRefreshToken(
  rawToken: string,
): { user: PublicUser; refreshToken: string; accessToken: string } | null {
  const tokenHash = sha256Hex(rawToken);
  const row = findRefreshTokenByHash(tokenHash);
  if (!row || row.revoked_at != null || row.expires_at < Date.now()) {
    return null;
  }
  const userRow = findUserById(row.user_id);
  if (!userRow) return null;

  revokeRefreshTokenRow(row.id);
  const user = toPublicUser(userRow);
  const refreshToken = issueRefreshToken(user.id);
  const accessToken = issueAccessToken(user);
  return { user, refreshToken, accessToken };
}

export function revokeRefreshTokenByRaw(rawToken: string) {
  const tokenHash = sha256Hex(rawToken);
  const row = findRefreshTokenByHash(tokenHash);
  if (row) revokeRefreshTokenRow(row.id);
}

export function getPublicUserById(id: string): PublicUser | null {
  const row = findUserById(id);
  return row ? toPublicUser(row) : null;
}
