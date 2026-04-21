import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRole) {
    return res.status(500).json({ ok: false, error: 'Missing SUPABASE server env' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' })

  try {
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return res.status(401).json({ ok: false, error: 'Invalid token' })
    }

    const userId = userData.user.id
    const cleanupTables = [
      'user_expenses',
      'user_insurances',
      'user_asset_positions',
      'user_point_accounts',
      'user_finance_profiles',
      'user_owned_stocks',
      'user_owned_funds',
      'user_revolving_profiles',
      'user_revolving_debts',
      'refinance_simulations',
      'user_tax_shield_profiles',
      'tax_shield_simulations',
      'user_cashflow_optimizer_profiles',
      'cashflow_optimizer_simulations',
      'user_watchlists',
      'lounge_posts',
      'lounge_post_likes',
      'lounge_post_bookmarks',
      'lounge_post_comments',
      'community_posts',
      'post_engagements',
    ]

    for (const table of cleanupTables) {
      const { error } = await admin.from(table).delete().eq('user_id', userId)
      if (error && !String(error.message || '').toLowerCase().includes('does not exist')) {
        // best-effort cleanup: continue to account deletion even if one table fails
      }
    }

    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId)
    if (deleteErr) {
      return res.status(500).json({ ok: false, error: deleteErr.message || 'Failed to delete user' })
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Unexpected error' })
  }
}
