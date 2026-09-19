/**
 * reports/Transformed_ETF_Universe_Final.ja.csv → src/data/etfListedJaNameMap.js
 * Run: node scripts/generate-etf-listed-ja-name-map.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const csvPath = path.join(root, 'reports/Transformed_ETF_Universe_Final.ja.csv')
const outPath = path.join(root, 'src/data/etfListedJaNameMap.js')
const nisaOutPath = path.join(root, 'src/data/etfListedNisaMap.js')

const raw = fs.readFileSync(csvPath, 'utf8')
const lines = raw.split(/\r?\n/).filter(Boolean)
const map = {}
const nisaMap = {}

const header = lines[0].split(',').map((h) => String(h || '').trim())
const symIdx = header.indexOf('symbol')
const jpIdx = header.indexOf('jp_name')
const nisaIdx = header.indexOf('nisa_category')
if (symIdx < 0 || jpIdx < 0) {
  console.error('CSV must include symbol,jp_name columns. Got:', header.slice(0, 8).join(','))
  process.exit(1)
}

for (let i = 1; i < lines.length; i += 1) {
  const line = lines[i]
  const parts = line.split(',')
  if (parts.length <= Math.max(symIdx, jpIdx)) continue
  const symbol = String(parts[symIdx] || '').trim()
  const jpName = String(parts[jpIdx] || '').trim()
  if (!symbol || !jpName) continue
  map[symbol] = jpName
  if (nisaIdx >= 0 && parts.length > nisaIdx) {
    const nisa = String(parts[nisaIdx] || '').trim()
    if (nisa) nisaMap[symbol] = nisa
  }
}

const banner = `/**
 * JP上場ETFの表示名（日本語）— reports/Transformed_ETF_Universe_Final.ja.csv から生成
 * 再生成: node scripts/generate-etf-listed-ja-name-map.mjs
 */
`
const body = `export const ETF_LISTED_JA_NAME_MAP = ${JSON.stringify(map, null, 2)}

export const getEtfListedJaName = (symbol) => {
  const s = String(symbol || '').trim()
  if (!s) return null
  return ETF_LISTED_JA_NAME_MAP[s] || null
}
`
const nisaBanner = `/**
 * JP上場ETFの NISA区分 — reports/Transformed_ETF_Universe_Final.ja.csv の nisa_category から生成
 * DBの stock_symbols.nisa_category が空のときのフォールバック用
 * 再生成: node scripts/generate-etf-listed-ja-name-map.mjs
 */
`
const nisaBody = `export const ETF_LISTED_NISA_CATEGORY_MAP = ${JSON.stringify(nisaMap, null, 2)}

export const getEtfListedNisaCategory = (symbol) => {
  const s = String(symbol || '').trim()
  if (!s) return null
  return ETF_LISTED_NISA_CATEGORY_MAP[s] || null
}
`

fs.writeFileSync(outPath, `${banner}${body}`, 'utf8')
fs.writeFileSync(nisaOutPath, `${nisaBanner}${nisaBody}`, 'utf8')
console.log(`Wrote ${Object.keys(map).length} names → ${path.relative(root, outPath)}`)
console.log(`Wrote ${Object.keys(nisaMap).length} nisa → ${path.relative(root, nisaOutPath)}`)
