import { createClient } from '@supabase/supabase-js'
import { getServerEnv, refreshMarketNewsManualFeed } from '../_lib/refresh-market-news'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const SUPABASE_URL = getServerEnv('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = getServerEnv('SUPABASE_SERVICE_ROLE_KEY') || getServerEnv('SUPABASE_SECRET_KEY')
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: 'Missing server env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' })

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await adminClient.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ ok: false, error: 'Invalid token' })
  const { data: roleData, error: roleErr } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (roleErr) {
    return res.status(500).json({ ok: false, error: 'Failed to verify role' })
  }
  if (roleData?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Forbidden' })
  }

  try {
    const result = await refreshMarketNewsManualFeed()
    return res.status(result.status).json(result.body)
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unexpected error in refresh-news' })
  }
}
