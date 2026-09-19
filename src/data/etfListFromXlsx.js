// ETF list: universe = jp_etf snapshot in etfUniverseLite only (no extra US/global tickers).
// Fund/Market/cron use ETF_LIST_FROM_XLSX / ETF_SYMBOLS_FROM_XLSX.

import { ETF_SYMBOLS_FROM_XLSX as JP_ETF_SYMBOLS } from './etfUniverseLite.js'

const STUB_ROWS = [
  { symbol: '1329.T', jpName: '日経225連動型上場投資信託', category: '株式' },
  { symbol: '1475.T', jpName: 'iShares Core TOPIX ETF', category: '株式' },
  { symbol: '1478.T', jpName: 'iShares MSCI Japan High Dividend ETF', category: '高配当' },
  { symbol: '2854.T', jpName: 'NEXT FUNDS NASDAQ-100 Top 20 ETF', category: 'テック' },
  { symbol: '2621.T', jpName: 'iShares 20+ Year US Treasury Bond JPY Hedged ETF', category: '債券' },
]

const STUB_BY_SYMBOL = new Map(STUB_ROWS.map((r) => [r.symbol, r]))

export const ETF_SYMBOLS_FROM_XLSX = [...JP_ETF_SYMBOLS]

export const ETF_LIST_FROM_XLSX = ETF_SYMBOLS_FROM_XLSX.map((symbol) => {
  const stub = STUB_BY_SYMBOL.get(symbol)
  return {
    symbol,
    jpName: stub?.jpName ?? null,
    category: stub?.category ?? '株式',
  }
})

export const MARKETSTACK_BLOCKLIST_EXPORT = new Set([])
