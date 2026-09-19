/**
 * Fund Name Convention.xlsx（または同形式）の「Official Name」列で表示名を上書きする。
 * 銘柄（例: 1306.T）が空の行は ISIN から FUND_ISIN_BY_SYMBOL の逆引きでマッチ。
 *
 *   node scripts/apply-fund-name-convention-xlsx.mjs [/path/to/Fund\ Name\ Convention.xlsx]
 *
 * 出力: src/data/etfListedJaNameMap.js（既存キーのみ更新。xlsxに無い銘柄は据え置き）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { ETF_LISTED_JA_NAME_MAP } from '../src/data/etfListedJaNameMap.js'
import { FUND_ISIN_BY_SYMBOL } from '../src/data/fundIsinBySymbol.js'
import { normalizeFundDisplayNamePlain } from '../src/lib/textEncodingUtils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const defaultXlsx = '/Users/justinnam/Downloads/Fund Name Convention.xlsx'
const xlsxPath = path.resolve(process.argv[2] || defaultXlsx)

const wb = XLSX.readFile(xlsxPath)
const ws = wb.Sheets.fund_list || wb.Sheets[wb.SheetNames[0]]
if (!ws) throw new Error('No sheet found')
const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
const header = matrix[0] || []
const col = (label) => header.findIndex((h) => String(h || '').trim() === label)

const iSym = col('銘柄')
const iIsin = col('ISIN')
const iOff = col('Official Name')
if (iSym < 0 || iOff < 0) {
  throw new Error(`銘柄 / Official Name 列が必要です。ヘッダー: ${header.join(', ')}`)
}

const isinToSymbol = new Map()
for (const [sym, isin] of Object.entries(FUND_ISIN_BY_SYMBOL)) {
  const k = String(isin || '').trim().toUpperCase()
  if (k) isinToSymbol.set(k, sym)
}

const merged = { ...ETF_LISTED_JA_NAME_MAP }
let updated = 0
let byIsin = 0
let skippedNoSymbol = 0
let skippedNoOfficial = 0
let skippedNotInUniverse = 0
const warnings = []

for (let r = 1; r < matrix.length; r += 1) {
  const row = matrix[r]
  if (!row || !row.length) continue
  let sym = String(row[iSym] || '').trim().toUpperCase()
  const isin = iIsin >= 0 ? String(row[iIsin] || '').trim().toUpperCase() : ''
  const official = String(row[iOff] || '').trim()
  const normalized = normalizeFundDisplayNamePlain(official)
  if (!normalized) {
    skippedNoOfficial += 1
    continue
  }
  if (!sym && isin) {
    const mapped = isinToSymbol.get(isin)
    if (mapped) {
      sym = mapped
      byIsin += 1
    }
  } else if (sym && isin) {
    const mapped = isinToSymbol.get(isin)
    if (mapped && mapped !== sym) {
      warnings.push(`行 ${r + 1}: 銘柄 ${sym} と ISIN 逆引き ${mapped} が不一致。銘柄を優先`)
    }
  }
  if (!sym) {
    skippedNoSymbol += 1
    continue
  }
  if (!(sym in merged)) {
    skippedNotInUniverse += 1
    continue
  }
  if (merged[sym] !== normalized) updated += 1
  merged[sym] = normalized
}

const banner = `/**
 * JP上場ETFの表示名（日本語）— ベースは reports/Transformed_ETF_Universe_Final.ja.csv
 * Official Name（規約表・Ｆ列）反映: node scripts/apply-fund-name-convention-xlsx.mjs
 */
`
const body = `export const ETF_LISTED_JA_NAME_MAP = ${JSON.stringify(merged, null, 2)}

export const getEtfListedJaName = (symbol) => {
  const s = String(symbol || '').trim()
  if (!s) return null
  return ETF_LISTED_JA_NAME_MAP[s] || null
}
`

const outPath = path.join(root, 'src/data/etfListedJaNameMap.js')
fs.writeFileSync(outPath, `${banner}${body}`, 'utf8')

for (const w of warnings.slice(0, 20)) console.warn(w)
if (warnings.length > 20) console.warn(`…他 ${warnings.length - 20} 件`)

console.log(
  JSON.stringify(
    {
      xlsxPath,
      out: path.relative(root, outPath),
      mapSize: Object.keys(merged).length,
      updatedDiff: updated,
      byIsin,
      skippedNoSymbol,
      skippedNoOfficial,
      skippedNotInUniverse,
    },
    null,
    2,
  ),
)
