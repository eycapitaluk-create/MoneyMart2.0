import { getServerEnv, refreshMarketNewsManualFeed } from '../_lib/refresh-market-news.js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const cronSecret = getServerEnv('CRON_SECRET')
  if (!cronSecret) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET is required' })
  }

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== cronSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })
  }

  try {
    const result = await refreshMarketNewsManualFeed()
    return res.status(result.status).json(result.body)
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unexpected error in market-news cron' })
  }
}
