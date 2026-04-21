#!/usr/bin/env node
/**
 * Marketstack EOD 구간 → Supabase stock_symbols + stock_daily_prices (source=marketstack)
 *
 * Usage:
 *   node scripts/backfill-stock-eod-range.mjs GEV 2025-03-31 2026-03-31   # date_from, date_to
 *   node scripts/backfill-stock-eod-range.mjs GEV 2026-03-31              # 종료일만 → 시작=종료 366일 전
 *   node scripts/backfill-stock-eod-range.mjs GEV                         # 종료=오늘(UTC), 시작=366일 전
 *
 * Env: MARKETSTACK_ACCESS_KEY (또는 MARKETSTACK_API_KEY), SUPABASE_URL, SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY
 * 로컬: .env.local 자동 로드 (run-marketstack-one-symbol.mjs 와 동일)
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

const MARKETSTACK_KEY =
  process.env.MARKETSTACK_ACCESS_KEY ||
  process.env.MARKETSTACK_APIKEY ||
  process.env.MARKETSTACK_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const MAX_PRICE = 10_000_000
const MAX_VOLUME = 1_000_000_000_000
const UPSERT_BATCH = 400

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

const toDateOnly = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

async function fetchEodPage({ symbol, dateFrom, dateTo, limit, offset, version, useHeaderAuth }) {
  const encSym = encodeURIComponent(symbol)
  const key = MARKETSTACK_KEY
  const base = `https://api.marketstack.com/${version}/eod`
  const query = useHeaderAuth
    ? `symbols=${encSym}&date_from=${dateFrom}&date_to=${dateTo}&limit=${limit}&offset=${offset}&sort=ASC`
    : `access_key=${encodeURIComponent(key)}&symbols=${encSym}&date_from=${dateFrom}&date_to=${dateTo}&limit=${limit}&offset=${offset}&sort=ASC`
  const url = `${base}?${query}`
  const init = useHeaderAuth ? { headers: { apikey: key } } : undefined
  const res = await fetch(url, init)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error?.message || `HTTP ${res.status}`)
  }
  if (json?.error) {
    throw new Error(json.error.message || 'marketstack error')
  }
  return json
}

async function fetchAllEod(symbol, dateFrom, dateTo) {
  const limit = 1000
  let offset = 0
  const all = []
  const attempts = [
    { version: 'v2', useHeaderAuth: false },
    { version: 'v2', useHeaderAuth: true },
  ]
  let lastErr = null
  for (const att of attempts) {
    try {
      offset = 0
      all.length = 0
      while (true) {
        const json = await fetchEodPage({
          symbol,
          dateFrom,
          dateTo,
          limit,
          offset,
          version: att.version,
          useHeaderAuth: att.useHeaderAuth,
        })
        const rows = Array.isArray(json?.data) ? json.data : []
        all.push(...rows)
        const total = Number(json?.pagination?.total)
        if (rows.length < limit) break
        if (Number.isFinite(total) && all.length >= total) break
        offset += limit
        await new Promise((r) => setTimeout(r, 250))
      }
      if (all.length > 0) return { rows: all, mode: `${att.version}:${att.useHeaderAuth ? 'header' : 'query'}` }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('No EOD rows')
}

function parseArgs() {
  const argv = process.argv.slice(2)
  const symbol = (argv[0] || 'GEV').toUpperCase().trim()
  let dateFrom = ''
  let dateTo = ''
  if (argv.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(argv[1]) && /^\d{4}-\d{2}-\d{2}$/.test(argv[2])) {
    dateFrom = argv[1]
    dateTo = argv[2]
  } else if (argv.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(argv[1])) {
    dateTo = argv[1]
    const end = new Date(`${dateTo}T12:00:00Z`)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - 366)
    dateFrom = start.toISOString().slice(0, 10)
  } else {
    const end = new Date()
    dateTo = end.toISOString().slice(0, 10)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - 366)
    dateFrom = start.toISOString().slice(0, 10)
  }
  return { symbol, dateFrom, dateTo }
}

async function main() {
  if (!MARKETSTACK_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing env: MARKETSTACK_ACCESS_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY (or SERVICE_ROLE)')
    process.exit(1)
  }
  const { symbol, dateFrom, dateTo } = parseArgs()
  console.log(`Symbol ${symbol}  ${dateFrom} … ${dateTo}`)

  const { rows, mode } = await fetchAllEod(symbol, dateFrom, dateTo)
  console.log(`Fetched ${rows.length} EOD rows (${mode})`)
  if (rows.length === 0) {
    console.error('No data — check symbol/plan/date range.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const last = rows[rows.length - 1]
  const symRow = {
    symbol,
    name: last?.name || symbol,
    exchange: last?.exchange || 'XNYS',
    currency: last?.currency || 'USD',
    is_active: true,
  }
  const { error: symErr } = await supabase.from('stock_symbols').upsert(symRow, { onConflict: 'symbol' })
  if (symErr) throw symErr

  const priceRows = []
  const dropped = []
  for (const r of rows) {
    const tradeDate = toDateOnly(r?.date)
    const rawClose = r?.marketstack_last ?? r?.last ?? r?.close ?? r?.mid
    const close = normalizePriceNumber(rawClose)
    if (!tradeDate || close == null) {
      dropped.push(r)
      continue
    }
    priceRows.push({
      source: 'marketstack',
      symbol,
      trade_date: tradeDate,
      open: normalizePriceNumber(r?.open),
      high: normalizePriceNumber(r?.high),
      low: normalizePriceNumber(r?.low),
      close,
      volume: normalizeVolumeNumber(r?.volume),
      raw: r,
    })
  }
  if (dropped.length) console.warn(`Dropped ${dropped.length} rows (missing date/close)`)

  for (let i = 0; i < priceRows.length; i += UPSERT_BATCH) {
    const batch = priceRows.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase
      .from('stock_daily_prices')
      .upsert(batch, { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
    console.log(`Upserted prices ${i + batch.length}/${priceRows.length}`)
  }

  console.log('Done. stock_symbols + stock_daily_prices updated. US cron은 stockList400 기준으로 GEV 포함.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
