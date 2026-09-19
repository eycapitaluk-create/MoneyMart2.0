/**
 * JP上場 ETF の英語名（検索・補助表示用）。
 * 表示は etfListedJaNameMap の和名を優先し、こちらは英語クエリのヒット用。
 */
export const ETF_LISTED_EN_NAME_MAP = {
  '426A.T': 'Nissay ETF S&P500 Equal Weight (No Hedge)',
  '585A.T': 'Japan Value Bottom-Up Active Equity ETF',
  '586A.T': 'NEXT FUNDS Nikkei Entertainment & Content Index ETF',
  '600A.T': 'Nissay ETF Russell 2000',
  '605A.T': 'NEXT FUNDS Japan Policy Focus ETF',
  '606A.T': 'Gold 2x Bull ETF',
  '608A.T': 'Listed Index Fund TSE REIT High Yield 30',
}

export const getEtfListedEnName = (symbol) => {
  const s = String(symbol || '').trim()
  if (!s) return null
  return ETF_LISTED_EN_NAME_MAP[s] || null
}
