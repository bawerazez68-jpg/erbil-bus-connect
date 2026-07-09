// In-memory sliding-window rate limiter. Single-process only — fine for a
// single server instance; a multi-instance deployment would need a shared
// store (e.g. Redis) instead of this Map.

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

// Periodic cleanup so the map doesn't grow unbounded from one-off keys
// (e.g. per-IP buckets from clients that never return).
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupIfDue(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (
      bucket.timestamps.length === 0 ||
      now - bucket.timestamps[bucket.timestamps.length - 1] > CLEANUP_INTERVAL_MS
    ) {
      buckets.delete(key);
    }
  }
}

/** Returns true if the request is allowed, false if the caller has exceeded `max` requests within `windowMs`. */
export function consumeRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  cleanupIfDue(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  const windowStart = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= max) {
    return false;
  }
  bucket.timestamps.push(now);
  return true;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
