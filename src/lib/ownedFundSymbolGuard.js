import { STOCK_LIST_400 } from '../data/stockList400'
import { ETF_SYMBOLS_FROM_XLSX } from '../data/etfListFromXlsx'

const STOCK_LIST_400_UPPER = new Set(
  (Array.isArray(STOCK_LIST_400) ? STOCK_LIST_400 : [])
    .map((r) => String(r?.symbol || '').trim().toUpperCase())
    .filter(Boolean),
)

const ETF_SYMBOL_UPPER = new Set(
  (Array.isArray(ETF_SYMBOLS_FROM_XLSX) ? ETF_SYMBOLS_FROM_XLSX : [])
    .map((s) => String(s || '').trim().toUpperCase())
    .filter(Boolean),
)

/**
 * MyPage「保有ファンド」と Supabase user_owned_funds は、このチェックに引っかかった銘柄を載せない。
 * （載せると iOS が remoteFunds をすべて kind .fund とみなし、米国個別株 MA などがファンド扱いになる）
 *
 * ロジック: JP ETF マスタ（etfUniverseLite 由来）に無く、かつ個別株マスタ 400 にあるティッカー → ファンドに入れない。
 */
export function isMisclassifiedStockHeldAsFundSymbol(symbol) {
  const u = String(symbol || '').trim().toUpperCase()
  if (!u) return false
  if (ETF_SYMBOL_UPPER.has(u)) return false
  return STOCK_LIST_400_UPPER.has(u)
}
