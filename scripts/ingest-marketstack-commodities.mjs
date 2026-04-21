/**
 * MarketStack v2 /commodities → commodity_daily_prices
 * Professional+ plan required. Rate limit: 1 API call per minute.
 * Run: node scripts/ingest-marketstack-commodities.mjs
 * Loads .env.local / .env automatically.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const loadEnv = () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const p = resolve(process.cwd(), f)
      const content = readFileSync(p, 'utf8')
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/)
        if (m && !process.env[m[1].trim()]) {
          process.env[m[1].trim()] = m[2].replace(/^["']|["']$/g, '').trim()
        }
      }
    } catch {
      /* ignore */
    }
  }
}
loadEnv()

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
    throw new Error(`${msg}`)
  }
  const data = Array.isArray(json?.data) ? json.data : json?.data ? [json.data] : []
  return data[0] || null
}

const run = async () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  const marketstackKey =
    process.env.MARKETSTACK_ACCESS_KEY ||
    process.env.MARKETSTACK_APIKEY ||
    process.env.MARKETSTACK_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !marketstackKey) {
    throw new Error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MARKETSTACK_ACCESS_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const rows = []

  console.log('Fetching commodities (1 req/min)...')
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
        console.log(`  ✓ ${name}`)
      }
    } catch (e) {
      console.warn(`  ✗ ${name}: ${e.message}`)
    }
    if (i < COMMODITY_NAMES.length - 1) await sleep(RATE_LIMIT_MS)
  }

  if (rows.length === 0) {
    console.log('No data. Check plan: Professional+ required.')
    process.exit(0)
  }

  const { error } = await supabase
    .from('commodity_daily_prices')
    .upsert(rows, { onConflict: 'commodity_name,trade_date' })

  if (error) throw error
  console.log(`Done. Upserted ${rows.length} rows.`)
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
