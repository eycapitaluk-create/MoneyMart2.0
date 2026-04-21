/**
 * Reads MoneyMart_Dividend_Calendar.xlsx → src/data/dividendCalendarDetail.generated.json
 * Default input: env DIVIDEND_CALENDAR_XLSX or repo-relative path arg.
 *
 *   node scripts/generate-dividend-calendar-detail.mjs [path/to/file.xlsx]
 */
import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  inferPaymentCountPerYear,
  rebuildUsDividendScheduleFromRecord,
  shouldNormalizeUsDividendRecord,
} from '../src/lib/usDividendScheduleInference.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const argPath = process.argv[2]
const envPath = process.env.DIVIDEND_CALENDAR_XLSX
const DEFAULT_MAC = path.join(process.env.HOME || '', 'Downloads/MoneyMart_Dividend_Calendar.xlsx')

const XLSX_PATH = argPath || envPath || DEFAULT_MAC

function parseIso(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  const s = String(v ?? '').replace(/,/g, '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function normSym(s) {
  const t = String(s || '').trim().toUpperCase()
  if (!t) return ''
  if (/^\d{4}$/.test(t)) return `${t}.T`
  return t
}

function buildMonthlyFromCalendarSheet(wb) {
  const sh = wb.Sheets['月別配当カレンダー']
  if (!sh) return new Map()
  const raw = XLSX.utils.sheet_to_json(sh, { header: 1 })
  const map = new Map()
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 5) continue
    const sym = String(row[0] || '').trim()
    if (!sym || sym === 'Symbol') continue
    const iso = parseIso(row[3])
    if (!iso) continue
    const month = parseInt(iso.slice(5, 7), 10)
    const amt = Number(String(row[4]).replace(/,/g, '')) || 0
    const key = normSym(sym)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push({ month, amount: amt })
  }
  const out = new Map()
  for (const [k, arr] of map) {
    const byM = new Map()
    for (const { month, amount } of arr) {
      if (!byM.has(month)) byM.set(month, [])
      byM.get(month).push(amount)
    }
    const dividends = [...byM.entries()]
      .map(([m, amts]) => ({
        month: m,
        amount: Math.round((amts.reduce((a, b) => a + b, 0) / amts.length) * 1e6) / 1e6,
      }))
      .sort((a, b) => a.month - b.month)
    out.set(k, dividends)
  }
  return out
}

function inferDividends(row) {
  const annual = Number(String(row['年間配当'] ?? '').replace(/,/g, '')) || 0
  const last = Number(String(row['直近配当額'] ?? '').replace(/,/g, '')) || 0
  const iso = parseIso(row['次回権利落日'])
  if (!iso || annual <= 0) return []
  const M = parseInt(iso.slice(5, 7), 10)
  let n = inferPaymentCountPerYear(annual, last)
  if (n <= 0) n = 1
  const per = annual / n
  const months = []
  if (n === 1) months.push(M)
  else if (n === 2) months.push(M, ((M - 1 + 6) % 12) + 1)
  else if (n === 4) for (let k = 0; k < 4; k++) months.push(((M - 1 + k * 3) % 12) + 1)
  else if (n === 12) for (let m = 1; m <= 12; m++) months.push(m)
  else {
    const step = Math.max(1, Math.round(12 / n))
    for (let k = 0; k < n; k++) months.push(((M - 1 + k * step) % 12) + 1)
  }
  const uniq = [...new Set(months)].sort((a, b) => a - b)
  return uniq.map((m) => ({ month: m, amount: Math.round(per * 1e6) / 1e6 }))
}

function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error('Missing xlsx:', XLSX_PATH)
    console.error('Usage: DIVIDEND_CALENDAR_XLSX=/path/file.xlsx node scripts/generate-dividend-calendar-detail.mjs')
    process.exit(1)
  }
  const wb = XLSX.readFile(XLSX_PATH)
  const monthlyMap = buildMonthlyFromCalendarSheet(wb)
  const list = XLSX.utils.sheet_to_json(wb.Sheets['配当一覧'])
  const rankRows = XLSX.utils.sheet_to_json(wb.Sheets['高配当ランキング'] || {})
  const highYieldSet = new Set()
  for (const r of rankRows) {
    const s = normSym(r.Symbol)
    if (s) highYieldSet.add(s)
  }

  const records = []
  for (const row of list) {
    const symbol = normSym(row.Symbol)
    if (!symbol) continue
    let dividends = monthlyMap.get(symbol)
    if (!dividends || dividends.length === 0) dividends = inferDividends(row)
    const annualDividend = Number(String(row['年間配当'] ?? '').replace(/,/g, '')) || 0
    const lastAmount = Number(String(row['直近配当額'] ?? '').replace(/,/g, '')) || 0
    const recLike = {
      annualDividend,
      lastAmount,
      nextExDate: parseIso(row['次回権利落日']),
      lastExDate: parseIso(row['直近配当日']),
      currency: row['通貨'] === 'USD' ? 'USD' : 'JPY',
      category: String(row['カテゴリ'] || ''),
    }
    if (shouldNormalizeUsDividendRecord({ ...recLike, dividends }, dividends)) {
      const rebuilt = rebuildUsDividendScheduleFromRecord(recLike)
      if (rebuilt.length) dividends = rebuilt
    }
    const y = Number(String(row['配当利回り(%)'] ?? '').replace(/,/g, '')) || 0
    const highYield = y >= 4 || highYieldSet.has(symbol)
    const currency = row['通貨'] === 'USD' ? 'USD' : 'JPY'
    records.push({
      symbol,
      name: String(row['銘柄名'] || '').trim(),
      category: String(row['カテゴリ'] || ''),
      currency,
      price: Number(String(row['現在価格'] ?? '').replace(/,/g, '')) || 0,
      annualDividend,
      yieldPct: Math.round(y * 100) / 100,
      lastAmount,
      lastExDate: parseIso(row['直近配当日']),
      nextExDate: parseIso(row['次回権利落日']),
      dividends,
      highYield,
    })
  }
  records.sort((a, b) => a.symbol.localeCompare(b.symbol))

  const outFile = path.join(ROOT, 'src/data/dividendCalendarDetail.generated.json')
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, `${JSON.stringify({ generatedFrom: path.basename(XLSX_PATH), recordCount: records.length, records }, null, 0)}\n`, 'utf8')
  console.log('Wrote', outFile, 'records', records.length)
}

main()
