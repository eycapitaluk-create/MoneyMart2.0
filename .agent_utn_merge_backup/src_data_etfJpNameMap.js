/**
 * ETF symbol → Japanese name mapping for FundPage display
 */
import { ETF_LIST_FROM_XLSX } from './etfListFromXlsx'

const MAP = new Map(ETF_LIST_FROM_XLSX.map((r) => [r.symbol, r.jpName]))

export function getEtfJpName(symbol) {
  if (!symbol) return undefined
  return MAP.get(String(symbol).toUpperCase()) || MAP.get(String(symbol))
}
