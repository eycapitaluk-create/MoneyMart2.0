/**
 * Lightweight in-memory rate limits for Vercel serverless.
 * Per-instance only — pair IP-facing routes with Vercel Firewall for hard caps:
 *   - /api/chatbot, /api/news-translate-ja, /api/admin*
 */

const buckets = new Map()

function pruneIfNeeded(store, now) {
  if (store.size < 4000) return
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}

export function getClientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
  if (forwarded) return forwarded
  const real = String(req?.headers?.['x-real-ip'] || '').trim()
  if (real) return real
  return String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || 'unknown')
}

/**
 * Sliding fixed window. Returns { ok, retryAfterSec }.
 */
export function consumeRateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  pruneIfNeeded(buckets, now)
  const max = Math.max(1, Number(limit) || 1)
  const window = Math.max(1000, Number(windowMs) || 60_000)
  const entry = buckets.get(key)
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + window })
    return { ok: true, remaining: max - 1, retryAfterSec: Math.ceil(window / 1000) }
  }
  if (entry.count >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    }
  }
  entry.count += 1
  return { ok: true, remaining: max - entry.count, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
}

export function jstDayKey(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(now)
}

/** User-scoped daily quota (JST calendar day). */
export function consumeUserDailyLimit(userId, bucket, limit) {
  const uid = String(userId || '').trim()
  if (!uid) return { ok: false, retryAfterSec: 3600 }
  const day = jstDayKey()
  return consumeRateLimit(`daily:${bucket}:${day}:${uid}`, {
    limit,
    windowMs: 36 * 60 * 60 * 1000,
  })
}

export function consumeIpRateLimit(req, bucket, { limit, windowMs }) {
  const ip = getClientIp(req)
  return consumeRateLimit(`ip:${bucket}:${ip}`, { limit, windowMs })
}

export function sendRateLimitJson(res, retryAfterSec, message) {
  res.statusCode = 429
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Retry-After', String(Math.max(1, Number(retryAfterSec) || 60)))
  res.end(JSON.stringify({
    ok: false,
    error: message || 'リクエストが多すぎます。しばらくしてから再度お試しください。',
    code: 'rate_limited',
  }))
}
