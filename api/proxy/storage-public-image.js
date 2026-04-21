/**
 * GET/HEAD /api/proxy/storage-public-image?bucket=...&path=...
 * Supabase Storage の公開オブジェクトを同一オリジン経由で配信し、ブラウザ上の img src にプロジェクトURLを直書きしない。
 * 許可バケットのみ。path に .. やバックスラッシュは拒否。
 */

const ALLOWED_BUCKETS = new Set(['news_page_manual', 'news-images'])

function sanitizeBucket(raw) {
  const b = String(raw || '').trim()
  if (!b || b.length > 200) return null
  if (!/^[a-zA-Z0-9._-]+$/.test(b)) return null
  if (!ALLOWED_BUCKETS.has(b)) return null
  return b
}

function sanitizeObjectPath(raw) {
  const p = String(raw || '').trim()
  if (!p || p.length > 2000) return null
  const decoded = (() => {
    try {
      return decodeURIComponent(p)
    } catch {
      return null
    }
  })()
  if (!decoded) return null
  const norm = decoded.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!norm || norm.includes('..')) return null
  return norm
}

function buildUpstreamUrl(base, bucket, objectPath) {
  const root = String(base || '').replace(/\/$/, '')
  const segments = objectPath.split('/').filter(Boolean).map((seg) => encodeURIComponent(seg)).join('/')
  return `${root}/storage/v1/object/public/${encodeURIComponent(bucket)}/${segments}`
}

export default async function handler(req, res) {
  const method = req.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET, HEAD')
    res.end()
    return
  }

  let bucket
  let objectPath
  try {
    const u = new URL(req.url || '/', 'http://localhost')
    bucket = sanitizeBucket(u.searchParams.get('bucket'))
    objectPath = sanitizeObjectPath(u.searchParams.get('path'))
  } catch {
    bucket = null
    objectPath = null
  }

  if (!bucket || !objectPath) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Bad request')
    return
  }

  const base = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  if (!base) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Storage proxy not configured')
    return
  }

  const upstream = buildUpstreamUrl(base, bucket, objectPath)

  try {
    const upstreamRes = await fetch(upstream, {
      method,
      redirect: 'follow',
      headers: {
        Accept: '*/*',
      },
    })

    res.statusCode = upstreamRes.status
    const ct = upstreamRes.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('Content-Type', ct)
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    if (method === 'HEAD') {
      res.end()
      return
    }

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '')
      res.end(text || '')
      return
    }

    const buf = Buffer.from(await upstreamRes.arrayBuffer())
    res.end(buf)
  } catch (err) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(String(err?.message || 'Upstream error'))
  }
}
