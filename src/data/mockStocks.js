const JP_SOURCE = [
  { code: '7203', name: 'トヨタ自動車', sector: '自動車', base: 3580 },
  { code: '6758', name: 'ソニーG', sector: '電気機器', base: 13200 },
  { code: '8035', name: '東京エレクトロン', sector: '半導体', base: 38900 },
  { code: '9984', name: 'ソフトバンクG', sector: '投資', base: 8450 },
  { code: '7974', name: '任天堂', sector: 'ゲーム', base: 8800 },
  { code: '9983', name: 'ファーストリテイリング', sector: '小売', base: 42100 },
  { code: '6861', name: 'キーエンス', sector: '電気機器', base: 68500 },
  { code: '8306', name: '三菱UFJFG', sector: '銀行', base: 1580 },
  { code: '9432', name: '日本電信電話', sector: '通信', base: 4280 },
  { code: '4519', name: '中外製薬', sector: '医薬', base: 5420 },
  { code: '8316', name: '三井住友FG', sector: '銀行', base: 8930 },
  { code: '6501', name: '日立製作所', sector: '電気機器', base: 12350 },
  { code: '4063', name: '信越化学工業', sector: '化学', base: 6540 },
  { code: '6098', name: 'リクルートHD', sector: 'サービス', base: 9150 },
  { code: '8058', name: '三菱商事', sector: '商社', base: 3110 },
  { code: '8001', name: '伊藤忠商事', sector: '商社', base: 7040 },
  { code: '6367', name: 'ダイキン工業', sector: '機械', base: 22700 },
  { code: '6902', name: 'デンソー', sector: '自動車部品', base: 2710 },
  { code: '7267', name: 'ホンダ', sector: '自動車', base: 1860 },
  { code: '1605', name: 'INPEX', sector: '資源', base: 2430 },
  { code: '4502', name: '武田薬品工業', sector: '医薬', base: 4320 },
  { code: '2914', name: '日本たばこ産業', sector: '食品', base: 4360 },
  { code: '8801', name: '三井不動産', sector: '不動産', base: 1630 },
  { code: '9020', name: 'JR東日本', sector: '鉄道', base: 2960 },
  { code: '6178', name: '日本郵政', sector: '金融', base: 1560 },
]

const US_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'TSLA', 'AVGO', 'AMD',
  'ORCL', 'NFLX', 'CRM', 'ADBE', 'INTC', 'QCOM', 'TXN', 'MU', 'CSCO', 'IBM',
  'PLTR', 'JPM', 'GS', 'MS', 'BAC', 'WFC', 'C', 'BLK', 'V', 'MA',
  'AXP', 'PYPL', 'SCHW', 'USB', 'PNC', 'COF', 'BK', 'SPGI', 'ICE', 'JNJ',
  'PFE', 'MRK', 'UNH', 'ABBV', 'LLY', 'TMO', 'ABT', 'DHR', 'ISRG', 'BMY',
  'GILD', 'AMGN', 'VRTX', 'CVS', 'MDT', 'SYK', 'ZTS', 'REGN', 'CI', 'XOM',
  'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OKE', 'KMI', 'WMB',
  'DVN', 'FANG', 'HAL', 'BKR', 'CAT', 'GE', 'DE', 'HON', 'ETN', 'MMM',
  'LMT', 'RTX', 'NOC', 'BA', 'UNP', 'UPS', 'FDX', 'WM', 'EMR', 'ITW',
  'PH', 'ROK', 'GD', 'CSX', 'WMT', 'COST', 'HD', 'MCD', 'KO', 'PEP',
  'UBER', 'ABNB', 'SHOP', 'SQ', 'COIN', 'SNOW', 'PANW', 'CRWD', 'NOW', 'ANET',
  'MRVL', 'SMCI', 'KKR', 'BX', 'APO', 'CG', 'MSTR', 'ARM', 'RBLX', 'DDOG',
  'ASML', 'NVO', 'SAP', 'SHEL', 'HSBC', 'UL', 'BP', 'RIO', 'BCS', 'AZN',
]

const UK_SYMBOLS = ['HSBC', 'UL', 'BP', 'RIO', 'BCS', 'AZN']
const EU_SYMBOLS = ['ASML', 'NVO', 'SAP', 'SHEL']

export const REGION_BY_SYMBOL = Object.fromEntries([
  ...US_SYMBOLS.map((s) => [s, 'US']),
  ...UK_SYMBOLS.map((s) => [s, 'UK']),
  ...EU_SYMBOLS.map((s) => [s, 'EU']),
])

const NAME_BY_SYMBOL = {
  AAPL: 'Apple',
  MSFT: 'Microsoft',
  NVDA: 'NVIDIA',
  AMZN: 'Amazon',
  META: 'Meta',
  GOOGL: 'Alphabet',
  GOOG: 'Alphabet',
  TSLA: 'Tesla',
  PLTR: 'Palantir',
  AVGO: 'Broadcom',
  AMD: 'AMD',
  ASML: 'ASML',
  NVO: 'Novo Nordisk',
  SAP: 'SAP',
  SHEL: 'Shell',
  HSBC: 'HSBC',
  UL: 'Unilever',
  BP: 'BP',
  RIO: 'Rio Tinto',
  AZN: 'AstraZeneca',
}

const US_SOURCE = US_SYMBOLS.map((code, idx) => {
  const sectorPool = ['Tech', 'Finance', 'Healthcare', 'Energy', 'Industrial', 'Consumer']
  const sector = sectorPool[idx % sectorPool.length]
  const base = 40 + (idx % 20) * 18 + (idx % 3) * 0.5
  return {
    code,
    name: NAME_BY_SYMBOL[code] || code,
    sector,
    base,
    region: REGION_BY_SYMBOL[code] || 'US',
  }
})

const HOT_TAGS = ['AI', '決算', '高配当', '注目', '']

const build = (items, isUS) =>
  items.map((item, idx) => {
    const sign = idx % 3 === 0 ? 1 : -1
    const unit = isUS ? (0.25 + (idx % 5) * 0.35) : (8 + (idx % 7) * 7)
    const rawChange = sign * unit
    const change = isUS ? Number(rawChange.toFixed(2)) : Math.round(rawChange)
    const price = isUS
      ? Number((item.base + change).toFixed(2))
      : Math.max(10, Math.round(item.base + change))
    const prevClose = Math.max(0.01, price - change)
    const rate = (change / prevClose) * 100
    return {
      id: item.code,
      code: item.code,
      name: item.name,
      price,
      change,
      rate,
      sector: item.sector,
      region: item.region || 'US',
      tag: HOT_TAGS[idx % HOT_TAGS.length],
      news: `${item.name} の最新動向（モックデータ）`,
    }
  })

export const MOCK_STOCKS = {
  JP: build(JP_SOURCE, false),
  US: build(US_SOURCE, true),
}

