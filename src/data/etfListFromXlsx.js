// ETF list data - populated from xlsx source
// ETF_LIST_FROM_XLSX: full ETF metadata objects
// ETF_SYMBOLS_FROM_XLSX: just the ticker symbols array
// MARKETSTACK_BLOCKLIST_EXPORT: Set of symbols to exclude from Marketstack fetching

export const ETF_LIST_FROM_XLSX = [
  { symbol: '1329.T', jpName: '日経225連動型上場投資信託', category: '株式' },
  { symbol: '1475.T', jpName: 'iShares Core TOPIX ETF', category: '株式' },
  { symbol: '1478.T', jpName: 'iShares MSCI Japan High Dividend ETF', category: '高配当' },
  { symbol: '2854.T', jpName: 'NEXT FUNDS NASDAQ-100 Top 20 ETF', category: 'テック' },
  { symbol: '2621.T', jpName: 'iShares 20+ Year US Treasury Bond JPY Hedged ETF', category: '債券' },
  { symbol: 'IVV',  jpName: 'iShares Core S&P 500 ETF', category: '米国株' },
  { symbol: 'IJH',  jpName: 'iShares Core S&P Mid-Cap ETF', category: '米国株' },
  { symbol: 'IJR',  jpName: 'iShares Core S&P Small-Cap ETF', category: '米国株' },
  { symbol: 'ACWI', jpName: 'iShares MSCI ACWI ETF', category: '全世界' },
  { symbol: 'MCHI', jpName: 'iShares MSCI China ETF', category: '中国' },
  { symbol: 'EUNK.DE', jpName: 'iShares Core MSCI Europe ETF', category: '欧州' },
  { symbol: 'AAXJ', jpName: 'iShares MSCI All Country Asia ex Japan ETF', category: 'アジア' },
  { symbol: 'EEM',  jpName: 'iShares MSCI Emerging Markets ETF', category: '新興国' },
  { symbol: 'IYE',  jpName: 'iShares US Energy ETF', category: 'エネルギー' },
  { symbol: 'IYM',  jpName: 'iShares US Basic Materials ETF', category: '素材' },
  { symbol: 'IYJ',  jpName: 'iShares US Industrials ETF', category: '資本財' },
  { symbol: 'IYC',  jpName: 'iShares US Consumer Discretionary ETF', category: '一般消費財' },
  { symbol: 'IYK',  jpName: 'iShares US Consumer Staples ETF', category: '生活必需品' },
  { symbol: 'IYH',  jpName: 'iShares US Healthcare ETF', category: 'ヘルスケア' },
  { symbol: 'IYF',  jpName: 'iShares US Financials ETF', category: '金融' },
  { symbol: 'IYW',  jpName: 'iShares US Technology ETF', category: '情報技術' },
  { symbol: 'IYZ',  jpName: 'iShares US Telecommunications ETF', category: '通信' },
  { symbol: 'IDU',  jpName: 'iShares US Utilities ETF', category: '公益' },
  { symbol: 'IYR',  jpName: 'iShares US Real Estate ETF', category: '不動産' },
  { symbol: 'GLD',  jpName: 'SPDR Gold Shares', category: 'コモディティ' },
  { symbol: 'SLV',  jpName: 'iShares Silver Trust', category: 'コモディティ' },
  { symbol: 'CPER', jpName: 'United States Copper Index Fund', category: 'コモディティ' },
  { symbol: 'USO',  jpName: 'United States Oil Fund', category: 'コモディティ' },
  { symbol: 'TLT',  jpName: 'iShares 20+ Year Treasury Bond ETF', category: '債券' },
]

export const ETF_SYMBOLS_FROM_XLSX = ETF_LIST_FROM_XLSX.map((e) => e.symbol)

export const MARKETSTACK_BLOCKLIST_EXPORT = new Set([
  'EUNK.DE',
])
