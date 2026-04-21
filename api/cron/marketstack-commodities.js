/**
 * MarketStack v2 /commodities → commodity_daily_prices
 * Professional+ plan required. Rate limit: 1 API call per minute.
 * Cron: vercel.json — marketstack-daily와 동일: 화–토 22 UTC (cron 요일 2–6). 월요일·일요일 제외.
 */
import { createClient } from '@supabase/supabase-js'

const COMMODITY_NAMES = ['gold', 'silver', 'copper', 'crude_oil']
const RATE_LIMIT_MS = 65_000

const toDateOnly = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const parsePercentage = (str) => {
  if (str == null || str === '') return null
  const s = String(str).replace(/%/g, '').trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const fetchCommodity = async (key, name) => {
  const url = `https://api.marketstack.com/v2/commodities?access_key=${encodeURIComponent(key)}&commodity_name=${encodeURIComponent(name)}`
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) {
    const msg = json?.detail || json?.error?.message || `HTTP ${res.status}`
    throw new Error(`commodity ${name}: ${msg}`)
  }
  const data = Array.isArray(json?.data) ? json.data : json?.data ? [json.data] : []
  return data[0] || null
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET is required' })
  }
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== cronSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const marketstackKey =
    process.env.MARKETSTACK_ACCESS_KEY ||
    process.env.MARKETSTACK_APIKEY ||
    process.env.MARKETSTACK_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !marketstackKey) {
    return res.status(500).json({
      ok: false,
      error: 'Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MARKETSTACK_ACCESS_KEY',
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const rows = []
  const errors = []

  for (let i = 0; i < COMMODITY_NAMES.length; i++) {
    const name = COMMODITY_NAMES[i]
    try {
      const data = await fetchCommodity(marketstackKey, name)
      if (data) {
        const tradeDate = toDateOnly(data.datetime) || toDateOnly(new Date())
        rows.push({
          commodity_name: name,
          trade_date: tradeDate,
          price: Number(data.commodity_price) || null,
          price_change_day: Number(data.price_change_day) || null,
          percentage_day: parsePercentage(data.percentage_day),
          percentage_week: parsePercentage(data.percentage_week),
          percentage_month: parsePercentage(data.percentage_month),
          percentage_year: parsePercentage(data.percentage_year),
          commodity_unit: data.commodity_unit || null,
          raw: data,
        })
      }
    } catch (e) {
      errors.push(`${name}: ${e.message}`)
    }
    if (i < COMMODITY_NAMES.length - 1) await sleep(RATE_LIMIT_MS)
  }

  if (rows.length === 0) {
    return res.status(200).json({
      ok: true,
      rows_processed: 0,
      error: errors.length ? errors.join('; ') : 'No commodity data (Professional+ plan required)',
    })
  }

  const { error } = await supabase
    .from('commodity_daily_prices')
    .upsert(rows, { onConflict: 'commodity_name,trade_date' })

  if (error) {
    return res.status(500).json({ ok: false, error: error.message })
  }

  return res.status(200).json({
    ok: true,
    rows_processed: rows.length,
    commodities: rows.map((r) => r.commodity_name),
    errors: errors.length ? errors : undefined,
  })
}
