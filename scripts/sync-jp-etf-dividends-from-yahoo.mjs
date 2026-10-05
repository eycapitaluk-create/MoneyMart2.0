/**
 * JP ETF 分配金を Yahoo Finance chart events から取得し
 * src/data/dividendCalendarDetail.generated.json を更新する。
 *
 * 金額・権利落日は Yahoo 実イベントのみ使用（未取得は既存を維持、捏造しない）。
 * 価格は引数 xlsx の終値（実データ）で更新する。
 *
 *   node scripts/sync-jp-etf-dividends-from-yahoo.mjs [/path/to/jp_etf_YYYY-MM-DD.xlsx]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { ETF_LISTED_JA_NAME_MAP } from '../src/data/etfListedJaNameMap.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_FILE = path.join(ROOT, 'src/data/dividendCalendarDetail.generated.json')
const DEFAULT_XLSX = path.join(process.env.HOME || '', 'Downloads/jp_etf_2026-09-24.xlsx')

const AS_OF = '2026-09-25'
const LOOKBACK_DAYS = 365
const SCHEDULE_LOOKBACK_DAYS = 730
const CONCURRENCY = 6
const RETRIES = 3

const round6 = (n) => Math.round(Math.max(0, Number(n) || 0) * 1e6) / 1e6
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadPrices(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath)
  const sh = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sh)
  const bySym = new Map()
  for (const row of rows) {
    const symbol = String(row.symbol || '').trim().toUpperCase()
    const close = Number(row.close)
    if (!symbol || !Number.isFinite(close) || close <= 0) continue
    bySym.set(symbol, close)
  }
  return bySym
}

async function fetchYahooDividends(symbol) {
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&events=div`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&events=div`,
  ]
  let lastError = null
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: 'application/json',
          },
        })
        if (res.status === 429) {
          lastError = new Error('rate limited')
          await sleep(800 * (attempt + 1))
          continue
        }
        if (!res.ok) {
          lastError = new Error(`http ${res.status}`)
          continue
        }
        const json = await res.json()
        const err = json?.chart?.error
        if (err) {
          lastError = new Error(err.description || 'yahoo chart error')
          continue
        }
        const events = json?.chart?.result?.[0]?.events?.dividends || {}
        const rows = Object.values(events)
          .map((d) => {
            const ts = Number(d?.date)
            const amount = Number(d?.amount)
            if (!Number.isFinite(ts) || !Number.isFinite(amount) || amount <= 0) return null
            return {
              date: new Date(ts * 1000).toISOString().slice(0, 10),
              amount: round6(amount),
            }
          })
          .filter(Boolean)
          .sort((a, b) => a.date.localeCompare(b.date))
        return rows
      } catch (error) {
        lastError = error
      }
    }
    await sleep(400 * (attempt + 1))
  }
  throw lastError || new Error('yahoo fetch failed')
}

function summarize(events) {
  if (!events.length) return null
  const fromAnnual = addDays(AS_OF, -LOOKBACK_DAYS)
  const fromSchedule = addDays(AS_OF, -SCHEDULE_LOOKBACK_DAYS)
  const last = events[events.length - 1]
  const trailing = events.filter((e) => e.date > fromAnnual)
  const scheduleSrc = events.filter((e) => e.date > fromSchedule)
  const byMonth = new Map()
  for (const e of scheduleSrc) {
    const month = Number(e.date.slice(5, 7))
    byMonth.set(month, e.amount)
  }
  const dividends = [...byMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, amount]) => ({ month, amount }))
  const annualDividend = round6(trailing.reduce((s, e) => s + e.amount, 0))
  return {
    lastAmount: last.amount,
    lastExDate: last.date,
    annualDividend,
    dividends,
  }
}

function applyYield(rec) {
  const price = Number(rec.price) || 0
  const annual = Number(rec.annualDividend) || 0
  rec.yieldPct = price > 0 && annual > 0 ? round2((annual / price) * 100) : 0
  rec.highYield = rec.yieldPct >= 4
}

async function mapPool(items, worker) {
  const out = new Array(items.length)
  let cursor = 0
  const run = async () => {
    while (cursor < items.length) {
      const i = cursor
      cursor += 1
      out[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run))
  return out
}

async function main() {
  const xlsxPath = process.argv[2] || DEFAULT_XLSX
  if (!fs.existsSync(xlsxPath)) {
    console.error('Missing xlsx:', xlsxPath)
    process.exit(1)
  }

  const prices = loadPrices(xlsxPath)
  const symbols = [...prices.keys()].sort()
  console.log('xlsx', path.basename(xlsxPath), 'symbols', symbols.length)

  const fetched = await mapPool(symbols, async (symbol, i) => {
    if (i && i % 40 === 0) console.log(`yahoo ${i}/${symbols.length}`)
    try {
      const events = await fetchYahooDividends(symbol)
      return { symbol, events, error: null }
    } catch (error) {
      return { symbol, events: [], error: String(error?.message || error) }
    }
  })

  const pack = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'))
  const records = Array.isArray(pack.records) ? pack.records : []
  const bySymbol = new Map(records.map((r) => [r.symbol, r]))

  const stats = {
    priceUpdated: 0,
    dividendUpdated: 0,
    added: 0,
    yahooEmpty: 0,
    yahooError: 0,
    lastExMoved: 0,
  }

  for (const row of fetched) {
    const symbol = row.symbol
    const price = prices.get(symbol)
    const summary = summarize(row.events)
    if (row.error) stats.yahooError += 1
    if (!summary) stats.yahooEmpty += 1

    let rec = bySymbol.get(symbol)
    if (!rec) {
      rec = {
        symbol,
        name: ETF_LISTED_JA_NAME_MAP[symbol] || symbol,
        category: '日本ETF',
        currency: 'JPY',
        price: 0,
        annualDividend: 0,
        yieldPct: 0,
        lastAmount: 0,
        lastExDate: null,
        nextExDate: null,
        dividends: [],
        highYield: false,
      }
      records.push(rec)
      bySymbol.set(symbol, rec)
      stats.added += 1
    }

    if (price > 0 && rec.price !== price) {
      rec.price = price
      stats.priceUpdated += 1
    }
    if (ETF_LISTED_JA_NAME_MAP[symbol]) rec.name = ETF_LISTED_JA_NAME_MAP[symbol]
    rec.category = '日本ETF'
    rec.currency = 'JPY'

    if (summary) {
      if (rec.lastExDate && summary.lastExDate > rec.lastExDate) stats.lastExMoved += 1
      rec.lastAmount = summary.lastAmount
      rec.lastExDate = summary.lastExDate
      rec.annualDividend = summary.annualDividend
      rec.dividends = summary.dividends
      rec.nextExDate = null
      stats.dividendUpdated += 1
    }
    applyYield(rec)
  }

  records.sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)))
  pack.records = records
  pack.recordCount = records.length
  pack.generatedFrom = `${path.basename(xlsxPath)} + Yahoo Finance dividends (${AS_OF})`
  pack.pricesSyncedAt = new Date().toISOString()
  pack.jpEtfYahooDividendsSyncedAt = new Date().toISOString()

  fs.writeFileSync(OUT_FILE, `${JSON.stringify(pack)}\n`, 'utf8')
  console.log('Wrote', OUT_FILE)
  console.log(stats)

  const samples = ['1306.T', '1321.T', '2558.T', '1540.T', '1305.T']
    .map((s) => bySymbol.get(s))
    .filter(Boolean)
  for (const r of samples) {
    console.log(
      r.symbol,
      'px', r.price,
      'last', r.lastAmount,
      r.lastExDate,
      'ann', r.annualDividend,
      'yld', r.yieldPct,
      'months', (r.dividends || []).map((d) => d.month).join('/'),
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
