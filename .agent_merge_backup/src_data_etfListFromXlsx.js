/**
 * ETF list - MarketPage heatmap/region/sector symbols
 * Derived from region + sector tickers
 */
const REGION = [
  { symbol: 'ACWI', jpName: '全世界株式' },
  { symbol: 'MCHI', jpName: '中国株式' },
  { symbol: '1329.T', jpName: '日経225' },
  { symbol: '1475.T', jpName: '日本株式' },
  { symbol: 'EUNK.DE', jpName: '欧州株式' },
  { symbol: 'AAXJ', jpName: 'アジア除く日本' },
  { symbol: 'EEM', jpName: '新興国株式' },
  { symbol: 'IVV', jpName: '米国大型株' },
  { symbol: 'IJH', jpName: '米国中型株' },
  { symbol: 'IJR', jpName: '米国小型株' },
]
const SECTOR = [
  { symbol: 'IYE', jpName: 'エネルギー' },
  { symbol: 'IYM', jpName: '素材' },
  { symbol: 'IYJ', jpName: '資本財・産業' },
  { symbol: 'IYC', jpName: '一般消費財' },
  { symbol: 'IYK', jpName: '生活必需品' },
  { symbol: 'IYH', jpName: 'ヘルスケア' },
  { symbol: 'IYF', jpName: '金融' },
  { symbol: 'IYW', jpName: '情報技術' },
  { symbol: 'IYZ', jpName: '通信サービス' },
  { symbol: 'IDU', jpName: '公益事業' },
  { symbol: 'IYR', jpName: '不動産' },
]
export const ETF_LIST_FROM_XLSX = [...REGION, ...SECTOR]
export const ETF_SYMBOLS_FROM_XLSX = ETF_LIST_FROM_XLSX.map((r) => r.symbol)
