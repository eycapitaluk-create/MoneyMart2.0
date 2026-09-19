/**
 * Merges dividend_data_*.xlsx into src/data/dividendCalendarDetail.generated.json.
 * Sheet: 配当データ一覧 or 配当データ一覧（全銘柄） — header row 市場 / 銘柄コード / 直近配当金額 / 直近配当日 / 配当月.
 * Updates pay months (支払月) & per-share amounts while keeping name/category/price when known.
 *
 *   node scripts/merge-dividend-data-xlsx-into-calendar-detail.mjs [/path/to/dividend_data.xlsx]
 */
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const argPath = process.argv[2]
const envPath = process.env.DIVIDEND_DATA_XLSX
const XLSX_PATH = argPath || envPath

const SHEET_CANDIDATES = ['配当データ一覧', '配当データ一覧（全銘柄）']

function findMainSheet(wb) {
  for (const name of SHEET_CANDIDATES) {
    if (wb.Sheets?.[name]) return name
  }
  return null
}

function parseIso(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  const s = String(v ?? '').replace(/,/g, '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function normSym(s) {
  const t = String(s || '').trim().toUpperCase()
  if (!t) return ''
  // Yahoo/xlsx share-class dashes → app canonical dots
  if (t === 'BF/B' || t === 'BF-B') return 'BF.B'
  if (t === 'BRK/B' || t === 'BRK-B') return 'BRK.B'
  if (/^\d{4}$/.test(t)) return `${t}.T`
  return t
}

function roundAmt(n) {
  return Math.round(Math.max(0, Number(n) || 0) * 1e6) / 1e6
}

/** e.g. "3月 / 9月", "1月 / 4月 / 7月 / 10月" */
function parseDividendMonthsJa(s) {
  const months = []
  for (const m of String(s ?? '').matchAll(/(\d{1,2})月/g)) {
    const n = parseInt(m[1], 10)
    if (Number.isInteger(n) && n >= 1 && n <= 12) months.push(n)
  }
  return [...new Set(months)].sort((a, b) => a - b)
}

function readPatchesFromWorkbook(wb) {
  const sheetName = findMainSheet(wb)
  if (!sheetName) {
    console.error('Missing sheet. Tried:', SHEET_CANDIDATES.join(', '), '| available:', wb.SheetNames?.join(', '))
    process.exit(1)
  }
  const sh = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(sh, { header: 1 })
  const headerIdx = raw.findIndex((r) => r && String(r[0]).trim() === '市場')
  if (headerIdx < 0) {
    console.error('Could not find header row (市場) in', sheetName)
    process.exit(1)
  }
  const hdr = raw[headerIdx]
  const col = (name) => hdr.indexOf(name)

  const iMarket = col('市場')
  const iCode = col('銘柄コード')
  const iLastAmt = col('直近配当金額')
  const iLastEx = col('直近配当日')
  const iMonths = col('配当月')
  if (iCode < 0 || iLastAmt < 0 || iMonths < 0) {
    console.error('Missing required columns in', sheetName)
    process.exit(1)
  }

  /** @type {Map<string, object>} */
  const bySym = new Map()
  for (const row of raw.slice(headerIdx + 1)) {
    if (!Array.isArray(row) || row.length < 2) continue
    const symbol = normSym(row[iCode])
    if (!symbol) continue
    const market = String(row[iMarket] ?? '').trim().toUpperCase()
    const currency = market === 'US' ? 'USD' : 'JPY'
    const lastAmount = roundAmt(String(row[iLastAmt] ?? '').replace(/,/g, ''))
    const lastExDate = iLastEx >= 0 ? parseIso(row[iLastEx]) : null
    const months = parseDividendMonthsJa(row[iMonths])
    if (!months.length || !(lastAmount > 0)) continue
    const per = roundAmt(lastAmount)
    const dividends = months.map((month) => ({ month, amount: per }))
    const annualDividend = roundAmt(per * months.length)
    bySym.set(symbol, {
      symbol,
      currency,
      lastAmount: per,
      lastExDate,
      dividends,
      annualDividend,
    })
  }
  return bySym
}

function applyYieldAndHighYield(rec, prevHighYield = false) {
  const price = Number(rec?.price) || 0
  const annual = Number(rec?.annualDividend) || 0
  if (price > 0 && annual > 0) {
    rec.yieldPct = Math.round((annual / price) * 10000) / 100
  }
  const y = Number(rec.yieldPct)
  rec.highYield = (Number.isFinite(y) && y >= 4) || Boolean(prevHighYield)
}

function main() {
  if (!XLSX_PATH || !fs.existsSync(XLSX_PATH)) {
    console.error('Missing xlsx. Pass path or set DIVIDEND_DATA_XLSX.')
    console.error('Usage: node scripts/merge-dividend-data-xlsx-into-calendar-detail.mjs /path/dividend_data.xlsx')
    process.exit(1)
  }

  const wb = XLSX.readFile(XLSX_PATH)
  const patches = readPatchesFromWorkbook(wb)

  const outFile = path.join(ROOT, 'src/data/dividendCalendarDetail.generated.json')
  const pack = JSON.parse(fs.readFileSync(outFile, 'utf8'))
  const records = Array.isArray(pack.records) ? pack.records : []

  let updated = 0
  const bySymbol = new Map(records.map((r) => [r.symbol, r]))
  for (const [sym, p] of patches) {
    const rec = bySymbol.get(sym)
    if (rec) {
      const prevHy = Boolean(rec.highYield)
      rec.currency = p.currency
      rec.lastAmount = p.lastAmount
      if (p.lastExDate) rec.lastExDate = p.lastExDate
      rec.dividends = p.dividends
      rec.annualDividend = p.annualDividend
      applyYieldAndHighYield(rec, prevHy)
      updated += 1
    }
  }

  let added = 0
  for (const [sym, p] of patches) {
    if (bySymbol.has(sym)) continue
    const rec = {
      symbol: p.symbol,
      name: '',
      category: p.currency === 'USD' ? '米国株' : '',
      currency: p.currency,
      price: 0,
      annualDividend: p.annualDividend,
      yieldPct: 0,
      lastAmount: p.lastAmount,
      lastExDate: p.lastExDate,
      nextExDate: null,
      dividends: p.dividends,
      highYield: false,
    }
    applyYieldAndHighYield(rec, false)
    records.push(rec)
    bySymbol.set(sym, rec)
    added += 1
  }

  // Keep dash/dot share-class aliases in sync when both exist (or create dash alias).
  for (const [canonical, alias] of [['BF.B', 'BF-B'], ['BRK.B', 'BRK-B']]) {
    const src = bySymbol.get(canonical)
    if (!src) continue
    let dst = bySymbol.get(alias)
    if (!dst) {
      dst = { ...src, symbol: alias, dividends: (src.dividends || []).map((d) => ({ ...d })) }
      records.push(dst)
      bySymbol.set(alias, dst)
      added += 1
    } else {
      dst.lastAmount = src.lastAmount
      dst.annualDividend = src.annualDividend
      dst.dividends = (src.dividends || []).map((d) => ({ ...d }))
      dst.currency = src.currency
      if (src.lastExDate) dst.lastExDate = src.lastExDate
      applyYieldAndHighYield(dst, Boolean(dst.highYield))
      updated += 1
    }
  }

  records.sort((a, b) => a.symbol.localeCompare(b.symbol))
  pack.records = records
  pack.recordCount = records.length
  pack.generatedFrom = path.basename(XLSX_PATH)

  fs.writeFileSync(outFile, `${JSON.stringify(pack, null, 0)}\n`, 'utf8')
  console.log('Wrote', outFile)
  console.log('Patches from xlsx:', patches.size, '| updated:', updated, '| added:', added)
}

main()
