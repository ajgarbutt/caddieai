/**
 * TEMPORARY MVP rate limiting — in-memory only.
 * This does NOT work reliably across multiple Vercel serverless instances or cold starts.
 * Replace with Redis, Vercel KV, or Upstash before production scale.
 */
const WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 30

const buckets = new Map()

function pruneExpired(now) {
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) buckets.delete(key)
  }
}

export function checkRateLimit(key) {
  const now = Date.now()
  pruneExpired(now)

  const bucketKey = key || 'unknown'
  const existing = buckets.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  existing.count += 1
  return { allowed: true }
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'
}
