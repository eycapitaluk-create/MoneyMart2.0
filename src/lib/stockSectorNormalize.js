/** StockPage 銘柄一覧・ヒートマップ等で使うセクター表示ラベル正規化 */

export const STOCK_SECTOR_OVERRIDE_BY_SYMBOL = new Map([
  ['7012.T', '資本財・産業'],
])

export function normalizeSectorName(value) {
  const sector = String(value || '').trim()
  if (!sector || /market/i.test(sector)) return '未分類'
  if (sector === '公益' || sector === '公益事業') return '電力・ガス'
  const lower = sector.toLowerCase()
  const exactMap = {
    technology: 'テクノロジー',
    tech: 'テクノロジー',
    financial: '金融',
    financials: '金融',
    finance: '金融',
    healthcare: 'ヘルスケア',
    'health care': 'ヘルスケア',
    industrial: '資本財・産業',
    industrials: '資本財・産業',
    consumer: '一般消費財',
    'consumer discretionary': '一般消費財',
    'consumer staples': '生活必需品',
    communication: 'コミュニケーション',
    'communication services': 'コミュニケーション',
    energy: 'エネルギー',
    materials: '素材',
    utilities: '電力・ガス',
    'real estate': '不動産',
    'sector etf': 'セクターETF',
    'index etf': '指数ETF',
    'thematic etf': 'テーマETF',
    'dividend etf': '高配当ETF',
    'fixed income etf': '債券ETF',
    'international equity etf': '海外株式ETF',
    'global equity etf': 'グローバル株式ETF',
    'commodity etf': '原材料ETF',
  }
  if (exactMap[lower]) return exactMap[lower]
  if (lower.includes('tech')) return 'テクノロジー'
  if (lower.includes('financ')) return '金融'
  if (lower.includes('health')) return 'ヘルスケア'
  if (lower.includes('consumer')) return '一般消費財'
  if (lower.includes('industrial')) return '資本財・産業'
  if (lower.includes('energy')) return 'エネルギー'
  if (lower.includes('material')) return '素材'
  if (lower.includes('utilit')) return '電力・ガス'
  if (lower.includes('communicat')) return 'コミュニケーション'
  if (lower.includes('real estate')) return '不動産'
  if (lower.includes('etf')) return 'ETF'
  return sector
}

export function normalizeSectorForDb(value) {
  const sector = String(value || '').trim()
  if (!sector) return null
  if (sector === '公益' || sector === '公益事業') return '電力・ガス'
  return sector
}
