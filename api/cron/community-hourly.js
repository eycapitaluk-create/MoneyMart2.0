/**
 * GET/POST /api/cron/community-hourly
 *
 * Bearer CRON_SECRET — hourly community posts / comments / likes (JST 05–22).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
 * Optional: COMMUNITY_HOURLY_SEED_ENABLED=false to disable
 */
import { createClient } from '@supabase/supabase-js'
import { runCommunityHourlySeed } from '../_lib/community-hourly-seed.js'

function getServerEnv(name) {
  return String(process.env[name] ?? '').trim()
}

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

  const supabaseUrl = getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL')
  const supabaseKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY') || getServerEnv('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase service credentials missing' })
  }

  const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  try {
    const result = await runCommunityHourlySeed(admin, { now: new Date(), dryRun: false })
    return res.status(200).json(result)
  } catch (err) {
    console.error('[community-hourly]', err)
    return res.status(500).json({ ok: false, error: err.message || 'community-hourly failed' })
  }
}
