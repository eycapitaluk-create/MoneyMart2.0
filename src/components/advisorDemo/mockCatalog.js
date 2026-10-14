/** Section 8 mock catalogs — 30 funds, 60 stocks, 30 articles + calendar meetings. */

const rng = (seed) => {
  let x = seed | 0
  return () => {
    x = (x * 1664525 + 1013904223) | 0
    return (x >>> 0) / 4294967296
  }
}

const FUND_SEED = [
  ['1655.T', 'iShares S&P 500 米国株 ETF', '米国株', 0.15, 22.1, 45.2],
  ['1306.T', 'iFreeETF TOPIX', '日本株', 0.078, 15.2, 28.4],
  ['1320.T', 'iFreeETF 日経225(年1回決算型)', '日本株', 0.22, 18.5, 32.1],
  ['2559.T', 'MAXIS 全世界株式上場投信', '全世界', 0.10, 18.0, 38.5],
  ['1482.T', 'iシェアーズ・コア 米国債7-10年 ETF', '債券', 0.15, 2.1, 1.8],
  ['2510.T', 'NEXT FUNDS 国内債券 ETF', '債券', 0.07, 0.8, 1.2],
  ['1540.T', '純金上場信託', 'コモディティ', 0.40, 12.4, 28.0],
  ['1343.T', 'NEXT FUNDS 東証REIT', 'REIT', 0.17, 6.2, 11.0],
  ['2520.T', 'NEXT FUNDS 新興国株式', '新興国', 0.20, 11.3, 19.5],
  ['2558.T', 'MAXIS 米国株式(S&P500)', '米国株', 0.078, 21.4, 44.0],
  ['2631.T', 'MAXIS ナスダック100', '米国株', 0.20, 28.5, 52.0],
  ['147A.T', 'iFreeETF 全世界株式', '全世界', 0.12, 17.2, 36.0],
  ['148A.T', 'eMAXIS Slim 全世界株式', '全世界', 0.057, 17.8, 37.2],
  ['149A.T', 'eMAXIS Slim 米国株式', '米国株', 0.093, 22.0, 46.1],
  ['150A.T', 'eMAXIS Slim 先進国株式', '先進国', 0.098, 16.5, 34.0],
  ['2511.T', 'NEXT FUNDS 外国債券', '債券', 0.12, 3.4, 5.1],
  ['2513.T', 'NEXT FUNDS 外国REIT', 'REIT', 0.22, 8.1, 14.2],
  ['2521.T', 'NEXT FUNDS 中国株式', '新興国', 0.28, -4.2, 8.5],
  ['2564.T', 'グローバルX 半導体 ETF', 'テクノロジー', 0.69, 35.2, 88.0],
  ['2565.T', 'グローバルX AI・ロボティクス', 'テクノロジー', 0.68, 24.1, 55.0],
  ['1486.T', '上場インデックスファンド海外先進国', '先進国', 0.25, 15.8, 33.0],
  ['1699.T', 'NEXT FUNDS NOMURA原油', 'コモディティ', 0.50, -8.5, 12.0],
  ['2568.T', '上場インデックス世界債券', '債券', 0.15, 1.9, 3.2],
  ['2620.T', 'MAXIS 高配当日本株', '日本株', 0.19, 14.0, 25.0],
  ['2621.T', 'MAXIS 高配当米国株', '米国株', 0.19, 12.5, 28.0],
  ['2630.T', 'MAXIS Jリート', 'REIT', 0.25, 5.5, 9.8],
  ['2516.T', '東証銀行業 ETF', '金融', 0.25, 19.0, 41.0],
  ['1615.T', '東証銀行業株価指数連動', '金融', 0.25, 18.2, 39.5],
  ['1678.T', 'NEXT FUNDS インド株式', '新興国', 0.65, 21.0, 48.0],
  ['2519.T', 'NEXT FUNDS ベトナム株式', '新興国', 0.70, 9.5, 22.0],
]

export const mockFunds = FUND_SEED.map(([symbol, name, category, expense, ret1y, ret3y], i) => ({
  id: `fund-${i + 1}`,
  symbol,
  name,
  category,
  expense,
  ret1y,
  ret3y,
  ret1m: +(ret1y / 12 + (i % 5) * 0.1).toFixed(1),
  ret3m: +(ret1y / 4).toFixed(1),
  ret6m: +(ret1y / 2).toFixed(1),
  aumYen: Math.round((50 + i * 17) * 1e8),
  company: i % 3 === 0 ? 'BlackRock' : i % 3 === 1 ? 'Nomura AM' : 'Mitsubishi UFJ AM',
}))

const US_STOCKS = [
  ['AAPL', 'Apple Inc.', 'テクノロジー', 234.5, 1.2, 'US'],
  ['MSFT', 'Microsoft', 'テクノロジー', 421.2, 0.8, 'US'],
  ['NVDA', 'NVIDIA', 'テクノロジー', 875.3, 2.8, 'US'],
  ['GOOGL', 'Alphabet', 'テクノロジー', 178.4, 0.5, 'US'],
  ['META', 'Meta Platforms', 'テクノロジー', 512.1, 1.1, 'US'],
  ['AMZN', 'Amazon', '一般消費財', 188.2, -0.4, 'US'],
  ['TSLA', 'Tesla', '一般消費財', 248.0, 1.9, 'US'],
  ['JPM', 'JPMorgan Chase', '金融', 198.5, 0.3, 'US'],
  ['V', 'Visa', '金融', 279.0, 0.6, 'US'],
  ['JNJ', 'Johnson & Johnson', 'ヘルスケア', 158.2, -0.2, 'US'],
  ['BAC', 'Bank of America', '金融', 39.4, 0.4, 'US'],
  ['WMT', 'Walmart', '生活必需品', 68.1, 0.2, 'US'],
  ['PG', 'Procter & Gamble', '生活必需品', 165.0, -0.1, 'US'],
  ['KO', 'Coca-Cola', '生活必需品', 64.2, 0.1, 'US'],
  ['MCD', "McDonald's", '一般消費財', 295.0, 0.3, 'US'],
  ['DIS', 'Walt Disney', '一般消費財', 112.5, -0.8, 'US'],
  ['NFLX', 'Netflix', '通信', 685.0, 1.5, 'US'],
  ['HD', 'Home Depot', '一般消費財', 372.0, 0.2, 'US'],
  ['ORCL', 'Oracle', 'テクノロジー', 142.0, 0.9, 'US'],
  ['ADBE', 'Adobe', 'テクノロジー', 518.0, -1.2, 'US'],
  ['XOM', 'Exxon Mobil', 'エネルギー', 112.3, -0.5, 'US'],
  ['CVX', 'Chevron', 'エネルギー', 148.0, -0.3, 'US'],
  ['UNH', 'UnitedHealth', 'ヘルスケア', 542.0, 0.4, 'US'],
  ['LLY', 'Eli Lilly', 'ヘルスケア', 812.0, 1.8, 'US'],
  ['AVGO', 'Broadcom', 'テクノロジー', 168.0, 2.1, 'US'],
  ['COST', 'Costco', '生活必需品', 892.0, 0.5, 'US'],
  ['PEP', 'PepsiCo', '生活必需品', 171.0, -0.2, 'US'],
  ['MRK', 'Merck', 'ヘルスケア', 118.0, 0.3, 'US'],
  ['ABBV', 'AbbVie', 'ヘルスケア', 178.0, 0.6, 'US'],
  ['CRM', 'Salesforce', 'テクノロジー', 268.0, 1.0, 'US'],
]

const JP_STOCKS = [
  ['7203.T', 'トヨタ自動車', '資本財・産業', 3142, 0.5, 'JP'],
  ['6758.T', 'ソニーグループ', 'テクノロジー', 13200, -0.3, 'JP'],
  ['6861.T', 'キーエンス', 'テクノロジー', 68500, 0.8, 'JP'],
  ['8306.T', '三菱UFJフィナンシャル・グループ', '金融', 1682, 1.2, 'JP'],
  ['9984.T', 'ソフトバンクグループ', '通信', 9845, 2.1, 'JP'],
  ['7974.T', '任天堂', '一般消費財', 8420, -0.6, 'JP'],
  ['8035.T', '東京エレクトロン', 'テクノロジー', 24580, 1.5, 'JP'],
  ['6098.T', 'リクルートホールディングス', '一般消費財', 8120, 0.4, 'JP'],
  ['9433.T', 'KDDI', '通信', 4825, 0.2, 'JP'],
  ['9432.T', '日本電信電話', '通信', 158, 0.1, 'JP'],
  ['8058.T', '三菱商事', '資本財・産業', 2985, 0.7, 'JP'],
  ['8031.T', '三井物産', '資本財・産業', 3120, 0.5, 'JP'],
  ['8801.T', '三井不動産', '不動産', 1485, -0.4, 'JP'],
  ['8802.T', '三菱地所', '不動産', 2650, -0.2, 'JP'],
  ['2802.T', '味の素', '生活必需品', 5680, 0.3, 'JP'],
  ['4063.T', '信越化学工業', '素材', 5420, 0.6, 'JP'],
  ['4502.T', '武田薬品工業', 'ヘルスケア', 4250, -0.1, 'JP'],
  ['4568.T', '第一三共', 'ヘルスケア', 5120, 0.9, 'JP'],
  ['4901.T', '富士フイルム', 'ヘルスケア', 3580, 0.4, 'JP'],
  ['5108.T', 'ブリヂストン', '一般消費財', 5820, 0.2, 'JP'],
  ['6501.T', '日立製作所', '資本財・産業', 3985, 1.1, 'JP'],
  ['6752.T', 'パナソニック', 'テクノロジー', 1485, -0.5, 'JP'],
  ['6902.T', 'デンソー', '資本財・産業', 2280, 0.3, 'JP'],
  ['7011.T', '三菱重工業', '資本財・産業', 1850, 1.4, 'JP'],
  ['7267.T', 'ホンダ', '一般消費財', 1620, 0.6, 'JP'],
  ['7751.T', 'キヤノン', 'テクノロジー', 4850, -0.2, 'JP'],
  ['8001.T', '伊藤忠商事', '資本財・産業', 7850, 0.8, 'JP'],
  ['8316.T', '三井住友フィナンシャルグループ', '金融', 3820, 1.0, 'JP'],
  ['8411.T', 'みずほフィナンシャルグループ', '金融', 3125, 0.9, 'JP'],
  ['4503.T', 'アステラス製薬', 'ヘルスケア', 1685, -0.3, 'JP'],
]

export const mockStocks = [...US_STOCKS, ...JP_STOCKS].map(([symbol, name, sector, price, ret1d, market], i) => ({
  id: `stk-${i + 1}`,
  symbol,
  name,
  sector,
  price,
  ret1d,
  market,
  mcap: market === 'US' ? (50 + i * 12) * 1e9 : (2 + i) * 1e12,
  per: +(12 + (i % 20) * 0.8).toFixed(1),
  pbr: +(1.2 + (i % 10) * 0.15).toFixed(2),
  dividendYield: +(0.5 + (i % 15) * 0.2).toFixed(2),
  tags: i % 5 === 0 ? ['高配当'] : i % 7 === 0 ? ['成長株'] : i % 11 === 0 ? ['ESG'] : [],
  featured: i < 3,
}))

const ARTICLE_HEADLINES = [
  ['米国CPI予想を上回る — Fed 利上げ長期化の観測強まる', '市場', 'market', ['US_RATE', 'USD', 'US_EQUITY']],
  ['日銀、政策金利0.5%に据え置き — YCC継続', '政策', 'policy', ['BOJ_RATE', 'JPY', 'JP_EQUITY']],
  ['NVIDIA 決算好調 — AI 半導体需要旺盛', '企業', 'company', ['TECH', 'US_EQUITY']],
  ['WTI原油、80ドル台に急伸 — OPEC減産延長', '経済', 'economy', ['OIL', 'ENERGY']],
  ['トヨタ、円安追い風で通期業績上方修正', '企業', 'company', ['JPY', 'JP_EQUITY']],
  ['メガバンク3社、金利上昇で融資利益拡大', '金融', 'economy', ['BOJ_RATE', 'FINANCIALS', 'JP_EQUITY']],
  ['S&P 500 過去最高値更新 — テック牽引', '市場', 'market', ['US_EQUITY', 'TECH']],
  ['ドル円、150円台を維持 — 介入警戒続く', '経済', 'economy', ['JPY', 'USD']],
  ['Fed 利下げサイクル 2026 展望', '政策', 'policy', ['US_RATE', 'US_EQUITY']],
  ['日経平均、4万円台攻防 — 半導体株が主導', '市場', 'market', ['JP_EQUITY', 'TECH']],
  ['エネルギー株、原油高で再評価', '市場', 'market', ['OIL', 'ENERGY']],
  ['ソフトバンクG、AI投資を加速', '企業', 'company', ['TECH', 'JP_EQUITY']],
  ['米国雇用統計、予想を下回る', '経済', 'economy', ['US_RATE', 'US_EQUITY']],
  ['欧州ECB、政策金利据え置き', '政策', 'policy', ['US_RATE']],
  ['中国景気指標、回復の兆し', '経済', 'economy', ['JP_EQUITY']],
  ['配当貴族銘柄、インカム需要で堅調', '教育', 'education', ['US_EQUITY', 'FINANCIALS']],
  ['NISA成長投資枠、活用ポイント整理', '教育', 'education', ['JP_EQUITY']],
  ['REIT市場、金利の見方で二極化', '市場', 'market', ['US_RATE', 'JPY']],
  ['半導体装置メーカー、受注回復', '企業', 'company', ['TECH', 'JP_EQUITY']],
  ['ヘルスケアETF、安定需要続く', 'レポート', 'report', ['US_EQUITY']],
  ['円安メリット企業ランキング', 'レポート', 'report', ['JPY', 'JP_EQUITY']],
  ['債券利回り上昇と株式バリュエーション', '教育', 'education', ['US_RATE', 'US_EQUITY']],
  ['OPECプラス、減産延長を協議', '経済', 'economy', ['OIL', 'ENERGY']],
  ['米銀ストレステスト結果公表', '金融', 'economy', ['FINANCIALS', 'US_EQUITY']],
  ['日本株、海外投資家の買い越し続く', '市場', 'market', ['JP_EQUITY']],
  ['AI関連テーマ、顧客対話のポイント', '教育', 'education', ['TECH']],
  ['ゴールド、地政学リスクで買われる', '市場', 'market', ['OIL']],
  ['自動車セクター、EVシフトの進捗', '企業', 'company', ['JP_EQUITY']],
  ['四半期レビュー準備チェックリスト', 'レポート', 'report', ['US_EQUITY', 'JP_EQUITY']],
  ['ポートフォリオ分散 — 関連性で考える', '教育', 'education', ['US_EQUITY', 'TECH', 'JP_EQUITY']],
]

export const mockArticles = ARTICLE_HEADLINES.map(([title, category_label, category_key, factors], i) => {
  const d = new Date()
  d.setHours(d.getHours() - i * 3)
  return {
    id: `art-${String(i + 1).padStart(2, '0')}`,
    title,
    subtitle: '価格予測ではなく、保有資産との関連性を把握するための解説です。',
    category_key,
    category_label,
    body_markdown: `【概要】\n${title}\n\n・本記事は市場環境の整理を目的とします\n・個別銘柄の売買指示ではありません\n・お客様の保有資産との「関連性」確認に活用してください\n\n【ポイント】\n1. 関連ファクター: ${factors.join(', ')}\n2. 顧客対話では予測表現を避け、関連度を共有\n3. 最終判断はアドバイザーが行います`,
    image_url: '',
    created_at: d.toISOString(),
    reading_minutes: 3 + (i % 5),
    factors,
    badge: i === 8 ? '注目' : null,
    is_featured: i === 8,
  }
})

const KIND_CYCLE = ['review', 'regular', 'hearing', 'prep', 'review', 'regular', 'hearing', 'review', 'regular', 'review']
const MODE_CYCLE = ['Online', 'Office', 'Online', 'Video', 'Online', 'Office']
const TIMES = ['09:00', '10:30', '11:00', '14:00', '15:30', '16:00']

/** Build calendar meetings for ~20% of clients within ±30 days. */
export function buildCalendarMeetings(clients) {
  const r = rng(20260920)
  const meetings = []
  const pool = clients.filter((_, i) => i % 5 === 0).slice(0, Math.max(20, Math.floor(clients.length * 0.2)))
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  let n = 0
  for (const c of pool) {
    const count = 1 + Math.floor(r() * 2)
    for (let j = 0; j < count; j++) {
      const offset = Math.floor(r() * 61) - 30
      const d = new Date(today)
      d.setDate(d.getDate() + offset)
      const dateKey = d.toISOString().slice(0, 10)
      const kind = KIND_CYCLE[n % KIND_CYCLE.length]
      meetings.push({
        id: `cal-${n + 1}`,
        dateKey,
        time: TIMES[n % TIMES.length],
        title: kind === 'review' ? 'Q3 定期レビュー' : kind === 'hearing' ? '初回ヒアリング' : kind === 'prep' ? '面談準備' : 'フォローアップ',
        clientId: c.id,
        clientName: c.name,
        mode: MODE_CYCLE[n % MODE_CYCLE.length],
        kind,
      })
      n += 1
    }
  }
  // Ensure today has a couple for demo
  const todayKey = today.toISOString().slice(0, 10)
  if (!meetings.some((m) => m.dateKey === todayKey) && clients[0]) {
    meetings.push({
      id: 'cal-today-1',
      dateKey: todayKey,
      time: '10:30',
      title: '定期レビュー',
      clientId: clients[0].id,
      clientName: clients[0].name,
      mode: 'Online',
      kind: 'review',
    })
    if (clients[1]) {
      meetings.push({
        id: 'cal-today-2',
        dateKey: todayKey,
        time: '14:00',
        title: '初回ヒアリング',
        clientId: clients[1].id,
        clientName: clients[1].name,
        mode: 'Office',
        kind: 'hearing',
      })
    }
  }
  return meetings.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.time.localeCompare(b.time))
}

export const meetingKindConfig = {
  regular: { label: 'Meeting', color: '#a8b5b0' },
  review: { label: 'Review', color: '#7ba598' },
  hearing: { label: 'Hearing', color: '#c9a878' },
  prep: { label: 'Prep', color: '#94a3b8' },
}

export const SECTORS_HEATMAP = [
  { name: 'テクノロジー', marketCap: 28, ret1d: 1.2 },
  { name: '金融', marketCap: 14, ret1d: 0.8 },
  { name: 'ヘルスケア', marketCap: 12, ret1d: 0.3 },
  { name: 'エネルギー', marketCap: 8, ret1d: -2.1 },
  { name: '一般消費財', marketCap: 10, ret1d: 0.5 },
  { name: '生活必需品', marketCap: 7, ret1d: -0.2 },
  { name: '公益', marketCap: 4, ret1d: 0.1 },
  { name: '資本財・産業', marketCap: 9, ret1d: 0.6 },
  { name: '通信', marketCap: 5, ret1d: -0.4 },
  { name: '素材', marketCap: 4, ret1d: -0.8 },
  { name: '不動産', marketCap: 3, ret1d: -1.1 },
]

export const FEAR_GREED = {
  index: 57,
  label: '中立',
  metrics: [
    ['ボラティリティ', '低'],
    ['出来高', '正常'],
    ['セーフヘイブン', '需要低下'],
    ['ジャンク債', '需要高'],
    ['株式モメンタム', '強気'],
    ['市場全体幅', '改善'],
    ['プット/コール', '低'],
  ],
}
