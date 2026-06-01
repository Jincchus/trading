interface Bucket {
  count: number
  resetAt: number
}

/**
 * In-memory fixed-window rate limiter. Sweeps expired buckets on each call so
 * the backing map cannot grow unbounded. Single-process only — use a shared
 * store (e.g. Redis) if running multiple instances.
 */
export function createRateLimiter(max: number, windowMs: number) {
  const buckets = new Map<string, Bucket>()
  return {
    /** Returns true if the key is rate-limited (over the threshold). */
    check(key: string, now: number = Date.now()): boolean {
      for (const [k, b] of buckets) {
        if (now > b.resetAt) buckets.delete(k)
      }
      const bucket = buckets.get(key)
      if (!bucket || now > bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs })
        return false
      }
      if (bucket.count >= max) return true
      bucket.count++
      return false
    },
    get size() {
      return buckets.size
    },
  }
}

/**
 * Resolves the client IP. Takes the leftmost (original client) entry of
 * X-Forwarded-For, falling back to X-Real-IP, then 'unknown'. Note: trust this
 * only when behind a proxy that overwrites X-Forwarded-For.
 */
export function clientIp(forwardedFor: string | null, realIp: string | null): string {
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  if (realIp) {
    const trimmed = realIp.trim()
    if (trimmed) return trimmed
  }
  return 'unknown'
}
