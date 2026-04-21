import { createClient } from '@supabase/supabase-js'
import { ETF_LIST_FROM_XLSX } from '../src/data/etfListFromXlsx.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const MARKETSTACK_KEY =
  process.env.MARKETSTACK_ACCESS_KEY ||
  process.env.MARKETSTACK_APIKEY ||
  process.env.MARKETSTACK_API_KEY ||
  process.env.VITE_MARKETSTACK_ACCESS_KEY

const MAX_PRICE = 10_000_000
const MAX_VOLUME = 1_000_000_000_000

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const toDateOnly = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const normalizePriceNumber = (value, { min = 0.000001, max = MAX_PRICE } = {}) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n < min || n > max) return null
  return n
}

const normalizeVolumeNumber = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n < 0 || n > MAX_VOLUME) return null
  return Math.round(n)
}

const getJson = async (url, init) => {
  const res = await fetch(url, init)
  const json = await res.json()
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Request failed: ${res.status}`)
  }
  return json
}

const fetchHistoryRows = async ({ key, symbol, dateFrom, dateTo }) => {
  const encodedKey = encodeURIComponent(key)
  const encodedSymbol = encodeURIComponent(symbol)
  const encodedDateFrom = encodeURIComponent(dateFrom)
  const encodedDateTo = encodeURIComponent(dateTo)

  const runAttempt = async ({ version, authMode }) => {
    const useHeaderAuth = authMode === 'header'
    const authQuery = useHeaderAuth ? '' : `access_key=${encodedKey}&`
    const init = useHeaderAuth ? { headers: { apikey: key } } : undefined
    const rows = []
    let offset = 0
    const limit = 1000

    while (true) {
      const url = `https://api.marketstack.com/${version}/eod?${authQuery}symbols=${encodedSymbol}&date_from=${encodedDateFrom}&date_to=${encodedDateTo}&sort=ASC&limit=${limit}&offset=${offset}`
      const json = await getJson(url, init)
      const batch = Array.isArray(json?.data) ? json.data : []
      rows.push(...batch)
      const total = Number(json?.pagination?.total || 0)
      const count = Number(json?.pagination?.count || batch.length)
      if (count === 0 || rows.length >= total || batch.length === 0) break
      offset += limit
    }

    return { endpoint: `${version}:${authMode}`, rows }
  }

  const attempts = [
    { version: 'v2', authMode: 'query' },
    { version: 'v2', authMode: 'header' },
  ]
  const errors = []
  for (const attempt of attempts) {
    try {
      return await runAttempt(attempt)
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase()
      errors.push(`${attempt.version}/${attempt.authMode}: ${e.message}`)
      if (msg.includes('not available in the v1 endpoint')) continue
      if (msg.includes('access key') || msg.includes('apikey') || msg.includes('invalid')) continue
    }
  }
  throw new Error(`Failed ${symbol}: ${errors.join(' | ')}`)
}

const run = async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY || !MARKETSTACK_KEY) {
    throw new Error('Missing env. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(or SUPABASE_SECRET_KEY), MARKETSTACK_ACCESS_KEY')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const allSymbols = ETF_LIST_FROM_XLSX.map((x) => x.symbol)
  const metaMap = new Map(ETF_LIST_FROM_XLSX.map((x) => [x.symbol, x]))

  const existingLatestRows = []
  for (const batch of chunk(allSymbols, 80)) {
    const { data, error } = await supabase
      .from('v_stock_latest')
      .select('symbol')
      .in('symbol', batch)
    if (error) throw error
    existingLatestRows.push(...(data || []))
  }

  const existingSet = new Set(existingLatestRows.map((r) => r.symbol))
  const missingSymbols = allSymbols.filter((symbol) => !existingSet.has(symbol))

  console.log(`ETF total=${allSymbols.length}`)
  console.log(`Already in v_stock_latest=${existingSet.size}`)
  console.log(`Missing latest=${missingSymbols.length}`)
  if (missingSymbols.length === 0) return

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const dateFrom = cutoff.toISOString().slice(0, 10)
  const dateTo = new Date().toISOString().slice(0, 10)

  let success = 0
  let failed = 0
  const failures = []
  const endpointUsage = {}

  for (const symbol of missingSymbols) {
    try {
      const { endpoint, rows } = await fetchHistoryRows({
        key: MARKETSTACK_KEY,
        symbol,
        dateFrom,
        dateTo,
      })
      endpointUsage[endpoint] = (endpointUsage[endpoint] || 0) + 1

      const meta = metaMap.get(symbol) || {}
      const symbolRows = [{
        symbol,
        name: meta.jpName || null,
        exchange: 'TSE',
        currency: 'JPY',
        is_active: true,
      }]

      const priceRows = rows
        .map((r) => {
          const tradeDate = toDateOnly(r?.date)
          const close = normalizePriceNumber(r?.close)
          if (!tradeDate || close == null) return null
          return {
            source: 'marketstack',
            symbol,
            trade_date: tradeDate,
            open: normalizePriceNumber(r?.open),
            high: normalizePriceNumber(r?.high),
            low: normalizePriceNumber(r?.low),
            close,
            volume: normalizeVolumeNumber(r?.volume),
            raw: r,
          }
        })
        .filter(Boolean)

      if (symbolRows.length > 0) {
        const { error: upsertSymbolErr } = await supabase
          .from('stock_symbols')
          .upsert(symbolRows, { onConflict: 'symbol' })
        if (upsertSymbolErr) throw upsertSymbolErr
      }

      if (priceRows.length > 0) {
        const { error: upsertPriceErr } = await supabase
          .from('stock_daily_prices')
          .upsert(priceRows, { onConflict: 'source,symbol,trade_date' })
        if (upsertPriceErr) throw upsertPriceErr
      }

      success += 1
      console.log(`[${success + failed}/${missingSymbols.length}] ${symbol} rows=${priceRows.length}`)
    } catch (e) {
      failed += 1
      failures.push({ symbol, error: e.message })
      console.log(`[${success + failed}/${missingSymbols.length}] ${symbol} FAILED: ${e.message}`)
    }
  }

  console.log('--- Missing ETF fetch summary ---')
  console.log(`success=${success}, failed=${failed}, attempted=${missingSymbols.length}`)
  console.log(`endpointUsage=${JSON.stringify(endpointUsage)}`)
  if (failures.length > 0) {
    console.log(`failedSymbols=${failures.map((x) => x.symbol).join(',')}`)
  }
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
