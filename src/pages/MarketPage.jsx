import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Calendar,
  ArrowRight,
  Zap, Map as MapIcon, ArrowUpRight, ArrowDownRight,
  Newspaper,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import {
  fetchPublishedMacroEventsCalendar,
  mapMacroEventsCalendarRows,
  parseLocalDateFromYmd,
} from '../lib/macroEventsCalendar'
import { resolveFundDisplayName } from '../lib/fundDisplayUtils'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import LazyMarketFearBelowA8Ad from '../components/LazyMarketFearBelowA8Ad'
import AdSidebar from '../components/AdSidebar'
import { ETF_LIST_FROM_XLSX, ETF_SYMBOLS_FROM_XLSX } from '../data/etfListFromXlsx'
import { fetchNewsManualData, getFallbackNewsData, formatManualNewsUpdatedAtJa, isValidManualNewsTimestamp, manualNewsRowRecencyMs } from '../lib/newsManualClient'
import { buildMarketMajorRegionSlides, toMajorNewsCard } from '../lib/marketMajorNewsBoard'
import FearGreedIndex from '../components/market/FearGreedIndex'
import MarketMajorNewsTicker from '../components/market/MarketMajorNewsTicker'
import MembersBlurGate from '../components/auth/MembersBlurGate'
import { heatmapChangeBgClass, signedReturnTextClassStrong } from '../lib/marketDirectionColors'
import { latestUsableCommodityRows } from '../lib/commodityDataGuard'

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

const ETF_META_MAP = new Map(
  ETF_LIST_FROM_XLSX.map((item) => [String(item.symbol || '').trim().toUpperCase(), item]),
)
const isJapaneseNewsItem = (item) => String(item?.language || '').toLowerCase() === 'ja'
const FALLBACK_WEEKLY_ECONOMIC_EVENTS = [
  { id: 'fallback-us-cpi', dateLabel: '3/10 (火)', country: 'US', event: '米国 消費者物価指数（CPI）', importance: 5 },
  { id: 'fallback-fomc', dateLabel: '3/17-18 (火-水)', country: 'US', event: 'FOMC 金利発表・経済予測・ドットチャート', importance: 5 },
]
/** 2026年の主要マクロ・決算・テックイベント要約（参考。公式日程で要確認） */
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
    event: 'FRB FOMC（経済予測・ドットチャート＝下半期の利下げ回数が焦点）',
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
/** DB未設定時：市場主要ニュース電光パネル（グローバル／米国／日本の3枚） */
const CURATED_MARKET_MAJOR_BOARD_SLIDES = [
  {
    id: 'region-global',
    headline: 'グローバル',
    lines: [
      '💎 TSMC（TSM）— 4/16（木）発表済み。AI半導体需要の「爆発的な継続」を裏付ける好決算。設備投資（CAPEX）計画も堅調で、日本の半導体製造装置メーカーへの安心感を後押し［TSMC IR］。',
    ],
  },
  {
    id: 'region-us',
    headline: '米国',
    lines: [
      '🚗 Tesla（TSLA）— 2026年度1Q本決算：4/21（火）17:30頃（ET）予定［Tesla IR］。納車台数の鈍化を受け実質営業利益率の維持度が焦点。低価格モデル（モデル2）の進捗とFSD収益化ロードマップに注目。',
      '📱 Meta（META）— 2026年度1Q決算：4/22（水）予定［Meta IR］。AI活用による広告配信の効率化が収益に寄与したか。Llama 4への投資規模とメタバース部門の損失管理が材料。',
      '🔍 Alphabet（GOOGL）— 2026年度1Q決算：4/23（木）予定［Alphabet IR］。検索へのAI統合下での広告単価とGCP成長。AI軍拡競争の中でのコスト構造の見直しが株価の方向感を左右しそうです。',
    ],
  },
  {
    id: 'region-jp',
    headline: '日本',
    lines: [
      '⚙️ 日本電産（6594）— 2026年3月期通期本決算：4/23（木）15:00予定［Nidec IR］。生成AIサーバー向け水冷ユニットの需要が、EV向けモーター部門の苦戦をどこまで補うかが日本株センチメントの先行指標に。',
      '🏛 日本銀行（BoJ）— 金融政策決定会合および展望レポート：4/23（木）〜24（金）［日銀公式］。新年度の賃上げ浸透を踏まえた追加利上げタイミングの示唆、円安進行に対する植田総裁の牽制発言が為替に波及する可能性。',
    ],
  },
]

const JP_THEME_TILES = [
  { symbol: '1478.T', name: '日本高配当株式' },
  { symbol: '2854.T', name: 'トップ20テック株式' },
]
// 原材料: MarketStack /commodities（Professional+）を優先、なければ ETF プロキシ
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
    keywords: ['ai', '人工知能', '生成AI', 'nvidia', 'エヌビディア', 'microsoft', 'マイクロソフト', 'openai'],
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
    keywords: ['半導体', 'semiconductor', 'chip', 'tsmc', 'asml', '東京エレクトロン', 'アドバンテスト', 'キオクシア', 'kioxia'],
    fundKeywords: ['半導体', 'NASDAQ', 'FANG', 'テック'],
    sectorHints: ['情報技術'],
    tileHints: ['トップ20テック株式'],
    stockCandidates: [
      { symbol: '8035.T', patterns: ['東京エレクトロン', 'tokyo electron'] },
      { symbol: '6857.T', patterns: ['アドバンテスト', 'advantest'] },
      { symbol: '285A.T', patterns: ['キオクシア', 'kioxia'] },
      { symbol: '6976.T', patterns: ['太陽誘電', 'taiyo yuden'] },
      { symbol: '4062.T', patterns: ['イビデン', 'ibiden'] },
      { symbol: '6963.T', patterns: ['ローム', 'rohm'] },
      { symbol: '5706.T', patterns: ['三井金属', 'mitsui kinzoku', 'mitsui mining'] },
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
  CN: { label: '中国', flag: '🇨🇳', dotClass: 'bg-red-600' },
  IN: { label: 'インド', flag: '🇮🇳', dotClass: 'bg-orange-500' },
  EM: { label: '新興国', flag: '🌍', dotClass: 'bg-emerald-600' },
}
const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土']
/** DB・手動ニュースの反映を遅らせないよう定期再取得（タブ復帰時も即時リフェッチ） */
const MARKET_DATA_POLL_MS = 60 * 1000
const MANUAL_NEWS_POLL_MS = 60 * 1000

/** Supabase `macro_events_calendar` または従来どおり id 接頭辞から、終了日≧今日のイベントのみ返す */
const filterUpcomingEconomicEvents = (events) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return events.filter((item) => {
    const endYmd = item.eventDateEnd || item.event_date_end
    const startYmd = item.eventDateStart || item.event_date_start
    const rangeEnd = String(endYmd || startYmd || '').slice(0, 10)
    if (rangeEnd) {
      const endDt = parseLocalDateFromYmd(rangeEnd)
      if (endDt) return endDt >= today
    }
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
  const location = useLocation()
  const [topFunds, setTopFunds] = useState([])
  const [inflowFunds, setInflowFunds] = useState([])
  const [liveFundSignals, setLiveFundSignals] = useState([])
  const [heatmapData, setHeatmapData] = useState([])
  const [heatmapDataDate, setHeatmapDataDate] = useState(null)
  const [regionPerformanceRows, setRegionPerformanceRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [marketDataStatus, setMarketDataStatus] = useState('')
  const [newsState, setNewsState] = useState(() => getFallbackNewsData())
  const [weeklyEconomicEvents, setWeeklyEconomicEvents] = useState(CURATED_ECONOMIC_EVENTS)
  /** macro_events_calendar の読込状態（既定リストとの見分け・デバッグ用） */
  const [macroCalendarNote, setMacroCalendarNote] = useState(null)
  const upcomingEconomicEvents = useMemo(() => filterUpcomingEconomicEvents(weeklyEconomicEvents), [weeklyEconomicEvents])
  const [jpThemeTiles, setJpThemeTiles] = useState([])
  const [commodityTiles, setCommodityTiles] = useState([])
  const [selectedThemeId, setSelectedThemeId] = useState(MARKET_THEME_DEFINITIONS[0].id)
  const [etfRankStatus, setEtfRankStatus] = useState('loading')

  const isLoggedIn = Boolean(session?.user)

  useEffect(() => {
    const prev = document.title
    document.title = 'マーケット | MoneyMart'
    return () => { document.title = prev }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await fetchPublishedMacroEventsCalendar()
        if (cancelled) return
        const mapped = mapMacroEventsCalendarRows(rows)
        if (rows.length > 0) {
          setWeeklyEconomicEvents(mapped)
          setMacroCalendarNote('データベースから反映しています')
          return
        }
        setMacroCalendarNote(null)
      } catch (e) {
        if (!cancelled) {
          const msg = String(e?.message || e || '')
          setMacroCalendarNote(
            import.meta.env.DEV
              ? `データベース読込エラー（既定リスト）: ${msg}`
              : 'データベースに接続できませんでした（既定リストを表示）。SupabaseのRLS・テーブル公開を確認してください。',
          )
          if (import.meta.env.DEV) console.warn('[macro_events_calendar]', e)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const etfTop5Sections = useMemo(() => [
    { id: 'return', title: '週間騰落率 Top 5', list: topFunds, metric: (f) => `${Number(f.dayChange ?? f.return1y ?? 0) >= 0 ? '+' : ''}${(f.dayChange ?? f.return1y ?? 0).toFixed(1)}%`, metricClass: (f) => signedReturnTextClassStrong(Number(f.dayChange ?? f.return1y ?? 0)) },
    { id: 'volume', title: '出来高 Top5', list: inflowFunds, metric: (f) => `${Math.round(Number(f.inflow || 0)).toLocaleString('ja-JP')}万`, metricClass: () => 'text-slate-500 dark:text-slate-400' },
  ], [topFunds, inflowFunds])

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
    if (majorCardsFromDb.length === 0 && weeklyCardsFromDb.length === 0) {
      return CURATED_MARKET_MAJOR_BOARD_SLIDES
    }
    return buildMarketMajorRegionSlides(majorCardsFromDb, weeklyCardsFromDb)
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
    const intervalId = window.setInterval(loadNews, MANUAL_NEWS_POLL_MS)
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || cancelled) return
      loadNews()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  // Keep a curated macro calendar list for mock/demo consistency.
  useEffect(() => {
    let rankingFetchCancelled = false
    let fetchSeq = 0
    const fetchData = async ({ silent = false } = {}) => {
      const seq = ++fetchSeq
      const historyFromDate = toIsoDateDaysAgo(10)
      const etfLatestBatches = []
      const etfRecentBatches = []
      for (let i = 0; i < ETF_SYMBOLS_FROM_XLSX.length; i += 80) {
        etfLatestBatches.push(ETF_SYMBOLS_FROM_XLSX.slice(i, i + 80))
        etfRecentBatches.push(ETF_SYMBOLS_FROM_XLSX.slice(i, i + 80))
      }
      const buildPreviousCloseMap = (latestRows, historyRows) => {
        const bySymbol = new Map()
        for (const row of historyRows || []) {
          const symbol = String(row?.symbol || '').toUpperCase()
          if (!symbol) continue
          if (!bySymbol.has(symbol)) bySymbol.set(symbol, [])
          bySymbol.get(symbol).push(row)
        }
        for (const arr of bySymbol.values()) {
          arr.sort((a, b) => String(b?.trade_date || '').localeCompare(String(a?.trade_date || '')))
        }
        const prevMap = new Map()
        for (const latest of latestRows || []) {
          const symbol = String(latest?.symbol || '').toUpperCase()
          const latestTradeDate = String(latest?.trade_date || '')
          const rows = bySymbol.get(symbol) || []
          const prev = rows.find((row) => String(row?.trade_date || '') < latestTradeDate)
          const prevClose = Number(prev?.close)
          if (Number.isFinite(prevClose) && prevClose > 0) prevMap.set(symbol, prevClose)
        }
        return prevMap
      }
      try {
        if (!silent) setIsLoading(true)
        setMarketDataStatus('')

        const customHeatmapSymbols = [
          ...new Set([
            ...REGION_TICKER_LIST.map((row) => row.symbol),
            ...US_SECTOR_TICKER_LIST.map((row) => row.symbol),
            ...JP_THEME_TILES.map((row) => row.symbol),
            ...COMMODITY_ETF_FALLBACK.map((t) => t.symbol),
          ]),
        ]

        // 1) First paint fast: heatmap + region + commodity first.
        const [customLatestRes, customRecentRes, commodityRes] = await Promise.all([
          supabase.from('v_stock_latest').select('symbol,trade_date,close,volume').in('symbol', customHeatmapSymbols),
          supabase.from('stock_daily_prices').select('symbol,trade_date,close')
            .in('symbol', customHeatmapSymbols)
            .gte('trade_date', historyFromDate)
            .order('trade_date', { ascending: false }),
          supabase.from('commodity_daily_prices').select('commodity_name,trade_date,percentage_day,raw')
            .in('commodity_name', COMMODITY_NAMES)
            .order('trade_date', { ascending: false }),
        ])

        if (customLatestRes.error) throw customLatestRes.error
        if (customRecentRes.error) throw customRecentRes.error
        const customLatestRows = customLatestRes.data || []
        const customRecentRows = customRecentRes.data || []

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
              return { symbol: tile.symbol, name: tile.name, change, tradeDate: live?.trade_date || null }
            })
            .filter(Boolean)
        // 原材料: commodity_daily_prices（MarketStack /commodities）を優先、なければ ETF
        let commodityTilesData = []
        const commodityRows = commodityRes.data || []
        const commodityErr = commodityRes.error
        if (!commodityErr && commodityRows && commodityRows.length > 0) {
            const byName = latestUsableCommodityRows(commodityRows)
            commodityTilesData = COMMODITY_NAMES
              .map((name) => {
                const row = byName.get(name)
                const pct = Number(row?.percentage_day)
                if (!row || row.percentage_day == null || !Number.isFinite(pct)) return null
                return { symbol: name, name: COMMODITY_NAME_JA[name] || name, change: Number(pct.toFixed(1)), tradeDate: row.trade_date }
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

        if (!silent && seq === fetchSeq) setIsLoading(false)
      } catch (err) {
        console.error('Heatmap fetch error:', err)
        if (rankingFetchCancelled || seq !== fetchSeq) return
        setHeatmapData([])
        setHeatmapDataDate(null)
        setRegionPerformanceRows([])
        setMarketDataStatus('ヒートマップ用データの取得に失敗しました。')
      } finally {
        if (!silent && seq === fetchSeq) setIsLoading(false)
      }

      if (rankingFetchCancelled || seq !== fetchSeq) return

      try {
        if (!silent) setEtfRankStatus('loading')
        let processedBase = null
        let processed = []
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
            const name = resolveFundDisplayName(symbol, {}, meta, null)
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
            name: row.name,
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
        setEtfRankStatus(processed.length ? 'ready' : 'empty')
      } catch (err) {
        console.error('ETF ranking fetch error:', err)
        if (rankingFetchCancelled || seq !== fetchSeq) return
        if (!silent) {
          setTopFunds([])
          setInflowFunds([])
          setLiveFundSignals([])
        }
        setEtfRankStatus('error')
      }
    }
    fetchData({ silent: false })
    const intervalId = window.setInterval(() => {
      if (rankingFetchCancelled) return
      fetchData({ silent: true })
    }, MARKET_DATA_POLL_MS)
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || rankingFetchCancelled) return
      fetchData({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      rankingFetchCancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const marketBriefSummary = useMemo(() => {
    const jp = regionPerformanceRows.find((row) => row.country === 'JP')
    const us = regionPerformanceRows.find((row) => row.country === 'US')
    const etfAvg = topFunds.length > 0
      ? topFunds.reduce((acc, cur) => acc + Number((cur.dayChange ?? cur.return1y) || 0), 0) / topFunds.length
      : null
    const jpRet = jp ? Number(jp.retDayOverDay) : null
    const usRet = us ? Number(us.retDayOverDay) : null

    const candidates = []
    const brief = newsState?.dailyBrief
    const briefHeadline = String(brief?.headline || '').trim()
    if (briefHeadline) {
      candidates.push({
        text: briefHeadline,
        ms: manualNewsRowRecencyMs(brief?.publishedAt, brief?.updatedAt),
      })
    }
    for (const item of effectiveTickerNews) {
      const t = String(item?.title || '').trim()
      if (!t) continue
      candidates.push({
        text: t,
        ms: manualNewsRowRecencyMs(item?.publishedAt, item?.updatedAt),
      })
    }
    candidates.sort((a, b) => (b.ms - a.ms))
    const topHeadline = candidates[0]?.text ? String(candidates[0].text).trim() : ''

    return {
      jpRet,
      usRet,
      etfAvg,
      news: topHeadline || '主要ニュースは未取得',
    }
  }, [effectiveTickerNews, newsState?.dailyBrief, regionPerformanceRows, topFunds])

  const signedPctText = (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return '—'
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
  }
  const pctToneClass = (v) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n === 0) return 'text-slate-600 dark:text-slate-300'
    return n > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
  }

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
    <div className="max-w-[1400px] mx-auto px-4 py-6 animate-fadeIn pb-8 min-h-0 bg-gray-50 dark:bg-slate-900 font-sans transition-colors duration-300">
      <MembersBlurGate
        isLoggedIn={isLoggedIn}
        returnPath={`${location.pathname}${location.search || ''}`}
        label="ログイン後にマーケット画面をご覧いただけます"
        hint="無料登録でヒートマップ・センチメント・主要ニュースをご覧いただけます。"
        overlayRoundedClass="rounded-2xl"
      >
        <div className={!isLoggedIn ? 'max-h-[min(68vh,600px)] overflow-hidden' : undefined}>
      {/* 1. Scrolling News Ticker */}
        <div className="bg-slate-900 dark:bg-black text-white rounded-2xl shadow-md mb-6 border border-slate-700 overflow-hidden">
          <div className="py-3 overflow-hidden whitespace-nowrap">
            {effectiveTickerNews.length > 0 ? (
              <div className="inline-flex animate-ticker-market items-center gap-10 pl-4 pr-16 min-w-max">
                {[...effectiveTickerNews, ...effectiveTickerNews, ...effectiveTickerNews].map((item, i) => (
                  <span
                    key={`ticker-${String(item.publishedAt || item.updatedAt || '')}-${i}-${String(item.title || '').slice(0, 24)}`}
                    className="flex items-center gap-3 text-xs md:text-sm shrink-0"
                  >
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-4">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">今日のマーケット要約</h3>
                <button
                  type="button"
                  onClick={() => navigate('/funds')}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black transition"
                >
                  ファンド比較
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['日本', marketBriefSummary.jpRet],
                  ['米国', marketBriefSummary.usRet],
                  ['ETF', marketBriefSummary.etfAvg],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-900/50 px-2 py-2 text-center">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</p>
                    <p className={`mt-0.5 text-sm font-black tabular-nums ${pctToneClass(value)}`}>{signedPctText(value)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-snug line-clamp-3">
                {marketBriefSummary.news}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 md:col-span-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">ETF</h3>
              {etfRankStatus === 'error' ? (
                <p className="text-[11px] font-bold text-slate-400 py-2">ランキングを取得できませんでした。</p>
              ) : etfRankStatus === 'loading' && topFunds.length === 0 && inflowFunds.length === 0 ? (
                <p className="text-[11px] font-bold text-slate-400 py-2">読み込み中</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {etfTop5Sections.map((section) => (
                    <div key={section.id}>
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1">{section.title}</p>
                      {section.list.length === 0 ? (
                        <p className="text-[11px] text-slate-400 py-1">データなし</p>
                      ) : section.list.map((fund) => (
                        <button
                          key={`${section.id}-${fund.id}`}
                          type="button"
                          onClick={() => navigate(`/funds/${fund.id}`)}
                          className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition"
                        >
                          <span className="min-w-0 flex-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{fund.name}</span>
                          <span className={`text-[11px] font-black shrink-0 tabular-nums ${section.metricClass?.(fund) ?? 'text-slate-500'}`}>
                            {section.metric?.(fund) ?? ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 md:col-span-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">今週の注目テーマ</h3>
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
          <div id="heatmap" className="scroll-mt-28">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">市場ボード</p>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">前営業日終値比。右の投資家心理指数とあわせて見ます。</p>
          </div>
          <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {(isLoading || heatmapData.length > 0) && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapIcon className="text-blue-600 dark:text-blue-400" size={18} /> セクターヒートマップ
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    前営業日終値比の騰落率（各タイルに表示）。サイズは時価総額の近似値。
                    {heatmapDataDate && (
                      <span className="ml-1.5 font-semibold text-slate-600 dark:text-slate-300">基準日: {heatmapDataDate}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {isLoading ? (
                  <div className="col-span-3 flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-6 text-xs font-bold text-slate-400 dark:border-slate-700">
                    ヒートマップを読み込み中...
                  </div>
                ) : heatmapData.length === 0 ? (
                  <div className="col-span-3 flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-6 text-xs font-bold text-slate-400 dark:border-slate-700">
                    ヒートマップ用の実データがまだありません
                  </div>
                ) : heatmapData.map((item, idx) => {
                  const bgClass = heatmapChangeBgClass(Number(item.change || 0))
                  return (
                    <div
                      key={idx}
                      className={`col-span-1 ${bgClass} rounded-xl p-3 sm:p-4 flex flex-col items-center justify-between text-white text-center transition hover:scale-[1.02] cursor-default shadow-sm relative overflow-hidden group gap-1.5 min-h-[7.25rem] sm:min-h-[7.5rem]`}
                    >
                      <div className="absolute inset-0 z-0 bg-white opacity-0 group-hover:opacity-10 transition pointer-events-none" aria-hidden />
                      <span className="relative z-10 font-bold text-[11.5px] md:text-[12.5px] leading-snug line-clamp-2 break-words [overflow-wrap:anywhere] w-full">
                        {item.name}
                      </span>
                      <span className="relative z-10 shrink-0 text-[9px] font-black opacity-90 tracking-tight leading-none">前営業日終値比</span>
                      <span className="relative z-10 shrink-0 font-black text-lg md:text-xl inline-flex items-center gap-0.5 leading-none">
                        {item.change > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        {Math.abs(Number(item.change || 0)).toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
                )}

            {(isLoading || regionPerformanceRows.length > 0) && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapIcon className="text-blue-600 dark:text-blue-400" size={18} /> 地域別ヒートマップ
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    前営業日終値比の騰落率（ETF実データ・各タイルに表示）。
                    {heatmapDataDate && (
                      <span className="ml-1.5 font-semibold text-slate-600 dark:text-slate-300">基準日: {heatmapDataDate}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {isLoading ? (
                  <div className="col-span-3 flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-6 text-xs font-bold text-slate-400 dark:border-slate-700">
                    地域別データを読み込み中...
                  </div>
                ) : regionPerformanceRows.length === 0 ? (
                  <div className="col-span-3 flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-6 text-xs font-bold text-slate-400 dark:border-slate-700">
                    地域別の実データがまだありません
                  </div>
                ) : regionPerformanceRows.map((row) => {
                  const bgClass = heatmapChangeBgClass(Number(row.retDayOverDay || 0))
                  return (
                    <div
                      key={row.id || `${row.country}-${row.name}`}
                      className={`col-span-1 ${bgClass} rounded-xl p-3 text-white shadow-sm relative overflow-hidden group cursor-default transition hover:scale-[1.02] flex flex-col items-center justify-between gap-1.5 text-center min-h-[7.25rem] sm:min-h-[7.5rem]`}
                    >
                      <div className="absolute inset-0 z-0 bg-white opacity-0 group-hover:opacity-10 transition pointer-events-none" aria-hidden />
                      <p className="relative z-10 w-full text-[11.5px] md:text-[12.5px] font-bold opacity-90 leading-snug line-clamp-2 break-words [overflow-wrap:anywhere]">
                        {row.name}
                      </p>
                      <p className="relative z-10 shrink-0 text-[9px] font-black opacity-90 tracking-tight leading-none">前営業日終値比</p>
                      <p className="relative z-10 shrink-0 text-xl font-black inline-flex items-center gap-1 leading-none">
                        {row.retDayOverDay >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {row.retDayOverDay >= 0 ? '+' : ''}{row.retDayOverDay.toFixed(1)}%
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
            )}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">日本テーマ</h3>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums shrink-0">{heatmapDataDate ? `基準日: ${heatmapDataDate}` : ''}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2">各タイル: 前営業日終値比</p>
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
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">原材料（金・銀・銅・原油）</h3>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums shrink-0">取引日は各タイルに表示</span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                  各タイル: 日次変動率（指数はデータ提供元の定義、ETF参照データ使用時は前営業日終値比）
                </p>
                <div className="flex flex-wrap gap-2">
                  {commodityTiles.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-4 text-center text-[11px] font-bold text-slate-400">
                      原材料データを読み込み中...
                    </div>
                  ) : (
                    commodityTiles.map((item) => (
                      <div
                        key={item.symbol}
                        className={`${heatmapChangeBgClass(Number(item.change || 0))} rounded-xl px-4 py-3 text-white shadow-sm relative overflow-hidden group cursor-default transition hover:scale-[1.02] flex flex-col gap-0.5 min-w-[100px]`}
                      >
                        <p className="text-sm font-bold opacity-95">{item.name}</p>
                        <p className="text-base font-black inline-flex items-center gap-0.5">
                          {Number(item.change || 0) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {Number(item.change || 0) >= 0 ? '+' : ''}{Number(item.change || 0).toFixed(1)}%
                        </p>
                        <p className="text-[10px] font-bold opacity-90 tabular-nums">{item.tradeDate ? `取引日 ${item.tradeDate}` : '取引日未確認'}</p>
                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition" />
                      </div>
                    ))
                  )}
                </div>
              </div>
              </div>
            </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            ※ 表示データは参考情報であり、投資勧誘を目的とするものではありません。データ提供: 外部データプロバイダー（市場データAPI）
          </p>

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

          <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors overflow-hidden">
            <div className="relative -mx-4 -mt-4 px-4 py-2.5 md:-mx-5 md:-mt-5 md:px-5 md:py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border-b border-[#FF7900]/60">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/10 text-white">
                  <Newspaper size={12} />
                </span>
                <div>
                  <h3 className="font-black text-white text-xs md:text-sm">市場主要ニュース</h3>
                  <p className="text-[9px] md:text-[10px] text-slate-300 mt-0.5 leading-snug">数秒ごとに切り替わります（グローバル／米国／日本）</p>
                </div>
              </div>
            </div>
            <div className="pt-3 md:pt-4">
              <MarketMajorNewsTicker slides={marketMajorBoardSlides} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <FearGreedIndex />
          <LazyMarketFearBelowA8Ad />

          {macroCalendarNote ? (
            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 px-1 leading-snug">
              {macroCalendarNote}
            </p>
          ) : null}
          <div className="w-full bg-white dark:bg-slate-800 px-4 py-3.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-left">
            <div className="flex items-center gap-2.5">
              <Calendar size={16} className="text-orange-500 shrink-0" />
              <div>
                <p className="text-xs font-black text-slate-800 dark:text-white">2026年 主要カレンダー</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {upcomingEconomicEvents.length}件 · スクロールで続き
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
              <div className="h-[280px] overflow-y-auto overscroll-contain pr-1 space-y-2">
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
                        <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-800/70 rounded-lg px-2 py-1.5 line-clamp-2">
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

      </div>
        </div>
      </MembersBlurGate>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-5 leading-relaxed">
        {LEGAL_NOTICE_TEMPLATES.investment}
      </p>
    </div>
  )
}
