/**
 * USD/JPY daily rates from fx_daily_usdjpy only.
 * A missing row or a database error stays on that result.
 */

import { readFxDaily } from './_lib/fxYahooSync.js'
import { getFxSupabaseAdmin } from './_lib/fx-usdjpy-db.js'
import { toIsoDate } from './_lib/fx-usdjpy-providers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const date = toIsoDate(req.query.date)
  const start = toIsoDate(req.query.start_date || req.query.start)
  const end = toIsoDate(req.query.end_date || req.query.end)
  try {
    const result = await readFxDaily(getFxSupabaseAdmin(), { date, start, end })
    return res.status(result.status).json(result.body)
  } catch (e) {
    console.error('fx api error', e)
    return res.status(500).json({ error: 'FX database read failed' })
  }
}
