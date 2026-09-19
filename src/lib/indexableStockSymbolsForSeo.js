/**
 * サイトマップ・クローラ向け SSR と同一の「インデックス対象にしてよい銘柄コード」判定。
 * JP ETF・退役シンボル・US/JP 以外は除外。
 */
import { ETF_SYMBOLS_FROM_XLSX } from '../data/etfUniverseLite.js'
import { STOCK_LIST_400 } from '../data/stockList400.js'
import { isRetiredStockSymbol } from './retiredStockSymbols.js'

const ETF_SYMBOL_SET = new Set(
  ETF_SYMBOLS_FROM_XLSX.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean),
)

export function isIndexableStockSymbol(sym) {
  const s = String(sym || '').trim().toUpperCase()
  if (!s) return false
  if (ETF_SYMBOL_SET.has(s)) return false
  if (isRetiredStockSymbol(s)) return false
  const row = STOCK_LIST_400.find((item) => String(item?.symbol || '').trim().toUpperCase() === s)
  return Boolean(row && (row.region === 'US' || row.region === 'JP'))
}

/** @returns {string[]} upper symbol codes */
export function collectIndexableStockSymbols() {
  const seen = new Set()
  const symbols = []
  for (const item of STOCK_LIST_400) {
    const region = item?.region
    if (region !== 'US' && region !== 'JP') continue
    const sym = String(item?.symbol || '').trim().toUpperCase()
    if (!sym || ETF_SYMBOL_SET.has(sym)) continue
    if (isRetiredStockSymbol(sym)) continue
    if (seen.has(sym)) continue
    seen.add(sym)
    symbols.push(sym)
  }
  return symbols
}
