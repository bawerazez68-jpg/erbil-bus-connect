import crypto from "node:crypto";
import { getEncryptionKey } from "./env";

// --- Password hashing ---
// Argon2id via Bun's built-in Bun.password when actually running under Bun.
// Vite's SSR dev pipeline (and a Node-based production deployment) executes
// this code under plain Node instead, where the `Bun` global doesn't exist —
// same dual-runtime situation as src/server/db.ts. Node has no built-in
// Argon2/bcrypt, so the fallback uses node:crypto's scrypt, a memory-hard
// KDF that's a reasonable built-in substitute without adding a dependency
// this sandbox's registry can't fetch.

const SCRYPT_KEYLEN = 64;
const SCRYPT_PREFIX = "scrypt:";

function isBunRuntime(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
}

function scryptDerive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPasswordScrypt(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptDerive(plain, salt);
  return `${SCRYPT_PREFIX}${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifyPasswordScrypt(stored: string, plain: string): Promise<boolean> {
  const [, saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scryptDerive(plain, salt);
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

export async function hashPassword(plain: string): Promise<string> {
  if (isBunRuntime()) {
    return Bun.password.hash(plain, { algorithm: "argon2id", memoryCost: 19456, timeCost: 2 });
  }
  return hashPasswordScrypt(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (hash.startsWith(SCRYPT_PREFIX)) {
    return verifyPasswordScrypt(hash, plain);
  }
  if (isBunRuntime()) {
    return Bun.password.verify(plain, hash);
  }
  // A Bun-produced (argon2id) hash can't be verified without Bun's native
  // verifier. This should only happen if a user record was created while
  // running under Bun and is later verified while running under Node.
  return false;
}

// Precomputed at first use so login timing doesn't reveal whether an email
// is registered (see requireSecret / auth.functions.ts login handler).
let dummyHashPromise: Promise<string> | null = null;
export function getDummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(crypto.randomBytes(32).toString("hex"));
  }
  return dummyHashPromise;
}

// --- Random tokens ---

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// --- AES-256-GCM encryption for sensitive data at rest ---
// Format: base64(iv[12] || authTag[16] || ciphertext)

export function encryptAtRest(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptAtRest(encoded: string): string {
  const key = getEncryptionKey();
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
