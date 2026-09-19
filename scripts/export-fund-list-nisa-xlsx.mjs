/**
 * JP ETF ユニバース（etfUniverseLite）＋ NISA区分・日本語名・ISIN を 1 枚の xlsx に出力。
 *
 *   node scripts/export-fund-list-nisa-xlsx.mjs
 *   node scripts/export-fund-list-nisa-xlsx.mjs --out=/path/to/out.xlsx
 *
 * 既定: reports/fund_list_nisa_YYYY-MM-DD.xlsx
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { ETF_SYMBOLS_FROM_XLSX } from '../src/data/etfUniverseLite.js'
import { ETF_LISTED_NISA_CATEGORY_MAP } from '../src/data/etfListedNisaMap.js'
import { ETF_LISTED_JA_NAME_MAP } from '../src/data/etfListedJaNameMap.js'
import { FUND_ISIN_BY_SYMBOL } from '../src/data/fundIsinBySymbol.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const parseOutFlag = () => {
  const a = process.argv.find((x) => x.startsWith('--out='))
  return a ? a.slice('--out='.length).trim() : ''
}

const symbolToCode = (sym) => {
  const s = String(sym || '').trim().toUpperCase()
  if (!s) return ''
  return s.endsWith('.T') ? s.slice(0, -2) : s
}

const rows = ETF_SYMBOLS_FROM_XLSX.map((symbol) => {
  const s = String(symbol || '').trim().toUpperCase()
  return {
    銘柄: s,
    証券コード: symbolToCode(s),
    ISIN: FUND_ISIN_BY_SYMBOL[s] || '',
    ファンド名JP: ETF_LISTED_JA_NAME_MAP[s] || '',
    NISA区分: ETF_LISTED_NISA_CATEGORY_MAP[s] || '',
  }
})

const ws = XLSX.utils.json_to_sheet(rows, {
  header: ['銘柄', '証券コード', 'ISIN', 'ファンド名JP', 'NISA区分'],
})
const wscols = [
  { wch: 12 },
  { wch: 12 },
  { wch: 14 },
  { wch: 48 },
  { wch: 18 },
]
ws['!cols'] = wscols

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'fund_list')

const outArg = parseOutFlag()
const dateStr = new Date().toISOString().slice(0, 10)
const defaultPath = path.join(root, 'reports', `fund_list_nisa_${dateStr}.xlsx`)
const outPath = outArg ? path.resolve(outArg) : defaultPath

fs.mkdirSync(path.dirname(outPath), { recursive: true })
XLSX.writeFile(wb, outPath)

const missingNisa = rows.filter((r) => !r.NISA区分).length
const missingName = rows.filter((r) => !r.ファンド名JP).length
const missingIsin = rows.filter((r) => !r.ISIN).length

console.log(`Wrote ${outPath} (${rows.length} rows)`)
if (missingNisa || missingName || missingIsin) {
  console.warn(
    `Note: empty fields — NISA: ${missingNisa}, name JP: ${missingName}, ISIN: ${missingIsin}`,
  )
}
