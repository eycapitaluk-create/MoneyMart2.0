import { ingestFxRates } from '../_lib/fx-rates.js'

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (token !== cronSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      ok: false,
      error: 'Missing env. Required: SUPABASE_URL and SUPABASE_SECRET_KEY(or SUPABASE_SERVICE_ROLE_KEY)',
    })
  }

  try {
    const result = await ingestFxRates({ supabaseUrl, serviceRoleKey })
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message })
  }
}
