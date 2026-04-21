import { createClient } from '@supabase/supabase-js'
import { ETF_SYMBOLS_FROM_XLSX } from '../src/data/etfListFromXlsx.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const MARKETSTACK_KEY =
  process.env.MARKETSTACK_ACCESS_KEY ||
  process.env.MARKETSTACK_APIKEY ||
  process.env.MARKETSTACK_API_KEY
const MAX_PRICE = 10_000_000
const MAX_VOLUME = 1_000_000_000_000

const toDateOnly = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const getJson = async (url, init) => {
  const res = await fetch(url, init)
  const json = await res.json()
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Request failed: ${res.status}`)
  }
  return json
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
    // Most paid plans expose richer EOD data on v2.
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
  const etfSet = new Set(ETF_SYMBOLS_FROM_XLSX)

  const existingLatestRows = []
  const symbolBatches = chunk(ETF_SYMBOLS_FROM_XLSX, 80)
  for (const batch of symbolBatches) {
    const { data, error } = await supabase
      .from('v_stock_latest')
      .select('symbol')
      .in('symbol', batch)
    if (error) throw error
    existingLatestRows.push(...(data || []))
  }
  const targetSymbols = [...new Set(existingLatestRows.map((r) => r.symbol).filter((s) => etfSet.has(s)))]
  if (targetSymbols.length === 0) {
    console.log('No ETF symbols found in v_stock_latest.')
    return
  }

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const dateFrom = cutoff.toISOString().slice(0, 10)
  const dateTo = new Date().toISOString().slice(0, 10)

  const missing = []
  for (const symbol of targetSymbols) {
    const { count, error } = await supabase
      .from('stock_daily_prices')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'marketstack')
      .eq('symbol', symbol)
      .gte('trade_date', dateFrom)
    if (error) throw error
    if ((count || 0) < 80) missing.push({ symbol, count: count || 0 })
  }

  console.log(`Target ETF in latest: ${targetSymbols.length}`)
  console.log(`Need backfill (<80 rows / 1y): ${missing.length}`)
  if (missing.length === 0) return

  const onlySymbols = (process.env.BACKFILL_ONLY_SYMBOLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const maxSymbols = Number(process.env.BACKFILL_MAX_SYMBOLS || 0)
  let workItems = missing
  if (onlySymbols.length > 0) {
    const onlySet = new Set(onlySymbols)
    workItems = missing.filter((m) => onlySet.has(m.symbol))
  }
  if (Number.isFinite(maxSymbols) && maxSymbols > 0) {
    workItems = workItems.slice(0, Math.floor(maxSymbols))
  }
  console.log(`Backfill run scope: ${workItems.length}`)
  if (workItems.length === 0) return

  let done = 0
  let failed = 0
  const failures = []
  const endpoints = {}

  for (const item of workItems) {
    const symbol = item.symbol
    try {
      const { endpoint, rows } = await fetchHistoryRows({
        key: MARKETSTACK_KEY,
        symbol,
        dateFrom,
        dateTo,
      })
      endpoints[endpoint] = (endpoints[endpoint] || 0) + 1

      const symbolRows = []
      const priceRows = []
      for (const r of rows) {
        const tradeDate = toDateOnly(r?.date)
        const rowSymbol = r?.symbol || r?.ticker || symbol
        if (!tradeDate || !rowSymbol) continue
        symbolRows.push({
          symbol: rowSymbol,
          name: r?.name || null,
          exchange: r?.exchange || null,
          currency: r?.currency || null,
          is_active: true,
        })
        const close = normalizePriceNumber(r?.close)
        if (close == null) continue
        priceRows.push({
          source: 'marketstack',
          symbol: rowSymbol,
          trade_date: tradeDate,
          open: normalizePriceNumber(r?.open),
          high: normalizePriceNumber(r?.high),
          low: normalizePriceNumber(r?.low),
          close,
          volume: normalizeVolumeNumber(r?.volume),
          raw: r,
        })
      }

      const symbolDedupMap = new Map()
      for (const row of symbolRows) symbolDedupMap.set(row.symbol, row)
      const dedupSymbolRows = [...symbolDedupMap.values()]

      const priceDedupMap = new Map()
      for (const row of priceRows) {
        const key = `${row.source}|${row.symbol}|${row.trade_date}`
        priceDedupMap.set(key, row)
      }
      const dedupPriceRows = [...priceDedupMap.values()]

      if (dedupSymbolRows.length > 0) {
        const { error: upsertSymbolErr } = await supabase
          .from('stock_symbols')
          .upsert(dedupSymbolRows, { onConflict: 'symbol' })
        if (upsertSymbolErr) throw upsertSymbolErr
      }
      if (dedupPriceRows.length > 0) {
        const { error: upsertPriceErr } = await supabase
          .from('stock_daily_prices')
          .upsert(dedupPriceRows, { onConflict: 'source,symbol,trade_date' })
        if (upsertPriceErr) throw upsertPriceErr
      }

      done += 1
      console.log(`[${done}/${workItems.length}] ${symbol} backfilled rows=${dedupPriceRows.length}`)
    } catch (e) {
      failed += 1
      failures.push({ symbol, error: e.message })
      console.log(`[${done + failed}/${workItems.length}] ${symbol} FAILED: ${e.message}`)
    }
  }

  console.log('--- Backfill summary ---')
  console.log(`success=${done}, failed=${failed}, attempted=${workItems.length}`)
  console.log(`endpoint_usage=${JSON.stringify(endpoints)}`)
  if (failures.length > 0) {
    console.log(`failed_symbols=${failures.map((f) => f.symbol).join(',')}`)
  }
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
