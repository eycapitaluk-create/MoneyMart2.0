import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  ArrowRight,
  Zap, Map as MapIcon, ArrowUpRight, ArrowDownRight,
  Newspaper,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { fetchFundUniverseSnapshot } from '../lib/fundUniverse'
import { normalizeFundDisplayName } from '../lib/fundDisplayUtils'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import AdBanner from '../components/AdBanner'
import AdSidebar from '../components/AdSidebar'
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../data/etfListFromXlsx'
import { fetchNewsManualData, getFallbackNewsData, formatManualNewsUpdatedAtJa, isValidManualNewsTimestamp } from '../lib/newsManualClient'
import FearGreedIndex from '../components/market/FearGreedIndex'
import MarketMajorNewsTicker from '../components/market/MarketMajorNewsTicker'
import { heatmapChangeBgClass, signedReturnTextClassStrong } from '../lib/marketDirectionColors'

const REGION_TICKER_LIST = [
  { symbol: 'ACWI', exposure: 'All World' },
  { symbol: 'MCHI', exposure: 'CHINA' },
  { symbol: '1329.T', exposure: 'JAPAN (BENCHMARK)' },
  { symbol: '1475.T', exposure: 'JAPAN (Broad)' },
  { symbol: 'EUNK.DE', exposure: 'EUROPE' },
  { symbol: 'AAXJ', exposure: 'ASIA ex JAPAN' },
  { symbol: 'EEM', exposure: 'EM' },
  { symbol: 'IVV', exposure: 'US/LARGE CAP' },
  { symbol: 'IJH', exposure: 'US/Mid cap' },
  { symbol: 'IJR', exposure: 'US/SMALL CAP' },
]
const US_SECTOR_TICKER_LIST = [
  // Column G mapping source, shown in Japanese labels for UI.
  { symbol: 'IYE', sectorLabelJa: 'エネルギー' },
  { symbol: 'IYM', sectorLabelJa: '素材' },
  { symbol: 'IYJ', sectorLabelJa: '資本財・産業' },
  { symbol: 'IYC', sectorLabelJa: '一般消費財' },
  { symbol: 'IYK', sectorLabelJa: '生活必需品' },
  { symbol: 'IYH', sectorLabelJa: 'ヘルスケア' },
  { symbol: 'IYF', sectorLabelJa: '金融' },
  { symbol: 'IYW', sectorLabelJa: '情報技術' },
  { symbol: 'IYZ', sectorLabelJa: '通信サービス' },
  { symbol: 'IDU', sectorLabelJa: '公益事業' },
  { symbol: 'IYR', sectorLabelJa: '不動産' },
]

const uniqueBySymbol = (rows = []) => {
  const seen = new Set()
  return rows.filter((row) => {
    const symbol = String(row?.symbol || '').toUpperCase()
    if (!symbol || seen.has(symbol)) return false
    seen.add(symbol)
    return true
  })
}

/** Rankings only: narrow to funds that have a computable 1Y return once the universe snapshot loads. */
const applyFundUniverseEligibility = (processed, fundUniverseRows) => {
  const fundListEligibleSymbols = new Set(
    (Array.isArray(fundUniverseRows) ? fundUniverseRows : [])
      .filter((f) => f?.returnRate1Y != null && Number.isFinite(Number(f.returnRate1Y)))
      .map((f) => String(f.symbol || f.id || '').toUpperCase())
  )
  if (fundListEligibleSymbols.size === 0) return processed
  return processed.filter((p) => fundListEligibleSymbols.has(String(p.id || '').toUpperCase()))
}

const ETF_META_MAP = new Map(ETF_LIST_FROM_XLSX.map((item) => [item.symbol, item]))
const isJapaneseNewsItem = (item) => String(item?.language || '').toLowerCase() === 'ja'
const FALLBACK_WEEKLY_ECONOMIC_EVENTS = [
  { id: 'fallback-us-cpi', dateLabel: '3/10 (火)', country: 'US', event: '米国 消費者物価指数（CPI）', importance: 5 },
  { id: 'fallback-fomc', dateLabel: '3/17-18 (火-水)', country: 'US', event: 'FOMC 金利発表・経済見通し・ドットチャート', importance: 5 },
]
/** 2026年4〜8月の主要マクロ・決算・テックイベント要約（参考。公式日程で要確認） */
const CURATED_ECONOMIC_EVENTS = [
  // 4月 — 決算ピークと主要中央銀行
  {
    id: '2026-04-21-ms365-conf',
    dateLabel: '4/21-23 (火-木)',
    country: 'US',
    category: 'イベント',
    event: 'Microsoft 365 Community Conference（AI×ワークプレース）',
    impact: 'Copilot 等の企業導入事例・ロードマップが注目。',
    importance: 3,
  },
  {
    id: '2026-04-21-tsla-q1',
    dateLabel: '4/21（火）17:30頃ET',
    country: 'US',
    category: '決算',
    event: 'Tesla 1Q本決算（モデル2・FSD収益化ロードマップ）',
    impact: 'IRスケジュールに準拠。日本時間では翌日未明の可能性あり。',
    importance: 5,
  },
  {
    id: '2026-04-25-us-mag7-q1',
    dateLabel: '4月下旬',
    country: 'US',
    category: '決算',
    event: '米ビッグテック集中決算（Apple・Alphabet・Microsoft 等）',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-04-27-boj',
    dateLabel: '4/27-28 (月-火)',
    country: 'JP',
    category: '金利',
    event: '日銀（BoJ）金融政策決定会合（経済・物価情勢の展望含む）',
    impact: '円相場のボラティリティに留意。',
    importance: 5,
  },
  {
    id: '2026-04-28-fomc',
    dateLabel: '4/28-29 (火-水)',
    country: 'US',
    category: '金利',
    event: 'FRB FOMC 政策金利',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-04-29-ecb',
    dateLabel: '4/29-30 (水-木)',
    country: 'EU',
    category: '金利',
    event: 'ECB 理事会（金融政策・フランクフルト）',
    impact: '',
    importance: 5,
  },
  // 5月 — 日本決算・MSCI・テック
  {
    id: '2026-05-05-jp-fy-earnings',
    dateLabel: '5/05-15',
    country: 'JP',
    category: '決算',
    event: '日本主要企業の通期決算ピーク（トヨタ・ソニー・ソフトバンク等）',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-05-07-boe',
    dateLabel: '5/07 (木)',
    country: 'UK',
    category: '金利',
    event: '英中銀（BoE）政策金利＆金融政策レポート',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-05-12-msci',
    dateLabel: '5/12 (火)',
    country: 'GLOBAL',
    category: '資金フロー',
    event: 'MSCI 半期リバランス（日本・グローバル需給）',
    impact: '',
    importance: 4,
  },
  {
    id: '2026-05-18-dell-world',
    dateLabel: '5/18-21 (月-木)',
    country: 'US',
    category: 'イベント',
    event: 'Dell Technologies World（次世代サーバー・ストレージ）',
    impact: '',
    importance: 3,
  },
  {
    id: '2026-05-20-ecb-nc',
    dateLabel: '5/20 (水)',
    country: 'EU',
    category: '金利',
    event: 'ECB 非金融政策会合',
    impact: '',
    importance: 3,
  },
  {
    id: '2026-05-20-nvda-q1',
    dateLabel: '5/20 (水)',
    country: 'US',
    category: '決算',
    event: 'NVIDIA 1Q決算（AIセクター全体の風向け）',
    impact: '',
    importance: 5,
  },
  // 6月 — FOMC点図・WWDC
  {
    id: '2026-06-08-wwdc',
    dateLabel: '6/08-12 (月-金)',
    country: 'US',
    category: 'イベント',
    event: 'Apple WWDC 2026（iOS 20・Siri×Gemini 統合ロードマップ）',
    impact: '',
    importance: 4,
  },
  {
    id: '2026-06-10-ecb',
    dateLabel: '6/10-11 (水-木)',
    country: 'EU',
    category: '金利',
    event: 'ECB 政策金利決定会合',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-06-11-worldcup',
    dateLabel: '6/11 (木)',
    country: 'GLOBAL',
    category: 'イベント',
    event: '北米W杯2026 開幕（スポーツ・消費関連のモメンタム）',
    impact: '',
    importance: 3,
  },
  {
    id: '2026-06-15-boj',
    dateLabel: '6/15-16 (月-火)',
    country: 'JP',
    category: '金利',
    event: '日銀 金融政策決定会合',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-06-16-fomc',
    dateLabel: '6/16-17 (火-水)',
    country: 'US',
    category: '金利',
    event: 'FRB FOMC（経済見通し・ドットチャート＝下半期の利下げ回数が焦点）',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-06-18-boe',
    dateLabel: '6/18 (木)',
    country: 'UK',
    category: '金利',
    event: '英中銀（BoE）政策金利',
    impact: '',
    importance: 4,
  },
  // 7月 — 2Q決算・各国政策
  {
    id: '2026-07-15-q2-earnings',
    dateLabel: '7月中旬〜',
    country: 'GLOBAL',
    category: '決算',
    event: '2026年2Q（上期）決算シーズン本格化',
    impact: '',
    importance: 4,
  },
  {
    id: '2026-07-16-bok',
    dateLabel: '7/16 (木)',
    country: 'KR',
    category: '金利',
    event: '韓国銀行 基準金利決定',
    impact: '',
    importance: 4,
  },
  {
    id: '2026-07-22-ecb',
    dateLabel: '7/22-23 (水-木)',
    country: 'EU',
    category: '金利',
    event: 'ECB 政策金利決定会合',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-07-28-fomc',
    dateLabel: '7/28-29 (火-水)',
    country: 'US',
    category: '金利',
    event: 'FRB FOMC',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-07-29-boj',
    dateLabel: '7/29-30 (水-木)',
    country: 'JP',
    category: '金利',
    event: '日銀 金融政策決定会合',
    impact: '',
    importance: 5,
  },
  // 8月 — ジャクソンホール・サイバー・AIカンファ
  {
    id: '2026-08-01-blackhat',
    dateLabel: '8/01-06',
    country: 'US',
    category: 'イベント',
    event: 'Black Hat USA 2026（サイバーセキュリティ）',
    impact: '',
    importance: 3,
  },
  {
    id: '2026-08-04-ai4',
    dateLabel: '8/04-06',
    country: 'US',
    category: 'イベント',
    event: 'Ai4 2026（ビジネス向け大規模AIカンファレンス）',
    impact: '',
    importance: 3,
  },
  {
    id: '2026-08-06-boe',
    dateLabel: '8/06 (木)',
    country: 'UK',
    category: '金利',
    event: '英中銀（BoE）金利決定＆金融政策レポート',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-08-21-jackson-hole',
    dateLabel: '8/21-23 (金-日)',
    country: 'US',
    category: '政策',
    event: 'ジャクソンホール経済シンポジウム（パウエル議長の下半期政策基調）',
    impact: '',
    importance: 5,
  },
  {
    id: '2026-08-27-bok',
    dateLabel: '8/27 (木)',
    country: 'KR',
    category: '金利',
    event: '韓国銀行 基準金利決定',
    impact: '',
    importance: 4,
  },
]
/** DB未設定時：市場主要ニュース電光パネル（管理画面未設定時の既定スライド） */
const CURATED_MARKET_MAJOR_BOARD_SLIDES = [
  {
    id: 'weekly-focus-w4-a',
    headline: 'Weekly Focus · 2026年4月第4週（米株・決算）',
    lines: [
      '🚗 Tesla（TSLA）— 2026年度1Q本決算：4/21（火）17:30頃（ET）予定［Tesla IR］。納車台数の鈍化を受け実質営業利益率の維持度が焦点。低価格モデル（モデル2）の進捗とFSD収益化ロードマップに注目。',
      '📱 Meta（META）— 2026年度1Q決算：4/22（水）予定［Meta IR］。AI活用による広告配信の効率化が収益に寄与したか。Llama 4への投資規模とメタバース部門の損失管理が材料。',
    ],
  },
  {
    id: 'weekly-focus-w4-b',
    headline: 'Weekly Focus · 2026年4月第4週（日本株・米テック・日銀）',
    lines: [
      '⚙️ 日本電産（6594）— 2026年3月期通期本決算：4/23（木）15:00予定［Nidec IR］。生成AIサーバー向け水冷ユニットの需要が、EV向けモーター部門の苦戦をどこまで補うかが日本株センチメントの先行指標に。',
      '🔍 Alphabet（GOOGL）— 2026年度1Q決算：4/23（木）予定［Alphabet IR］。検索へのAI統合下での広告単価とGCP成長。AI軍拡競争の中でのコスト構造最適化が株価の方向感を左右しそうです。',
      '🏛 日本銀行（BoJ）— 金融政策決定会合および展望レポート：4/23（木）〜24（金）［日銀公式］。新年度の賃上げ浸透を踏まえた追加利上げタイミングの示唆、円安進行に対する植田総裁の牽制発言が為替に波及する可能性。',
    ],
  },
  {
    id: 'weekly-prior-tsm',
    headline: '今週の主要結果サマリー（先週）',
    lines: [
      '💎 TSMC（TSM）— 4/16（木）発表済み。AI半導体需要の「爆発的な継続」を裏付ける好決算。設備投資（CAPEX）計画も堅調で、日本の半導体製造装置メーカーへの安心感を後押し［TSMC IR］。',
    ],
  },
]

const toMajorNewsCard = (row, idx, fallbackPrefix) => ({
  id: String(row?.id || `${fallbackPrefix}-${idx}`),
  title: String(row?.title || '').trim(),
  detail: String(row?.description || row?.detail || '').trim(),
})

const formatMajorNewsTickerSegment = (card) => {
  const title = String(card?.title || '').trim()
  const detail = String(card?.detail || '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title && !detail) return ''
  if (!detail) return title
  return `${title} — ${detail}`
}
const JP_THEME_TILES = [
  { symbol: '1478.T', name: '日本高配当株式' },
  { symbol: '2854.T', name: 'トップ20テック株式' },
]
// 원자재: MarketStack /commodities (Professional+) 우선, 없으면 ETF 프록시
const COMMODITY_NAMES = ['gold', 'silver', 'copper', 'crude_oil']
const COMMODITY_NAME_JA = { gold: '金', silver: '銀', copper: '銅', crude_oil: '原油' }
const COMMODITY_ETF_FALLBACK = [
  { symbol: 'GLD', name: '金' },
  { symbol: 'SLV', name: '銀' },
  { symbol: 'CPER', name: '銅' },
  { symbol: 'USO', name: '原油' },
]
const MARKET_THEME_DEFINITIONS = [
  {
    id: 'ai',
    label: 'AI',
    keywords: ['ai', '人工知能', '生成ai', 'nvidia', 'エヌビディア', 'microsoft', 'マイクロソフト', 'openai'],
    fundKeywords: ['NASDAQ', 'FANG', 'AI', '米国株式', 'S&P500'],
    sectorHints: ['情報技術', '通信サービス'],
    tileHints: ['トップ20テック株式'],
    stockCandidates: [
      { symbol: 'NVDA', patterns: ['nvidia', 'エヌビディア'] },
      { symbol: 'MSFT', patterns: ['microsoft', 'マイクロソフト'] },
      { symbol: '6758.T', patterns: ['ソニー', 'sony'] },
      { symbol: '9984.T', patterns: ['ソフトバンク', 'softbank'] },
    ],
  },
  {
    id: 'semiconductor',
    label: '半導体',
    keywords: ['半導体', 'semiconductor', 'chip', 'tsmc', 'asml', '東京エレクトロン', 'アドバンテスト'],
    fundKeywords: ['半導体', 'NASDAQ', 'FANG', 'テック'],
    sectorHints: ['情報技術'],
    tileHints: ['トップ20テック株式'],
    stockCandidates: [
      { symbol: '8035.T', patterns: ['東京エレクトロン', 'tokyo electron'] },
      { symbol: '6857.T', patterns: ['アドバンテスト', 'advantest'] },
      { symbol: 'ASML', patterns: ['asml'] },
      { symbol: 'NVDA', patterns: ['nvidia', 'エヌビディア'] },
    ],
  },
  {
    id: 'dividend',
    label: '配当',
    keywords: ['配当', '高配当', 'dividend', '利回り', 'インカム'],
    fundKeywords: ['高配当', 'REIT', '配当'],
    sectorHints: ['金融', '公益事業', '不動産'],
    tileHints: ['日本高配当株式'],
    stockCandidates: [
      { symbol: '8306.T', patterns: ['mufg', '三菱ufj', '三菱ufjフィナンシャル'] },
      { symbol: '9432.T', patterns: ['ntt', '日本電信電話'] },
      { symbol: '9433.T', patterns: ['kddi'] },
      { symbol: 'KO', patterns: ['coca-cola', 'coca cola', 'コカ・コーラ'] },
    ],
  },
  {
    id: 'fx',
    label: '為替',
    keywords: ['為替', '円安', '円高', 'usd/jpy', 'ドル円', 'fx', 'yen', 'dollar'],
    fundKeywords: ['全世界', '先進国', '米国株式', 'S&P500'],
    sectorHints: ['一般消費財', '資本財・産業'],
    tileHints: [],
    stockCandidates: [
      { symbol: '7203.T', patterns: ['トヨタ', 'toyota'] },
      { symbol: '7974.T', patterns: ['任天堂', 'nintendo'] },
      { symbol: 'AAPL', patterns: ['apple', 'アップル'] },
      { symbol: '6758.T', patterns: ['ソニー', 'sony'] },
    ],
  },
]
const normalizeThemeText = (value = '') => String(value || '').toLowerCase()
const includeThemeKeyword = (text, keyword) => normalizeThemeText(text).includes(normalizeThemeText(keyword))
const formatSignedPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
const COUNTRY_EVENT_META = {
  US: { label: '米国', flag: '🇺🇸', dotClass: 'bg-blue-500' },
  JP: { label: '日本', flag: '🇯🇵', dotClass: 'bg-red-500' },
  EU: { label: '欧州', flag: '🇪🇺', dotClass: 'bg-indigo-500' },
  UK: { label: '英国', flag: '🇬🇧', dotClass: 'bg-cyan-500' },
  KR: { label: '韓国', flag: '🇰🇷', dotClass: 'bg-rose-500' },
  GLOBAL: { label: 'グローバル', flag: '🌏', dotClass: 'bg-slate-500' },
}
const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土']
const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000

/** id から日付をパースし、今日以降のイベントのみ返す */
const filterUpcomingEconomicEvents = (events) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return events.filter((item) => {
    const match = String(item.id || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, y, m, d] = match
      const eventDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10))
      eventDate.setHours(0, 0, 0, 0)
      return eventDate >= today
    }
    const monthMatch = String(item.id || '').match(/^(\d{4})-(\d{2})-/)
    if (monthMatch) {
      const [, y, m] = monthMatch
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0)
      lastDay.setHours(0, 0, 0, 0)
      return lastDay >= today
    }
    return true
  })
}

const toTokyoDateLabel = (value) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--/--'
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = WEEKDAY_JA[date.getDay()] || ''
  return `${month}/${day} (${weekday})`
}

const toIsoDateDaysAgo = (days = 7) => {
  const d = new Date(Date.now() - Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

const normalizeImportance = (importance) => {
  const n = Number(importance || 0)
  if (!Number.isFinite(n) || n <= 0) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
}

const toEconomicEventItem = (row, idx) => {
  const rawCountry = String(row?.country || row?.Country || '').toUpperCase()
  const country = rawCountry.includes('US') || rawCountry.includes('UNITED') ? 'US' : 'JP'
  return {
    id: String(row?.id || row?.CalendarId || `${country}-${idx}`),
    dateLabel: toTokyoDateLabel(row?.date || row?.Date),
    country,
    event: String(row?.event || row?.Event || '').trim() || '経済指標',
    importance: normalizeImportance(row?.importance || row?.Importance),
  }
}

const shortenCategory = (name) => {
  if (!name) return 'その他'
  if (name.includes('米国')) return '米国株'
  if (name.includes('国内') || name.includes('日本')) return '日本株'
  if (name.includes('先進国')) return '先進国'
  if (name.includes('新興国')) return '新興国'
  if (name.includes('全世界')) return '全世界'
  if (name.includes('債券')) return '債券'
  if (name.includes('REIT')) return 'REIT'
  return 'その他'
}

const inferEtfRegion = (symbol = '') => {
  if (symbol.endsWith('.T')) return 'JP'
  if (symbol.endsWith('.L')) return 'UK'
  if (/\.(PA|AS|DE|MI|MC|SW|BR|LS|ST|HE)$/i.test(symbol)) return 'EU'
  return 'US'
}

const inferExposureCountry = (symbol = '', fundName = '') => {
  const n = String(fundName || '').toUpperCase()
  if (n.includes('全世界') || n.includes('GLOBAL') || n.includes('ACWI') || n.includes('オール・カントリー')) return 'GLOBAL'
  if (n.includes('新興国') || n.includes('EMERGING')) return 'EM'
  if (n.includes('米国') || n.includes('S&P') || n.includes('NASDAQ') || n.includes('US ')) return 'US'
  if (n.includes('欧州') || n.includes('EUROPE')) return 'EU'
  if (n.includes('英国') || n.includes('UK')) return 'UK'
  if (n.includes('中国') || n.includes('CHINA')) return 'CN'
  if (n.includes('インド') || n.includes('INDIA')) return 'IN'
  if (n.includes('日本') || n.includes('TOPIX') || n.includes('日経') || symbol.endsWith('.T')) return 'JP'
  return inferEtfRegion(symbol)
}

const COUNTRY_LABEL_MAP = {
  JP: '日本',
  US: '米国',
  UK: '英国',
  EU: '欧州',
  CN: '中国',
  IN: 'インド',
  EM: '新興国',
  GLOBAL: '全世界',
}

const pickTileWeight = (volume, maxVolume) => {
  if (!Number.isFinite(volume) || volume <= 0) return 1
  const ratio = maxVolume > 0 ? volume / maxVolume : 0
  if (ratio >= 0.55) return 3
  if (ratio >= 0.2) return 2
  return 1
}

const getMarketLabelFromExposure = (exposure = '', symbol = '') => {
  const e = String(exposure || '').toUpperCase()
  if (symbol === '1329.T') return '日本株式市場（主要指数）'
  if (symbol.endsWith('.T')) return '日本株式市場'
  if (e.includes('US/LARGE')) return '米国大型株市場'
  if (e.includes('US/MID')) return '米国中型株市場'
  if (e.includes('US/SMALL')) return '米国小型株市場'
  if (e.includes('ALL WORLD') || e.includes('GLOBAL') || e.includes('ACWI')) return '全世界株式市場'
  if (e.includes('CHINA')) return '中国株式市場'
  if (e.includes('EUROPE')) return '欧州株式市場'
  if (e.includes('ASIA EX JAPAN')) return 'アジア(除く日本)株式市場'
  if (e.includes('EM')) return '新興国株式市場'
  return '株式市場'
}

export default function MarketPage({ session = null }) {
  const navigate = useNavigate()
  const [topFunds, setTopFunds] = useState([])
  const [inflowFunds, setInflowFunds] = useState([])
  const [liveFundSignals, setLiveFundSignals] = useState([])
  const [heatmapData, setHeatmapData] = useState([])
  const [heatmapDataDate, setHeatmapDataDate] = useState(null)
  const [regionPerformanceRows, setRegionPerformanceRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [marketDataStatus, setMarketDataStatus] = useState('')
  const [newsState, setNewsState] = useState(() => getFallbackNewsData())
  const [weeklyEconomicEvents] = useState(CURATED_ECONOMIC_EVENTS)
  const upcomingEconomicEvents = useMemo(() => filterUpcomingEconomicEvents(weeklyEconomicEvents), [weeklyEconomicEvents])
  const [jpThemeTiles, setJpThemeTiles] = useState([])
  const [commodityTiles, setCommodityTiles] = useState([])
  const [selectedThemeId, setSelectedThemeId] = useState(MARKET_THEME_DEFINITIONS[0].id)
  const [activeEtfTop5Group, setActiveEtfTop5Group] = useState(0)

  const isLoggedIn = Boolean(session?.user)

  const etfTop5Sections = useMemo(() => [
    { id: 'return', title: '週間騰落 Top5', list: topFunds, metric: (f) => `${Number(f.dayChange ?? f.return1y ?? 0) >= 0 ? '+' : ''}${(f.dayChange ?? f.return1y ?? 0).toFixed(1)}%`, metricClass: (f) => signedReturnTextClassStrong(Number(f.dayChange ?? f.return1y ?? 0)) },
    { id: 'volume', title: '出来高 Top5', list: inflowFunds, metric: (f) => `${Math.round(Number(f.inflow || 0)).toLocaleString()}万`, metricClass: () => 'text-slate-500 dark:text-slate-400' },
  ], [topFunds, inflowFunds])

  useEffect(() => {
    if (etfTop5Sections.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setActiveEtfTop5Group((c) => (c + 1) % etfTop5Sections.length)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [etfTop5Sections.length])

  const tickerNews = (newsState.marketTicker || []).filter(isJapaneseNewsItem)
  const pickupNews = (newsState.marketPickup || []).filter(isJapaneseNewsItem)
  const fundNews = (newsState.fundPickup || []).filter(isJapaneseNewsItem)
  const disclosureNews = (newsState.stockDisclosures || []).filter(isJapaneseNewsItem)
  const effectiveTickerNews = tickerNews
  const effectivePickupNews = pickupNews
  const effectiveFundNews = fundNews
  const effectiveDisclosureNews = disclosureNews
  const manualNewsUpdatedLabelJa = useMemo(
    () => formatManualNewsUpdatedAtJa(newsState.updatedAt),
    [newsState.updatedAt],
  )
  const marketMajorBoardSlides = useMemo(() => {
    const majorRaw = (newsState.marketMajorEvents || []).filter(isJapaneseNewsItem)
    const weeklyRaw = (newsState.marketWeeklySummary || []).filter(isJapaneseNewsItem)
    const majorCardsFromDb = majorRaw.map((row, idx) => toMajorNewsCard(row, idx, 'major'))
    const weeklyCardsFromDb = weeklyRaw.map((row, idx) => toMajorNewsCard(row, idx, 'summary'))
    const dbSlides = []
    if (majorCardsFromDb.length > 0) {
      dbSlides.push({
        id: 'db-major',
        headline: 'メジャー企業・イベント',
        lines: majorCardsFromDb.map(formatMajorNewsTickerSegment).filter(Boolean),
      })
    }
    if (weeklyCardsFromDb.length > 0) {
      dbSlides.push({
        id: 'db-weekly',
        headline: '今週の主要結果サマリー',
        lines: weeklyCardsFromDb.map(formatMajorNewsTickerSegment).filter(Boolean),
      })
    }
    return dbSlides.length > 0 ? dbSlides : CURATED_MARKET_MAJOR_BOARD_SLIDES
  }, [newsState.marketMajorEvents, newsState.marketWeeklySummary])

  useEffect(() => {
    let cancelled = false
    const loadNews = async () => {
      try {
        const payload = await fetchNewsManualData()
        if (!cancelled) setNewsState(payload)
      } catch {
        if (!cancelled) setNewsState(getFallbackNewsData())
      }
    }
    loadNews()
    return () => { cancelled = true }
  }, [])
  // Keep a curated macro calendar list for mock/demo consistency.
  useEffect(() => {
    let rankingFetchCancelled = false
    let fetchSeq = 0
    const fetchData = async () => {
      const seq = ++fetchSeq
      let processedBase = null
      try {
        setIsLoading(true)
        setMarketDataStatus('')
        let processed = []

        // Build heatmap from live ETF prices (v_stock_latest). 병렬 fetch로 로딩 개선.
        const historyFromDate = toIsoDateDaysAgo(10)
        const customHeatmapSymbols = [
          ...new Set([
            ...REGION_TICKER_LIST.map((row) => row.symbol),
            ...US_SECTOR_TICKER_LIST.map((row) => row.symbol),
            ...JP_THEME_TILES.map((row) => row.symbol),
            ...COMMODITY_ETF_FALLBACK.map((t) => t.symbol),
          ]),
        ]

        const etfLatestBatches = []
        for (let i = 0; i < ETF_SYMBOLS_FROM_XLSX.length; i += 80) {
          etfLatestBatches.push(ETF_SYMBOLS_FROM_XLSX.slice(i, i + 80))
        }
        const etfRecentBatches = []
        for (let i = 0; i < ETF_SYMBOLS_FROM_XLSX.length; i += 80) {
          etfRecentBatches.push(ETF_SYMBOLS_FROM_XLSX.slice(i, i + 80))
        }

        // 1) First paint fast: heatmap + region + commodity first.
        const [customLatestRes, customRecentRes, commodityRes] = await Promise.all([
          supabase.from('v_stock_latest').select('symbol,trade_date,close,volume').in('symbol', customHeatmapSymbols),
          supabase.from('stock_daily_prices').select('symbol,trade_date,close')
            .in('symbol', customHeatmapSymbols)
            .gte('trade_date', historyFromDate)
            .order('trade_date', { ascending: false }),
          supabase.from('commodity_daily_prices').select('commodity_name,trade_date,percentage_day')
            .in('commodity_name', COMMODITY_NAMES)
            .order('trade_date', { ascending: false }),
        ])

        if (customLatestRes.error) throw customLatestRes.error
        if (customRecentRes.error) throw customRecentRes.error
        const customLatestRows = customLatestRes.data || []
        const customRecentRows = customRecentRes.data || []

        const buildPreviousCloseMap = (latestRows, historyRows) => {
          const bySymbol = new Map()
          for (const row of historyRows || []) {
            const symbol = String(row?.symbol || '').toUpperCase()
            if (!symbol) continue
            if (!bySymbol.has(symbol)) bySymbol.set(symbol, [])
            bySymbol.get(symbol).push(row)
          }
          const prevMap = new Map()
          for (const latest of latestRows || []) {
            const symbol = String(latest?.symbol || '').toUpperCase()
            const latestTradeDate = String(latest?.trade_date || '')
            const rows = bySymbol.get(symbol) || []
            const prev = rows.find((row) => String(row?.trade_date || '') < latestTradeDate)
            const prevClose = Number(prev?.close)
            if (Number.isFinite(prevClose) && prevClose > 0) {
              prevMap.set(symbol, prevClose)
            }
          }
          return prevMap
        }

        const customPrevCloseMap = buildPreviousCloseMap(customLatestRows, customRecentRows)
        const customLatestMap = new Map(
          customLatestRows
            .map((row) => [String(row.symbol || '').toUpperCase(), row])
        )

        const jpThemeRows = JP_THEME_TILES.map((tile) => {
          const symbol = String(tile.symbol || '').toUpperCase()
          const live = customLatestMap.get(symbol)
          const close = Number(live?.close)
          const prevClose = Number(customPrevCloseMap.get(symbol))
          const validMove = Number.isFinite(prevClose) && Number.isFinite(close) && prevClose > 0
          if (!validMove) return null
          const change = ((close - prevClose) / prevClose) * 100
          const match = { change }
          if (!match || !Number.isFinite(Number(match.change))) return null
          return {
            symbol: tile.symbol,
            name: tile.name,
            change: Number(Number(match.change).toFixed(1)),
          }
        }).filter(Boolean)
        setJpThemeTiles(jpThemeRows)

        const buildTilesFromCustom = (tiles) =>
          tiles
            .map((tile) => {
              const symbol = String(tile.symbol || '').toUpperCase()
              const live = customLatestMap.get(symbol)
              const close = Number(live?.close)
              const prevClose = Number(customPrevCloseMap.get(symbol))
              if (!Number.isFinite(prevClose) || !Number.isFinite(close) || prevClose <= 0) return null
              const change = Number((((close - prevClose) / prevClose) * 100).toFixed(1))
              return { symbol: tile.symbol, name: tile.name, change }
            })
            .filter(Boolean)
        // 원자재: commodity_daily_prices (MarketStack /commodities) 우선, 없으면 ETF
        let commodityTilesData = []
        const commodityRows = commodityRes.data || []
        const commodityErr = commodityRes.error
        if (!commodityErr && commodityRows && commodityRows.length > 0) {
            const byName = new Map()
            for (const r of commodityRows) {
              const name = String(r?.commodity_name || '')
              if (!byName.has(name)) byName.set(name, r)
            }
            commodityTilesData = COMMODITY_NAMES
              .map((name) => {
                const row = byName.get(name)
                const pct = Number(row?.percentage_day)
                if (!row || !Number.isFinite(pct)) return null
                return { symbol: name, name: COMMODITY_NAME_JA[name] || name, change: Number(pct.toFixed(1)) }
              })
              .filter(Boolean)
        }
        if (commodityTilesData.length === 0) {
          commodityTilesData = buildTilesFromCustom(COMMODITY_ETF_FALLBACK)
        }
        setCommodityTiles(commodityTilesData)

        const sectorRows = uniqueBySymbol(US_SECTOR_TICKER_LIST).map((meta) => {
          const symbol = String(meta.symbol || '').toUpperCase()
          const live = customLatestMap.get(symbol)
          const close = Number(live?.close)
          const prevClose = Number(customPrevCloseMap.get(symbol))
          const validMove = Number.isFinite(prevClose) && Number.isFinite(close) && prevClose > 0
          if (!validMove) return null
          return {
            name: meta.sectorLabelJa || meta.symbol,
            change: Number((((close - prevClose) / prevClose) * 100).toFixed(1)),
            volume: Math.max(0, Number(live?.volume || 0)),
          }
        }).filter(Boolean)
        setHeatmapData(
          sectorRows
            .map((row) => ({
              name: row.name,
              change: row.change,
            }))
        )
        const latestHeatmapDate = customLatestRows.map((row) => String(row?.trade_date || '')).filter(Boolean).sort().at(-1) || null
        setHeatmapDataDate(latestHeatmapDate)

        const regionRows = REGION_TICKER_LIST
          .map((meta) => {
            const symbol = String(meta.symbol || '').toUpperCase()
            const live = customLatestMap.get(symbol)
            const close = Number(live?.close || 0)
            const prevClose = Number(customPrevCloseMap.get(symbol))
            if (!Number.isFinite(prevClose) || !Number.isFinite(close) || prevClose <= 0) return null
            const retDayOverDay = Number((((close - prevClose) / prevClose) * 100).toFixed(1))
            const marketLabel = getMarketLabelFromExposure(meta.exposure, symbol)
            return {
              id: symbol,
              name: marketLabel,
              country: inferExposureCountry(symbol, meta.exposure),
              retDayOverDay,
              volume: Math.max(0, Number(live?.volume || 0)),
            }
          })
          .filter(Boolean)
          .sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0))
        setRegionPerformanceRows(regionRows.map(({ volume, ...row }) => row))
        if (sectorRows.length === 0 && regionRows.length === 0) {
          setHeatmapData([])
          setHeatmapDataDate(null)
          setRegionPerformanceRows([])
          setJpThemeTiles([])
          setCommodityTiles([])
          setMarketDataStatus((prev) => prev || 'ヒートマップ用ETFデータがまだありません。')
        }

        // Heatmap/region blocks are ready at this point; keep ETF ranking hydration in background.
        if (seq === fetchSeq) setIsLoading(false)

        // 2) Heavy ETF ranking fetch in background.
        const [etfLatestResults, etfRecentResults] = await Promise.all([
          Promise.all(etfLatestBatches.map((batch) =>
            supabase.from('v_stock_latest').select('symbol,trade_date,close,volume').in('symbol', batch)
          )),
          Promise.all(etfRecentBatches.map((batch) =>
            supabase.from('stock_daily_prices').select('symbol,trade_date,close')
              .in('symbol', batch)
              .gte('trade_date', historyFromDate)
              .order('trade_date', { ascending: false })
          )),
        ])

        const etfLatestRows = etfLatestResults.flatMap((r) => {
          if (r.error) throw r.error
          return r.data || []
        })
        const etfRecentRows = etfRecentResults.flatMap((r) => {
          if (r.error) throw r.error
          return r.data || []
        })
        const etfPrevCloseMap = buildPreviousCloseMap(etfLatestRows, etfRecentRows)
        const etfRows = etfLatestRows
          .map((row) => {
            const symbol = String(row?.symbol || '').toUpperCase()
            const close = Number(row?.close)
            const prevClose = Number(etfPrevCloseMap.get(symbol))
            if (!symbol || !Number.isFinite(close) || !Number.isFinite(prevClose) || prevClose <= 0) return null
            const change = ((close - prevClose) / prevClose) * 100
            const meta = ETF_META_MAP.get(symbol)
            const name = meta?.jpName || symbol
            return {
              symbol,
              name,
              category: shortenCategory(name),
              country: inferExposureCountry(symbol, name),
              change,
              volume: Math.max(0, Number(row.volume || 0)),
            }
          })
          .filter(Boolean)

        if (etfRows.length > 0) {
          processedBase = etfRows.map((row) => ({
            id: row.symbol,
            name: normalizeFundDisplayName(row.name),
            category: row.category,
            shortCat: row.category,
            // QUICK/funds fallback removed: use live ETF move as ranking signal.
            return1y: Number(row.change || 0),
            dayChange: Number(row.change || 0),
            // Proxy inflow from traded volume; normalize to human-readable unit.
            inflow: Number((Number(row.volume || 0) / 10000).toFixed(2)),
            country: row.country,
            price: 0,
          }))
          processed = applyFundUniverseEligibility(processedBase, [])
        }

        setLiveFundSignals(processed)
        setTopFunds([...processed].sort((a, b) => b.return1y - a.return1y).slice(0, 5))
        setInflowFunds([...processed].sort((a, b) => b.inflow - a.inflow).slice(0, 5))
        if (!processed.length) {
          setLiveFundSignals([])
          setTopFunds([])
          setInflowFunds([])
          setMarketDataStatus('ETFランキングデータがまだありません。')
        }

        if (processedBase && processedBase.length > 0) {
          fetchFundUniverseSnapshot()
            .then((fundUniverseRows) => {
              if (rankingFetchCancelled || seq !== fetchSeq) return
              const refined = applyFundUniverseEligibility(processedBase, fundUniverseRows || [])
              setLiveFundSignals(refined)
              setTopFunds([...refined].sort((a, b) => b.return1y - a.return1y).slice(0, 5))
              setInflowFunds([...refined].sort((a, b) => b.inflow - a.inflow).slice(0, 5))
            })
            .catch(() => {})
        }
      } catch (err) {
        console.error('Data Fetch Error:', err)
        setTopFunds([])
        setInflowFunds([])
        setLiveFundSignals([])
        setHeatmapData([])
        setHeatmapDataDate(null)
        setRegionPerformanceRows([])
        setJpThemeTiles([])
        setCommodityTiles([])
        setMarketDataStatus('ランキングデータの取得に失敗しました。')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
    const intervalId = window.setInterval(fetchData, DAILY_REFRESH_MS)
    return () => {
      rankingFetchCancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  const market3LineSummary = useMemo(() => {
    const jp = regionPerformanceRows.find((row) => row.country === 'JP')
    const us = regionPerformanceRows.find((row) => row.country === 'US')
    const avgTop = topFunds.reduce((acc, cur) => acc + Number((cur.dayChange ?? cur.return1y) || 0), 0) / Math.max(topFunds.length, 1)
    const jpRet = Number(jp?.retDayOverDay || 0)
    const usRet = Number(us?.retDayOverDay || 0)
    const topHeadline = String(newsState?.dailyBrief?.headline || effectiveTickerNews[0]?.title || '').trim()
    const topHeadlineShort = topHeadline ? `${topHeadline.slice(0, 34)}${topHeadline.length > 34 ? '...' : ''}` : '主要ニュースは未取得'
    return [
      `指数: 日本 ${jpRet >= 0 ? '+' : ''}${jpRet.toFixed(1)}% / 米国 ${usRet >= 0 ? '+' : ''}${usRet.toFixed(1)}%`,
      `ニュース: ${topHeadlineShort}`,
      `ETF: 上位ファンド平均 ${avgTop >= 0 ? '+' : ''}${avgTop.toFixed(1)}% (前日比)`,
    ]
  }, [effectiveTickerNews, newsState?.dailyBrief?.headline, regionPerformanceRows, topFunds])

  const autoThemes = useMemo(() => {
    const newsItems = [
      ...effectiveTickerNews,
      ...effectivePickupNews,
      ...effectiveFundNews,
      ...effectiveDisclosureNews,
    ]
    const newsText = newsItems
      .map((item) => `${item.title || ''} ${item.description || ''}`)
      .join(' ')

    const themes = MARKET_THEME_DEFINITIONS.map((theme) => {
      const newsHits = theme.keywords.reduce((sum, keyword) => (
        includeThemeKeyword(newsText, keyword) ? sum + 1 : sum
      ), 0)

      const sectorRows = heatmapData.filter((row) => theme.sectorHints.some((hint) => includeThemeKeyword(row.name, hint)))
      const sectorAvg = sectorRows.length > 0
        ? sectorRows.reduce((sum, row) => sum + Number(row.change || 0), 0) / sectorRows.length
        : 0

      const tileRows = jpThemeTiles.filter((row) => theme.tileHints.some((hint) => includeThemeKeyword(row.name, hint)))
      const tileAvg = tileRows.length > 0
        ? tileRows.reduce((sum, row) => sum + Number(row.change || 0), 0) / tileRows.length
        : 0

      const relatedFunds = liveFundSignals
        .filter((fund) => {
          const text = `${fund.name || ''} ${fund.shortCat || ''} ${fund.country || ''}`
          return theme.fundKeywords.some((keyword) => includeThemeKeyword(text, keyword))
        })
        .sort((a, b) => Number((b.dayChange ?? b.return1y) || 0) - Number((a.dayChange ?? a.return1y) || 0))
        .slice(0, 2)

      const mentionedStocks = theme.stockCandidates
        .filter((candidate) => candidate.patterns.some((pattern) => includeThemeKeyword(newsText, pattern)))
        .map((candidate) => candidate.symbol)

      const dominantSignal = [
        newsHits > 0 ? `関連ニュース ${newsHits}件` : null,
        Number.isFinite(sectorAvg) && sectorRows.length > 0 ? `関連セクター ${formatSignedPct(sectorAvg)}` : null,
        Number.isFinite(tileAvg) && tileRows.length > 0 ? `国内テーマ ${formatSignedPct(tileAvg)}` : null,
        relatedFunds[0] ? `関連ETF ${formatSignedPct(Number((relatedFunds[0].dayChange ?? relatedFunds[0].return1y) || 0))}` : null,
      ].filter(Boolean)

      if (dominantSignal.length === 0) return null

      const fallbackStocks = theme.stockCandidates
        .map((candidate) => candidate.symbol)
        .filter(Boolean)

      const relatedStocks = [...new Set([
        ...mentionedStocks,
        ...(mentionedStocks.length === 0 ? fallbackStocks : []),
      ])].slice(0, 3)

      const summary = `${dominantSignal.join(' / ')} を確認中。`

      const score = (newsHits * 3) + Math.max(sectorAvg, 0) + Math.max(tileAvg, 0) + Math.max(Number((relatedFunds[0]?.dayChange ?? relatedFunds[0]?.return1y) || 0), 0)

      return {
        id: theme.id,
        label: theme.label,
        summary,
        stocks: relatedStocks,
        funds: relatedFunds.map((fund) => fund.name),
        score,
      }
    })

    return themes
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
  }, [effectiveDisclosureNews, effectiveFundNews, effectivePickupNews, effectiveTickerNews, heatmapData, jpThemeTiles, liveFundSignals])

  useEffect(() => {
    if (!autoThemes.length) return
    if (!autoThemes.some((theme) => theme.id === selectedThemeId)) {
      setSelectedThemeId(autoThemes[0].id)
    }
  }, [autoThemes, selectedThemeId])

  const activeTheme = useMemo(
    () => autoThemes.find((theme) => theme.id === selectedThemeId) || autoThemes[0] || {
      id: 'fallback',
      label: 'テーマ',
      summary: '関連データはまだありません。',
      stocks: [],
      funds: [],
    },
    [autoThemes, selectedThemeId]
  )
  const newsUpdatedLabel = useMemo(() => {
    if (!isValidManualNewsTimestamp(newsState?.updatedAt)) return 'ニュース基準: 取得中'
    const d = new Date(newsState.updatedAt)
    return `ニュース基準: ${d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
  }, [newsState?.updatedAt])
  const marketDataBasisLabel = isLoading ? '市場データ基準: 更新中' : '市場データ基準: 最新保存値'

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 animate-fadeIn pb-24 min-h-screen bg-gray-50 dark:bg-slate-900 font-sans transition-colors duration-300">
      {/* 1. Scrolling News Ticker */}
      <div className="bg-slate-900 dark:bg-black text-white rounded-2xl shadow-md mb-6 border border-slate-700 overflow-hidden">
        <div className="py-3 overflow-hidden whitespace-nowrap">
          {effectiveTickerNews.length > 0 ? (
            <div className="inline-flex animate-ticker-market items-center gap-10 pl-4 pr-16 min-w-max">
              {[...effectiveTickerNews, ...effectiveTickerNews, ...effectiveTickerNews].map((item, i) => (
                <span key={`${item.source}-${i}`} className="flex items-center gap-2 text-xs md:text-sm shrink-0">
                  <span className="text-orange-400 font-black">{item.source}</span>
                  <span className="text-slate-200 font-bold">{item.title}</span>
                  <span className="text-slate-500 font-mono">{item.time}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="px-4 text-xs md:text-sm font-bold text-slate-400">
              日本語ニュースはまだありません
            </div>
          )}
        </div>
      </div>
      {marketDataStatus ? (
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-900/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300">
          {marketDataStatus}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-4">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">今日のマーケット3行要約</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <span>{market3LineSummary[0] ?? ''}</span>
                <span>・</span>
                <span className="line-clamp-1">{market3LineSummary[1] ?? ''}</span>
                <span className="ml-auto">{market3LineSummary[2] ?? ''}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/funds')}
                className="w-full px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black inline-flex items-center justify-center gap-1"
              >
                詳しくはファンド比較へ <ArrowRight size={14} />
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {etfTop5Sections[activeEtfTop5Group]?.title ?? 'ETF Top5'}
                </h3>
                <div className="flex items-center gap-1">
                  {etfTop5Sections.map((_, idx) => (
                    <button
                      key={`etf-top5-${idx}`}
                      type="button"
                      onClick={() => setActiveEtfTop5Group(idx)}
                      className={`h-1.5 rounded-full transition-all ${activeEtfTop5Group === idx ? 'w-4 bg-orange-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`}
                      aria-label={`ETF Top5 ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                {(etfTop5Sections[activeEtfTop5Group]?.list ?? []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-2">ETFデータを読み込み中...</p>
                ) : (etfTop5Sections[activeEtfTop5Group]?.list ?? []).map((fund) => (
                  <button
                    key={fund.id}
                    type="button"
                    onClick={() => navigate(`/funds/${fund.id}`)}
                    className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition"
                  >
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{fund.name}</span>
                    <span className={`text-[11px] font-black shrink-0 ${etfTop5Sections[activeEtfTop5Group]?.metricClass?.(fund) ?? 'text-slate-500'}`}>
                      {etfTop5Sections[activeEtfTop5Group]?.metric?.(fund) ?? ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">最近の関連テーマ</h3>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {autoThemes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedThemeId(theme.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-black border transition ${
                      activeTheme.id === theme.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {activeTheme.summary}
                {activeTheme.stocks.length > 0 && ` 関連: ${activeTheme.stocks.join(' ')} ${activeTheme.funds[0] || ''}`}
              </p>
            </div>
          </section>

          {/* 2. Heatmap + Region Heatmap */}
          <div className="relative mt-10">
            <div className={`${!isLoggedIn ? 'blur-[6px] pointer-events-none select-none' : ''}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapIcon className="text-blue-600 dark:text-blue-400" size={20} /> セクターヒートマップ
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    前営業日終値比の騰落率（各タイルに表示）。サイズは時価総額プロキシ。
                    {heatmapDataDate && (
                      <span className="ml-1.5 font-semibold text-slate-600 dark:text-slate-300">データ日: {heatmapDataDate}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 grid-rows-4 gap-2 h-[448px]">
                {isLoading ? (
                  <div className="col-span-3 row-span-4 flex items-center justify-center text-sm font-bold text-slate-400">
                    ヒートマップを読み込み中...
                  </div>
                ) : heatmapData.length === 0 ? (
                  <div className="col-span-3 row-span-4 flex items-center justify-center text-sm font-bold text-slate-400">
                    ヒートマップ用の実データがまだありません
                  </div>
                ) : heatmapData.map((item, idx) => {
                  const bgClass = heatmapChangeBgClass(Number(item.change || 0))
                  return (
                    <div
                      key={idx}
                      className={`col-span-1 row-span-1 ${bgClass} rounded-xl p-4 flex flex-col items-center justify-center text-white transition hover:scale-[1.02] cursor-default shadow-sm relative overflow-hidden group gap-1`}
                    >
                      <span className="font-bold text-[11.5px] md:text-[12.5px] z-10 leading-snug text-center line-clamp-2 break-keep">{item.name}</span>
                      <span className="text-[9px] font-black z-10 opacity-90 tracking-tight">前営業日終値比</span>
                      <span className="font-black text-lg md:text-xl z-10 flex items-center">
                        {item.change > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        {Math.abs(Number(item.change || 0)).toFixed(1)}%
                      </span>
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition" />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapIcon className="text-blue-600 dark:text-blue-400" size={20} /> 国家別ヒートマップ
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    前営業日終値比の騰落率（ETF実データ・各タイルに表示）。
                    {heatmapDataDate && (
                      <span className="ml-1.5 font-semibold text-slate-600 dark:text-slate-300">データ日: {heatmapDataDate}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 grid-rows-4 gap-2 h-[448px]">
                {isLoading ? (
                  <div className="col-span-3 row-span-4 flex items-center justify-center text-sm font-bold text-slate-400">
                    国家別データを読み込み中...
                  </div>
                ) : regionPerformanceRows.length === 0 ? (
                  <div className="col-span-3 row-span-4 flex items-center justify-center text-sm font-bold text-slate-400">
                    国家別の実データがまだありません
                  </div>
                ) : regionPerformanceRows.map((row) => {
                  const bgClass = heatmapChangeBgClass(Number(row.retDayOverDay || 0))
                  return (
                    <div
                      key={row.id || `${row.country}-${row.name}`}
                      className={`col-span-1 row-span-1 ${bgClass} rounded-xl p-3 text-white shadow-sm relative overflow-hidden group cursor-default transition hover:scale-[1.02] flex flex-col justify-center gap-1`}
                    >
                      <p className="text-[11.5px] md:text-[12.5px] font-bold opacity-90 leading-snug text-center line-clamp-2 break-keep">
                        {row.name}
                      </p>
                      <p className="text-[9px] font-black opacity-90 text-center tracking-tight">前営業日終値比</p>
                      <p className="text-xl font-black mt-2 inline-flex items-center gap-1">
                        {row.retDayOverDay >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {row.retDayOverDay >= 0 ? '+' : ''}{row.retDayOverDay.toFixed(1)}%
                      </p>
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition" />
                    </div>
                  )
                })}
              </div>
                </div>
              </div>
            </div>
            {!isLoggedIn && (
              <div className="absolute inset-0 z-20 rounded-3xl border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-4">
                <div className="max-w-md w-full rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-4 text-center">
                  <p className="text-sm font-black text-amber-700 dark:text-amber-300">ヒートマップの詳細表示はログイン/会員登録後に利用できます。</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/login', { state: { from: '/market' } })}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-black"
                    >
                      ログイン
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/signup')}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs font-black hover:bg-amber-100 dark:hover:bg-amber-900/20"
                    >
                      会員登録
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            ※ 表示データは参考情報であり、投資勧誘を目的とするものではありません。データ提供: 中間データ事業者（市場データAPI）
          </p>

          <div className="relative space-y-4">
            <div className={`${!isLoggedIn ? 'blur-[6px] pointer-events-none select-none' : ''}`}>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">日本テーマ</h3>
                  <span className="text-[10px] font-bold text-slate-400">{heatmapDataDate ? `(${heatmapDataDate})` : ''}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2">各タイル: 前営業日終値比（騰落率）</p>
                <div className="flex flex-wrap gap-2">
                  {jpThemeTiles.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-4 text-center text-[11px] font-bold text-slate-400">
                      日本テーマの実データがまだありません
                    </div>
                  ) : (
                    <>
                      {jpThemeTiles.map((item) => (
                        <div
                          key={item.symbol}
                          className={`${heatmapChangeBgClass(Number(item.change || 0))} rounded-xl px-4 py-3 text-white shadow-sm relative overflow-hidden group cursor-default transition hover:scale-[1.02] flex flex-col gap-0.5 min-w-[140px]`}
                        >
                          <p className="text-sm font-bold opacity-95">{item.name}</p>
                          <p className="text-[9px] font-black opacity-90">前営業日終値比</p>
                          <p className="text-base font-black inline-flex items-center gap-0.5">
                            {Number(item.change || 0) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {Number(item.change || 0) >= 0 ? '+' : ''}{Number(item.change || 0).toFixed(1)}%
                          </p>
                          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition" />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">商品（金・銀・銅・原油）</h3>
                  <span className="text-[10px] font-bold text-slate-400">{heatmapDataDate ? `(${heatmapDataDate})` : ''}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                  各タイル: 日次変動率（指数はソース定義、ETFフォールバック時は前営業日終値比）
                </p>
                <div className="flex flex-wrap gap-2">
                  {commodityTiles.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-4 text-center text-[11px] font-bold text-slate-400">
                      商品データを読み込み中...
                    </div>
                  ) : (
                    commodityTiles.map((item) => (
                      <div
                        key={item.symbol}
                        className={`${heatmapChangeBgClass(Number(item.change || 0))} rounded-xl px-4 py-3 text-white shadow-sm relative overflow-hidden group cursor-default transition hover:scale-[1.02] flex flex-col gap-0.5 min-w-[100px]`}
                      >
                        <p className="text-sm font-bold opacity-95">{item.name}</p>
                        <p className="text-[9px] font-black opacity-90 leading-tight">日次変動（定義はデータ源）</p>
                        <p className="text-base font-black inline-flex items-center gap-0.5">
                          {Number(item.change || 0) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {Number(item.change || 0) >= 0 ? '+' : ''}{Number(item.change || 0).toFixed(1)}%
                        </p>
                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            {!isLoggedIn && (
              <div className="absolute inset-0 z-20 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-4">
                <div className="max-w-md w-full rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-4 text-center">
                  <p className="text-sm font-black text-amber-700 dark:text-amber-300">日本テーマ・商品の数値表示はログイン/会員登録後に利用できます（ヒートマップと同様）。</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/login', { state: { from: '/market' } })}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-black"
                    >
                      ログイン
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/signup')}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs font-black hover:bg-amber-100 dark:hover:bg-amber-900/20"
                    >
                      会員登録
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">ニュース・ピックアップ</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {effectivePickupNews.length === 0 ? (
                  <div className="sm:col-span-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm font-bold text-slate-400">
                    ピックアップニュースはまだありません
                  </div>
                ) : effectivePickupNews.map((item, i) => (
                  <button
                    key={`${item.source}-${i}`}
                    type="button"
                    onClick={() => {
                      if (item.url && isJapaneseNewsItem(item)) {
                        window.open(item.url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    disabled={!(item.url && isJapaneseNewsItem(item))}
                    className="text-left rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-orange-300 dark:hover:border-orange-500/50 transition"
                  >
                    <div className="h-20 p-3 text-white relative overflow-hidden">
                      {item.imageUrl ? (
                        <>
                          <img src={item.imageUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-slate-900/55" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800" />
                      )}
                      <div className="relative z-10">
                        <p className="text-[10px] font-black opacity-90">{item.topic}</p>
                        <p className="text-xs font-bold mt-1 line-clamp-2">{item.title}</p>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold">{item.source}</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {manualNewsUpdatedLabelJa ? (
                <p className="mt-3 text-[10px] text-slate-400">
                  ニュースデータ更新: {manualNewsUpdatedLabelJa}
                </p>
              ) : null}
            </div>
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors overflow-hidden">
              <div className="relative -mx-5 -mt-5 px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border-b-2 border-[#FF7900]/75">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 text-white">
                      <Newspaper size={14} />
                    </span>
                    <div>
                      <h3 className="font-black text-white text-sm">市場主要ニュース</h3>
                      <p className="text-[10px] text-slate-300 mt-0.5">大きな電光パネル・数秒ごとに切替（速報／米国／日本 など）</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <MarketMajorNewsTicker slides={marketMajorBoardSlides} />
                <p className="mt-3 text-[10px] text-slate-400 leading-relaxed">
                  管理画面「市場主要ニュース」で
                  <span className="font-bold text-slate-500 dark:text-slate-400"> メジャー企業・イベント </span>
                  と
                  <span className="font-bold text-slate-500 dark:text-slate-400"> 今週の主要結果サマリー </span>
                  に入れた内容は、それぞれ1パネルずつ全画面で切り替わります（未設定時は 速報→米国→日本 の既定3パネル）。
                </p>
              </div>
            </div>
            <AdBanner variant="horizontal" />
          </div>

        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-4">
          <div className="relative">
            <div className={`${!isLoggedIn ? 'blur-[6px] pointer-events-none select-none' : ''}`}>
              <FearGreedIndex />
            </div>
            {!isLoggedIn && (
              <div className="absolute inset-0 z-20 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-3">
                <div className="text-center">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-300">Fear & Greedはログイン後に表示されます</p>
                  <button
                    type="button"
                    onClick={() => navigate('/login', { state: { from: '/market' } })}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-black"
                  >
                    ログイン
                  </button>
                </div>
              </div>
            )}
          </div>
          <AdBanner variant="compact" />

          <div className="relative">
            <div className={`${!isLoggedIn ? 'blur-[6px] pointer-events-none select-none' : ''}`}>
              <div className="w-full bg-white dark:bg-slate-800 px-4 py-3.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Calendar size={16} className="text-orange-500 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800 dark:text-white">2026年 主要カレンダー（4〜8月）</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {upcomingEconomicEvents.length}件 · 日程は変更の場合あり · 下にスクロール
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 shrink-0">
                一覧
              </div>
            </div>
            <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
              <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {upcomingEconomicEvents.map((item) => {
                  const meta = COUNTRY_EVENT_META[item.country] || { flag: '🌐', label: item.country || 'Global', dotClass: 'bg-slate-400' }
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">{meta.flag}</span>
                          <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dotClass}`} />
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 line-clamp-1">
                            {item.event}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{item.dateLabel}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {item.category ? (
                          <span className="text-[10px] font-black px-2 py-0.5 bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full">
                            {item.category}
                          </span>
                        ) : null}
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{meta.label}</span>
                        <span className="text-[10px] text-orange-500 font-black">{'★'.repeat(item.importance)}</span>
                      </div>
                      {item.impact ? (
                        <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-800/70 rounded-lg px-2 py-1.5">
                          {item.impact}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
              </div>
            </div>
            {!isLoggedIn && (
              <div className="absolute inset-0 z-20 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-3">
                <div className="text-center">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-300">今週の経済指標はログイン後に確認できます</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/login', { state: { from: '/market' } })}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-black"
                    >
                      ログイン
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/signup')}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-[11px] font-black hover:bg-amber-100 dark:hover:bg-amber-900/20"
                    >
                      会員登録
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-5 leading-relaxed">
        {LEGAL_NOTICE_TEMPLATES.investment}
      </p>
      <div className="mt-4 lg:hidden">
        <AdBanner variant="horizontal" />
      </div>
    </div>
  )
}
