/**
 * 価格xlsxの銘柄リストについて、Yahoo Finance の実配当イベントで
 * dividendCalendarDetail + dividendStockUniverse の配当金・配当月を更新する。
 * 価格はxlsx終値。配当金額はYahooイベントのみ（未取得は捏造しない）。
 *
 *   node scripts/sync-listed-dividends-from-yahoo.mjs us.xlsx jp.xlsx
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { ETF_LISTED_JA_NAME_MAP } from '../src/data/etfListedJaNameMap.js'
import { isRetiredStockSymbol } from '../src/lib/retiredStockSymbols.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DETAIL_PATH = path.join(ROOT, 'src/data/dividendCalendarDetail.generated.json')
const UNIVERSE_PATH = path.join(ROOT, 'src/data/dividendStockUniverse.js')
const AS_OF = '2026-09-25'
const CONCURRENCY = 7
const RETRIES = 3

const round6 = (n) => Math.round(Math.max(0, Number(n) || 0) * 1e6) / 1e6
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const aliases = (symbol) => {
  const s = String(symbol || '').trim().toUpperCase()
  const out = new Set([s])
  if (s === 'BRK-B' || s === 'BRK/B') out.add('BRK.B')
  if (s === 'BRK.B') out.add('BRK-B')
  if (s === 'BF-B' || s === 'BF/B') out.add('BF.B')
  if (s === 'BF.B') out.add('BF-B')
  return [...out]
}

const canonicalSymbol = (symbol) => {
  const s = String(symbol || '').trim().toUpperCase()
  if (s === 'BRK-B' || s === 'BRK/B') return 'BRK.B'
  if (s === 'BF-B' || s === 'BF/B') return 'BF.B'
  return s
}

const yahooSymbol = (symbol) => {
  const s = String(symbol || '').trim().toUpperCase()
  if (s === 'BRK.B') return 'BRK-B'
  if (s === 'BF.B') return 'BF-B'
  return s
}

function loadPrices(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
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
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&events=div,split`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&events=div,split`,
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
          await sleep(900 * (attempt + 1))
          continue
        }
        if (!res.ok) {
          lastError = new Error(`http ${res.status}`)
          continue
        }
        const json = await res.json()
        if (json?.chart?.error) {
          lastError = new Error(json.chart.error.description || 'yahoo error')
          continue
        }
        const result = json?.chart?.result?.[0]
        const events = result?.events?.dividends || {}
        const rows = Object.values(events)
          .map((d) => {
            const ts = Number(d?.date)
            const amount = Number(d?.amount)
            if (!Number.isFinite(ts) || !Number.isFinite(amount) || amount <= 0) return null
            return { date: new Date(ts * 1000).toISOString().slice(0, 10), amount: round6(amount) }
          })
          .filter(Boolean)
          .sort((a, b) => a.date.localeCompare(b.date))
        return { events: rows, name: result?.meta?.shortName || result?.meta?.longName || '' }
      } catch (error) {
        lastError = error
      }
    }
    await sleep(400 * (attempt + 1))
  }
  throw lastError || new Error('yahoo fetch failed')
}

function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

function median(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

function summarize(events) {
  if (!events.length) return { empty: true }
  const last = events[events.length - 1]
  const fromSchedule = addDays(AS_OF, -800)
  const recent = events.filter((e) => e.date >= fromSchedule)
  const gaps = []
  for (let i = 1; i < events.length; i += 1) gaps.push(monthsBetween(events[i - 1].date, events[i].date))
  const irregularSpecialOnly =
    events.length <= 5 &&
    gaps.length > 0 &&
    gaps.every((g) => g >= 8)

  if (irregularSpecialOnly) {
    return {
      empty: false,
      lastAmount: last.amount,
      lastExDate: last.date,
      annualDividend: 0,
      dividends: [],
      specialOnly: true,
    }
  }

  const amounts = recent.map((e) => e.amount)
  const med = median(amounts)
  const isOutlier = (e) => med > 0 && e.amount > med * 2.5 && amounts.filter((a) => a !== e.amount).length >= 2
  const cadenceGaps = []
  for (let i = 1; i < recent.length; i += 1) cadenceGaps.push(monthsBetween(recent[i - 1].date, recent[i].date))
  const gap = median(cadenceGaps)
  let picked = recent
  if (recent.length >= 8 && gap > 0 && gap <= 1.5) {
    picked = recent
  } else if (recent.length >= 3 && gap >= 2 && gap <= 5) {
    picked = recent.slice(-4)
  } else if (recent.length >= 2 && gap >= 5 && gap <= 8) {
    picked = recent.slice(-2)
  } else if (recent.length >= 1 && gap >= 9) {
    picked = recent.slice(-1)
  }
  const monthSet = [...new Set(picked.map((e) => Number(e.date.slice(5, 7))))]
  const dividends = monthSet
    .sort((a, b) => a - b)
    .map((month) => {
      const inMonth = recent.filter((e) => Number(e.date.slice(5, 7)) === month)
      const regulars = inMonth.filter((e) => !isOutlier(e))
      const chosen = regulars.at(-1) || inMonth.at(-1)
      return { month, amount: chosen.amount }
    })
    .filter((d) => Number.isFinite(d.month) && Number(d.amount) > 0)
  return {
    empty: false,
    lastAmount: last.amount,
    lastExDate: last.date,
    annualDividend: round6(dividends.reduce((s, d) => s + d.amount, 0)),
    dividends,
    specialOnly: false,
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

function findRec(bySymbol, symbol) {
  for (const key of aliases(symbol)) {
    if (bySymbol.has(key)) return bySymbol.get(key)
  }
  return null
}

function readUniverseRows() {
  const src = fs.readFileSync(UNIVERSE_PATH, 'utf8')
  const start = src.indexOf('export const DIVIDEND_STOCK_UNIVERSE = [')
  const end = src.indexOf('\n]', start)
  if (start < 0 || end < 0) throw new Error('universe array bounds not found')
  const arrSrc = src.slice(start + 'export const DIVIDEND_STOCK_UNIVERSE = '.length, end + 2)
  const rows = Function(`"use strict"; return (${arrSrc})`)()
  if (!Array.isArray(rows)) throw new Error('universe parse failed')
  return rows
}

function writeUniverse(rows) {
  const src = fs.readFileSync(UNIVERSE_PATH, 'utf8')
  const start = src.indexOf('export const DIVIDEND_STOCK_UNIVERSE = [')
  const end = src.indexOf('\n]', start)
  if (start < 0 || end < 0) throw new Error('universe array bounds not found')
  const body = rows.map((r) => {
    const o = {
      symbol: r.symbol,
      name: r.name,
      region: r.region,
      sector: r.sector,
      indexTag: r.indexTag,
      dividendMonths: r.dividendMonths || [],
    }
    if (r.dividendAmountPerShare != null && Number(r.dividendAmountPerShare) > 0) {
      o.dividendAmountPerShare = r.dividendAmountPerShare
    }
    return `  ${JSON.stringify(o)}`
  }).join(',\n')
  const next = `${src.slice(0, start)}export const DIVIDEND_STOCK_UNIVERSE = [\n${body}\n]${src.slice(end + 2)}`
  fs.writeFileSync(UNIVERSE_PATH, next)
}

async function main() {
  const paths = process.argv.slice(2)
  if (!paths.length) {
    paths.push(
      path.join(process.env.HOME || '', 'Downloads/us_prices_all_2026-09-24.xlsx'),
      path.join(process.env.HOME || '', 'Downloads/jp_prices_2026-09-24.xlsx'),
    )
  }

  const jobs = []
  for (const p of paths) {
    if (!fs.existsSync(p)) {
      console.error('Missing', p)
      process.exit(1)
    }
    const prices = loadPrices(p)
    const market = /jp_/i.test(path.basename(p)) ? 'JP' : 'US'
    for (const [symbol, price] of prices) {
      const canon = canonicalSymbol(symbol)
      jobs.push({
        symbol: canon,
        fetchSymbol: yahooSymbol(symbol),
        price,
        market,
        file: path.basename(p),
      })
    }
  }
  const uniq = new Map()
  for (const job of jobs) uniq.set(job.symbol, job)
  const list = [...uniq.values()]
  console.log('symbols', list.length)

  const fetched = await mapPool(list, async (job, i) => {
    if (i && i % 50 === 0) console.log(`yahoo ${i}/${list.length}`)
    try {
      const data = await fetchYahooDividends(job.fetchSymbol || job.symbol)
      return { ...job, ...data, error: null }
    } catch (error) {
      return { ...job, events: [], name: '', error: String(error?.message || error) }
    }
  })

  const pack = JSON.parse(fs.readFileSync(DETAIL_PATH, 'utf8'))
  const records = pack.records
  const bySymbol = new Map(records.map((r) => [r.symbol, r]))
  const stats = { price: 0, div: 0, added: 0, empty: 0, err: 0, lastExMoved: 0, universe: 0 }

  for (const row of fetched) {
    if (row.error) stats.err += 1
    const summary = summarize(row.events || [])
    if (summary.empty) stats.empty += 1
    let rec = findRec(bySymbol, row.symbol)
    if (rec?.category === '日本ETF') {
      continue
    }
    if (!rec) {
      rec = {
        symbol: row.symbol,
        name: ETF_LISTED_JA_NAME_MAP[row.symbol] || row.name || row.symbol,
        category: row.market === 'JP' ? '日本株' : '米国株',
        currency: row.market === 'JP' ? 'JPY' : 'USD',
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
      bySymbol.set(rec.symbol, rec)
      stats.added += 1
    }
    if (row.price > 0 && rec.price !== row.price) {
      rec.price = row.price
      stats.price += 1
    }
    if (row.market === 'JP') rec.category = rec.category === '日本ETF' ? '日本ETF' : '日本株'
    const hasJa = /[\u3040-\u30ff\u4e00-\u9fff]/.test(String(rec.name || ''))
    if (row.name && (!rec.name || rec.name === rec.symbol) && !hasJa) rec.name = row.name
    if (isRetiredStockSymbol(row.symbol)) {
      rec.annualDividend = 0
      rec.dividends = []
      rec.nextExDate = null
      applyYield(rec)
      continue
    }
    if (row.error) {
      applyYield(rec)
      continue
    }
    if (!summary.empty) {
      if (rec.lastExDate && summary.lastExDate > rec.lastExDate) stats.lastExMoved += 1
      rec.lastAmount = summary.lastAmount
      rec.lastExDate = summary.lastExDate
      rec.annualDividend = summary.annualDividend
      rec.dividends = summary.dividends
      rec.nextExDate = null
      stats.div += 1
    } else {
      rec.annualDividend = 0
      rec.dividends = []
      rec.nextExDate = null
      rec.lastAmount = 0
      rec.lastExDate = null
    }
    applyYield(rec)
  }

  const universeForNames = readUniverseRows()
  const universeNameBy = new Map(universeForNames.map((r) => [r.symbol, r.name]))
  for (const rec of records) {
    if (rec.category !== '日本株') continue
    let jaName = ''
    for (const key of aliases(rec.symbol)) {
      const n = universeNameBy.get(key)
      if (n && /[\u3040-\u30ff\u4e00-\u9fff]/.test(n)) {
        jaName = n
        break
      }
    }
    if (jaName) rec.name = jaName
  }

  records.sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)))
  pack.records = records
  pack.recordCount = records.length
  pack.generatedFrom = 'us_prices_all_2026-09-24.xlsx + jp_prices_2026-09-24.xlsx + Yahoo Finance dividends (2026-09-25)'
  pack.listedYahooDividendsSyncedAt = new Date().toISOString()
  pack.pricesSyncedAt = new Date().toISOString()
  fs.writeFileSync(DETAIL_PATH, `${JSON.stringify(pack)}\n`)

  const currentUniverse = readUniverseRows()
  const universeBy = new Map(currentUniverse.map((r) => [r.symbol, { ...r }]))
  for (const row of fetched) {
    const rec = findRec(bySymbol, row.symbol)
    if (!rec || rec.category === '日本ETF' || isRetiredStockSymbol(row.symbol)) continue
    let u = null
    for (const key of aliases(row.symbol)) {
      if (universeBy.has(key)) {
        u = universeBy.get(key)
        break
      }
    }
    if (!u) {
      u = {
        symbol: rec.symbol,
        name: rec.name || row.name || rec.symbol,
        region: row.market,
        sector: 'その他',
        indexTag: '',
        dividendMonths: [],
      }
      stats.universe += 1
    }
    u.dividendMonths = (rec.dividends || []).map((d) => d.month)
    const lastExMonth = rec.lastExDate ? Number(String(rec.lastExDate).slice(5, 7)) : 0
    const matched = (rec.dividends || []).find((d) => d.month === lastExMonth)
    const lastRegular = Number(matched?.amount) > 0
      ? Number(matched.amount)
      : Number(rec.dividends?.at(-1)?.amount)
    if (lastRegular > 0) u.dividendAmountPerShare = lastRegular
    else delete u.dividendAmountPerShare
    if (row.name && (!u.name || u.name === u.symbol)) u.name = row.name
    universeBy.set(u.symbol, u)
    stats.universe += 1
  }
  const existingOrder = currentUniverse.map((r) => universeBy.get(r.symbol) || r)
  const existingSet = new Set(existingOrder.map((r) => r.symbol))
  const appended = [...universeBy.values()]
    .filter((r) => !existingSet.has(r.symbol))
    .sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)))
  writeUniverse([...existingOrder, ...appended])

  const errors = fetched.filter((r) => r.error)
  console.log('Wrote', DETAIL_PATH)
  console.log(stats)
  if (errors.length) {
    console.log('yahoo errors', errors.length)
    for (const row of errors.slice(0, 25)) {
      console.log('  ', row.symbol, row.error)
    }
  }
  for (const s of ['AAPL', 'KO', '8306.T', '7203.T', '7205.T', 'TDG', 'HST', 'AMD', 'AMZN', 'BRK.B', '285A.T']) {
    const r = findRec(bySymbol, s)
    if (!r) {
      console.log(s, 'still missing')
      continue
    }
    console.log(s, 'px', r.price, 'last', r.lastAmount, r.lastExDate, 'ann', r.annualDividend, 'yld', r.yieldPct, 'm', (r.dividends || []).map((d) => d.month).join('/'))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
