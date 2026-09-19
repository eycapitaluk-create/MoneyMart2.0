/**
 * StockPage 用: STOCK_LIST_400 に無いが一覧に出したいティッカーのみを列挙する。
 * stock_symbols を全件走査しない（DB に載っている米株・ファンドが全部マージされるのを防ぐ）。
 *
 * 運用: 次のいずれかで指定する。
 * - この配列にシンボルを追加（Git で管理）
 * - .env の VITE_STOCK_MARKET_PAGE_EXTRA_SYMBOLS（カンマ区切り）… 設定時は配列より優先
 *
 * 下記はユーザー指定の米株ブロック。BF/B→BF-B、BRK/B→BRK.B、Trade Desk→TTD に正規化。
 */
export const STOCK_MARKET_PAGE_EXTRA_SYMBOLS = [
  'APO',
  'APP',
  'ARES',
  'ALAB',
  'BF-B',
  'BNY',
  'BKNG',
  'BRK.B',
  'BXP',
  'CASY',
  'CHRW',
  'CIEN',
  'CNP',
  'COHR',
  'COIN',
  'CRWV',
  'CRH',
  'CVNA',
  'DELL',
  'EME',
  'ERIE',
  'EXE',
  'FLEX',
  'FISV',
  'FIX',
  'GDDY',
  'GL',
  'GPN',
  'HOOD',
  'IBKR',
  'KKR',
  'LII',
  'LITE',
  // Marsh & McLennan — データソースによって MRSH / MMC が同一銘柄として返ることがある
  'MRSH',
  'NBIS',
  'PLTR',
  'PSKY',
  'Q',
  'RKLB',
  'SATS',
  'SKHY',
  'SNDK',
  'SPCX',
  'TKO',
  'TPL',
  'TTD',
  'TXT',
  'VEEV',
  'WSM',
  'XYZ',
  '285A.T',
]

/** @returns {string[]} */
export function getStockMarketPageExtraSymbolList() {
  let raw = ''
  try {
    raw = String(import.meta.env?.VITE_STOCK_MARKET_PAGE_EXTRA_SYMBOLS || '').trim()
  } catch {
    raw = ''
  }
  if (raw) {
    return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))]
  }
  return STOCK_MARKET_PAGE_EXTRA_SYMBOLS.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
}
