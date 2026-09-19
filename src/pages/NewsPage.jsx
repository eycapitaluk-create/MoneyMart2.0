import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ExternalLink, Flame, RefreshCw, Newspaper } from 'lucide-react'
import { fetchAiNewsData, fetchNewsPageManual } from '../lib/aiNewsClient'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import {
  MATSUI_FX_A8,
  MATSUI_FX_AFFILIATE_DISCLOSURE,
  MATSUI_FX_HEADLINE,
} from '../data/affiliateMatsuiFx.js'
import MembersBlurGate from '../components/auth/MembersBlurGate'
import { PortfolioNewsRelevanceCard, ExposureLevelBadge } from '../components/news/PortfolioNewsRelevance'
import { usePortfolioExposureProfile } from '../hooks/usePortfolioExposureProfile'
import { scoreNewsExposure } from '../lib/portfolioExposureMap'
import { supabase } from '../lib/supabase'

const MM_ORANGE = '#D4722A'
const MM_BG = '#F0EDE8'
const MM_WHITE = '#FAFAF8'
const MM_INK = '#111110'
/** 強気・上昇トーン（日本株表示慣習：赤） */
const MM_BULL = '#B91C1C'
/** 弱気・下落トーン（日本株表示慣習：青） */
const MM_BEAR = '#1D4ED8'

/** 好材料/悪材料・英語・旧ラベル混在でも同じバケットに寄せる */
const sentimentBucket = (raw) => {
  if (raw == null || raw === '') return 'neutral'
  const t = String(raw).trim()
  const u = t.toUpperCase()
  if (
    t === '好材料'
    || t === '強気'
    || u === 'POSITIVE'
    || t === 'ポジティブ'
    || u === 'BULLISH'
  ) return 'bullish'
  if (
    t === '悪材料'
    || t === '弱気'
    || u === 'NEGATIVE'
    || t === 'ネガティブ'
    || u === 'BEARISH'
  ) return 'bearish'
  return 'neutral'
}

/** ライト / ダーク：強気・弱気は pill 背景に近いトーン（一段だけ濃く） */
const cardSurfaceBySentiment = (sentiment, isDark = false) => {
  const b = sentimentBucket(sentiment)
  if (isDark) {
    if (b === 'bullish') return 'rgba(185, 28, 28, 0.32)'
    if (b === 'bearish') return 'rgba(29, 78, 216, 0.28)'
    return '#1e293b'
  }
  if (b === 'bullish') return '#FEE2E2'
  if (b === 'bearish') return '#DBEAFE'
  return '#FAFAF8'
}

/** ダークカード：左アクセントのみ（全面着色は避ける） */
const darkCardLeftAccent = (sentiment) => {
  const b = sentimentBucket(sentiment)
  if (b === 'bullish') return `4px solid ${MM_BULL}`
  if (b === 'bearish') return `4px solid ${MM_BEAR}`
  return '4px solid rgba(212, 114, 42, 0.45)'
}

const JP_FLAG_RE = /\uD83C\uDDEF\uD83C\uDDF5/g
const displayNewsFlag = (flag) => {
  if (flag == null || String(flag).trim() === '') return '🌐'
  const s = String(flag).replace(JP_FLAG_RE, '').replace(/\s+/g, ' ').trim()
  if (s === '') return null
  return s
}

const marketRegionLabel = (m) => {
  if (m === 'jp') return '🇯🇵 日本株'
  if (m === 'eu') return '🇪🇺 欧州株'
  return '🇺🇸 米国株'
}

const exchangeHint = (item) => {
  const t = String(item.ticker || '')
  if (item.market === 'jp' || /\.T$/i.test(t)) return '東証プライム'
  if (item.market === 'eu') return '欧州'
  return 'NASDAQ'
}

/** 株式ページの銘柄マスタ（例: 7203.T）と一致するようクエリを正規化 */
const stockPageSymbolQuery = (item) => {
  const raw = String(item?.ticker || '').trim()
  if (!raw) return ''
  const u = raw.toUpperCase()
  if (/\.[A-Z]{1,3}$/i.test(raw)) return u
  if (item.market === 'jp' && /^\d{4,5}$/.test(u)) return `${u}.T`
  return u
}

const sourceRank = (src) => {
  const s = String(src || '').toLowerCase()
  if (s === 'marketstack') return 0
  if (s === 'yfinance') return 1
  return 2
}

/** 直近2営業日の終値比（%）。データが無ければ null（偽の等落率は出さない） */
const dayChangePctFromPriceRows = (rows) => {
  const byDate = new Map()
  for (const row of rows || []) {
    const date = String(row?.trade_date || '').slice(0, 10)
    const close = Number(row?.close)
    if (!date || !Number.isFinite(close) || close <= 0) continue
    const prev = byDate.get(date)
    if (!prev || sourceRank(row.source) < sourceRank(prev.source)) {
      byDate.set(date, { close, source: row.source, trade_date: date })
    }
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))
  if (dates.length < 2) return null
  const latest = byDate.get(dates[0]).close
  const prevClose = byDate.get(dates[1]).close
  if (!(prevClose > 0)) return null
  return ((latest - prevClose) / prevClose) * 100
}

const tickerChgDisplay = (pct) => {
  if (!Number.isFinite(pct)) return null
  const text = `${pct >= 0 ? '▲ +' : '▼ −'}${Math.abs(pct).toFixed(1)}%`
  if (pct > 0) return { cls: 'font-black', text, style: { color: '#fecaca' } }
  if (pct < 0) return { cls: 'font-black', text, style: { color: '#bfdbfe' } }
  return { cls: 'text-white/80 font-black', text: '→ 0.0%' }
}

const FILTER_DEFS = [
  { id: 'all', label: 'すべて' },
  { id: 'hot', label: '🔥 注目' },
  { id: 'bull', label: '📈 強気' },
  { id: 'bear', label: '📉 弱気' },
  { id: 'us', label: '🇺🇸 米国' },
  { id: 'jp', label: '🇯🇵 日本' },
  { id: 'eu', label: '🇪🇺 欧州' },
  { id: 'semi', label: '半導体' },
  { id: 'tech', label: 'テック' },
  { id: 'auto', label: '自動車' },
  { id: 'health', label: 'ヘルスケア' },
]

const matchesSectorKeyword = (item, tabId) => {
  const s = String(item.sector || '')
  if (tabId === 'semi') return /半導体|半導|チップ|EUV|ファウンドリ/i.test(s)
  if (tabId === 'tech') return /テック|IT|情報|通信|ソフト|インターネット|クラウド/i.test(s)
  if (tabId === 'auto') return /自動車|車両|タイヤ|モビリティ/i.test(s)
  if (tabId === 'health') return /ヘルス|医薬|製薬|バイオ|医療|創薬/i.test(s)
  return true
}

const filterNews = (rows, filterId) => {
  const list = Array.isArray(rows) ? rows : []
  if (filterId === 'all') return list
  if (filterId === 'hot') return list.filter((n) => n.isHot)
  if (filterId === 'bull') return list.filter((n) => sentimentBucket(n.sentiment) === 'bullish')
  if (filterId === 'bear') return list.filter((n) => sentimentBucket(n.sentiment) === 'bearish')
  if (filterId === 'us') return list.filter((n) => n.market === 'us')
  if (filterId === 'jp') return list.filter((n) => n.market === 'jp')
  if (filterId === 'eu') return list.filter((n) => n.market === 'eu')
  if (['semi', 'tech', 'auto', 'health'].includes(filterId)) {
    return list.filter((n) => matchesSectorKeyword(n, filterId))
  }
  return list
}

const SentimentPill = ({ sentiment, hot, isDark = false }) => {
  const b = sentimentBucket(sentiment)
  if (hot) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
        style={{ background: MM_ORANGE }}
      >
        🔥 HOT
      </span>
    )
  }
  if (b === 'bullish') {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
        style={isDark ? { background: 'rgba(248, 113, 113, 0.22)', color: '#fca5a5' } : { background: '#FEE2E2', color: MM_BULL }}
      >
        📈 強気
      </span>
    )
  }
  if (b === 'bearish') {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
        style={isDark ? { background: 'rgba(59, 130, 246, 0.22)', color: '#93c5fd' } : { background: '#EFF6FF', color: MM_BEAR }}
      >
        📉 弱気
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
      style={isDark ? { background: '#334155', color: '#94a3b8' } : { background: '#F0EDE8', color: '#8A8680' }}
    >
      ➡️ 中立
    </span>
  )
}

const summaryBody = (item) => {
  const isSummarized = item.summary
    && !item.reason?.includes('短縮表示')
    && item.summary.length < 250
    && !/^http/.test(item.summary)
  if (isSummarized) return item.summary
  return item.reason || item.summary || '要約を生成中です...'
}

/** 元記事リンク用（scheme なし URL を補完） */
const resolvedSourceHref = (item) => {
  const raw = String(item?.sourceUrl || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  return `https://${raw.replace(/^\/+/, '')}`
}

/** AI クリップ（公開情報ベースのトレンド解説）— 元記事リンクは出さない */
const isAiTrendSummarySource = (source) => String(source || '').includes('AIトレンド要約')

/** 元記事（外部）・株式詳細（内部） */
function NewsArticleLinks({ item, variant = 'light', compact = false }) {
  const href = resolvedSourceHref(item)
  const ticker = String(item?.ticker || '').trim()
  const showArticle = Boolean(href) && !isAiTrendSummarySource(item?.source)
  const showStock = Boolean(ticker)
  if (!showArticle && !showStock) return null

  const textSm = compact ? 'text-[9px]' : 'text-[10px]'
  const iconSz = compact ? 10 : 11
  const dark = variant === 'dark'
  const articleCls = `${textSm} font-black uppercase tracking-wider inline-flex items-center gap-1 no-underline hover:underline ${
    dark ? 'text-white/90' : ''
  }`
  const articleStyle = dark ? undefined : { color: MM_ORANGE }
  const stockCls = `${textSm} font-black uppercase tracking-wider inline-flex items-center gap-1 no-underline hover:underline ${
    dark ? 'text-white' : ''
  }`
  const stockStyle = dark ? undefined : { color: MM_ORANGE }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
      {showArticle ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={articleCls} style={articleStyle}>
          元記事 <ExternalLink size={iconSz} aria-hidden />
        </a>
      ) : null}
      {showStock ? (
        <Link to={`/stocks?symbol=${encodeURIComponent(stockPageSymbolQuery(item))}`} className={stockCls} style={stockStyle}>
          株式詳細 →
        </Link>
      ) : null}
    </div>
  )
}

const ManualPickCard = ({ item, isDark = false }) => {
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = Boolean(item.imageUrl) && !imgFailed
  const onImgError = useCallback(() => setImgFailed(true), [])
  const title = item.headline || item.companyName || 'ピックアップ'
  const border = isDark ? '#475569' : '#DEDAD4'
  const imgBg = isDark ? '#0f172a' : '#F0EDE8'
  const summaryCls = isDark ? 'text-slate-300' : 'text-[#444240]'
  const metaCls = isDark ? 'text-slate-400' : 'text-[#8A8680]'
  const titleColor = isDark ? '#f8fafc' : MM_INK
  const cardBg = isDark ? '#1e293b' : '#FAFAF8'

  return (
    <article
      className="overflow-hidden rounded-sm border shadow-sm"
      style={{ borderColor: border, background: cardBg }}
    >
      <div className="h-1 shrink-0" style={{ background: MM_ORANGE }} aria-hidden />
      <div className="flex flex-col md:flex-row md:items-start">
        {showImg ? (
          <div className="flex shrink-0 items-center justify-center px-3 py-4 md:w-[min(42%,400px)] md:px-4 md:py-6" style={{ background: imgBg }}>
            <img
              src={item.imageUrl}
              alt=""
              className="max-h-[min(55vh,420px)] w-full object-contain md:max-h-[min(65vh,560px)]"
              loading="lazy"
              onError={onImgError}
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-8">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: MM_ORANGE }}>
            編集部ピック
          </p>
          <h3 className="text-xl font-bold leading-snug tracking-tight sm:text-2xl" style={{ fontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif", color: titleColor }}>
            {title}
          </h3>
          {item.summary ? (
            <div className={`mt-4 whitespace-pre-wrap break-words text-[15px] leading-[1.75] sm:text-base ${summaryCls}`}>
              {item.summary}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-5" style={{ borderColor: border }}>
            <span className={`text-xs font-semibold ${metaCls}`}>{item.source}</span>
            <span className={metaCls} aria-hidden>·</span>
            <time className={`text-xs tabular-nums ${metaCls}`}>{item.dateText || item.timeText}</time>
            {item.sourceUrl && !isAiTrendSummarySource(item.source) ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-xs font-black text-white transition hover:opacity-90"
                style={{ background: isDark ? '#334155' : MM_INK }}
              >
                記事を開く <ExternalLink size={12} />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

function NewsPage({ session = null }) {
  const location = useLocation()
  const isLoggedIn = Boolean(session?.user)
  const [news, setNews] = useState([])
  const [manualNews, setManualNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [sortRelatedFirst, setSortRelatedFirst] = useState(false)
  const [tickerChangeBySymbol, setTickerChangeBySymbol] = useState(() => new Map())
  const [isDark, setIsDark] = useState(() => (
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  ))
  const {
    profile: exposureProfile,
    loading: exposureLoading,
  } = usePortfolioExposureProfile(session?.user?.id)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const themeInk = isDark ? '#f8fafc' : MM_INK
  const themeMuted = isDark ? '#94a3b8' : '#8A8680'
  const themeBorder = isDark ? '#475569' : '#DEDAD4'
  const themeBody = isDark ? '#cbd5e1' : '#444240'
  const themeHeroInkBg = isDark ? '#020617' : MM_INK

  useEffect(() => {
    const prev = document.title
    document.title = 'マーケット速報 | MoneyMart'
    return () => { document.title = prev }
  }, [])

  const fetchNews = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [{ rows, updatedAt }, manual] = await Promise.all([
        fetchAiNewsData(),
        fetchNewsPageManual(),
      ])
      setNews(Array.isArray(rows) ? rows : [])
      setManualNews(Array.isArray(manual) ? manual : [])
      setLastUpdated(updatedAt ? new Date(updatedAt) : new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchNews() }, [])


  const filteredNews = useMemo(() => {
    const base = filterNews(news, activeFilter)
    if (!sortRelatedFirst || !isLoggedIn || exposureProfile?.empty) return base
    const order = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }
    return [...base].sort((a, b) => {
      const sa = scoreNewsExposure(a, exposureProfile)
      const sb = scoreNewsExposure(b, exposureProfile)
      const d = (order[sb.level] || 0) - (order[sa.level] || 0)
      if (d !== 0) return d
      return (sb.matchedWeightPct || 0) - (sa.matchedWeightPct || 0)
    })
  }, [news, activeFilter, sortRelatedFirst, isLoggedIn, exposureProfile])

  useEffect(() => {
    if (loading) return undefined
    const params = new URLSearchParams(location.search || '')
    const articleId = String(params.get('article') || '').trim()
    if (!articleId) return undefined
    const el = document.getElementById(`news-article-${articleId}`)
    if (!el) return undefined
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-orange-400', 'ring-offset-2')
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-orange-400', 'ring-offset-2')
    }, 2600)
    return () => window.clearTimeout(t)
  }, [loading, location.search, filteredNews])

  const stats = useMemo(() => ({
    total: filteredNews.length,
    bullish: filteredNews.filter((n) => sentimentBucket(n.sentiment) === 'bullish').length,
    bearish: filteredNews.filter((n) => sentimentBucket(n.sentiment) === 'bearish').length,
  }), [filteredNews])

  const tickerSource = useMemo(() => {
    const hot = news.filter((n) => n.isHot)
    const base = hot.length > 0 ? hot : news
    return base.length > 0 ? base : filteredNews
  }, [news, filteredNews])

  const tickerSymbolsKey = useMemo(() => {
    const set = new Set()
    for (const item of tickerSource) {
      const sym = stockPageSymbolQuery(item)
      if (sym) set.add(sym)
    }
    return [...set].sort().join(',')
  }, [tickerSource])

  useEffect(() => {
    let cancelled = false
    const symbols = tickerSymbolsKey ? tickerSymbolsKey.split(',') : []
    if (symbols.length === 0) {
      setTickerChangeBySymbol(new Map())
      return undefined
    }

    ;(async () => {
      const since = new Date()
      since.setUTCDate(since.getUTCDate() - 21)
      const sinceYmd = since.toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('stock_daily_prices')
        .select('symbol,trade_date,close,source')
        .in('symbol', symbols)
        .gte('trade_date', sinceYmd)
        .order('trade_date', { ascending: false })
        .limit(Math.min(symbols.length * 12, 800))
      if (cancelled || error) return

      const bySymbol = new Map()
      for (const row of data || []) {
        const sym = String(row.symbol || '')
        if (!sym) continue
        if (!bySymbol.has(sym)) bySymbol.set(sym, [])
        bySymbol.get(sym).push(row)
      }

      const next = new Map()
      for (const sym of symbols) {
        const pct = dayChangePctFromPriceRows(bySymbol.get(sym) || [])
        if (Number.isFinite(pct)) next.set(sym, pct)
      }
      if (!cancelled) setTickerChangeBySymbol(next)
    })()

    return () => {
      cancelled = true
    }
  }, [tickerSymbolsKey])

  const layout = useMemo(() => {
    const list = filteredNews
    if (!list.length) {
      return { hero: null, subs: [], grid: [], wideMain: null, wideSides: [], strip: [] }
    }
    const hero = list.find((n) => n.isHot) || list[0]
    const rest = list.filter((n) => n.id !== hero.id)
    const subs = rest.slice(0, 2)
    let cursor = 2
    const grid = rest.slice(cursor, cursor + 3)
    cursor += 3
    const wideMain = rest[cursor] || null
    cursor += 1
    const wideSides = rest.slice(cursor, cursor + 2)
    cursor += 2
    const strip = rest.slice(cursor, cursor + 4)
    return { hero, subs, grid, wideMain, wideSides, strip }
  }, [filteredNews])

  const topbarDate = useMemo(() => {
    const d = new Date()
    const w = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]
    const j = d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')
    return `${j} ${w}`
  }, [])

  return (
    <div
      className="min-h-screen pb-16 font-sans text-[#111110] dark:text-slate-100"
      style={{ background: isDark ? '#0f172a' : MM_BG, fontFamily: "'Noto Sans JP', sans-serif" }}
    >
      {/* TOPBAR */}
      <header className="flex items-center justify-between px-6 py-2 sm:px-8" style={{ background: themeHeroInkBg }}>
        <Link to="/" className="text-lg font-bold tracking-tight text-white no-underline" style={{ fontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif" }}>
          Money<span style={{ color: MM_ORANGE }}>Mart</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-[11px] tracking-wide text-white/40 sm:inline">{topbarDate}</span>
          <button
            type="button"
            onClick={() => fetchNews(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-sm border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/90 hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} aria-hidden />
            更新
          </button>
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: MM_ORANGE }}>
            <span className="inline-block size-1.5 animate-pulse rounded-full" style={{ background: MM_ORANGE }} aria-hidden />
            Live
          </span>
        </div>
      </header>

      <MembersBlurGate
        isLoggedIn={isLoggedIn}
        returnPath={`${location.pathname}${location.search || ''}`}
        label="ログイン後にマーケット速報をご覧いただけます"
        hint="無料登録でAI要約ニュース・銘柄別速報をご覧いただけます。"
        className="min-h-[min(72vh,640px)]"
        overlayRoundedClass="rounded-none"
      >
        <div className={!isLoggedIn ? 'max-h-[min(68vh,600px)] overflow-hidden' : undefined}>
      {/* TICKER */}
      {tickerSource.length > 0 ? (
        <div className="flex overflow-hidden" style={{ background: MM_ORANGE }}>
          <div className="shrink-0 border-r border-white/20 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white">
            速報
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="inline-flex animate-ticker items-center whitespace-nowrap pl-3">
              {[...tickerSource, ...tickerSource, ...tickerSource].map((item, i) => {
                const sym = stockPageSymbolQuery(item)
                const chg = tickerChgDisplay(sym ? tickerChangeBySymbol.get(sym) : null)
                const fd = displayNewsFlag(item.flag)
                return (
                  <span key={`${item.id}-tk-${i}`} className="mr-9 inline-flex items-center gap-1.5 py-2.5 text-[11px] font-bold text-white/90">
                    <span className="font-bold text-white">
                      {fd != null ? `${fd} ` : ''}{item.ticker || '—'}
                    </span>
                    <span className="max-w-[200px] truncate sm:max-w-none">{item.headline}</span>
                    {chg ? <span className={chg.cls} style={chg.style}>{chg.text}</span> : null}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1080px] px-6 sm:px-6">

        {/* PAGE HEAD — ティッカー直下に配置 */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b-2 border-[#111110] pb-5 pt-4 dark:border-slate-500 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: MM_ORANGE }}>AI Market Intelligence</p>
            <h1 className="text-[2.1rem] font-bold leading-none tracking-tight sm:text-[2.4rem]" style={{ fontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif", color: themeInk }}>
              マーケット速報
            </h1>
            <p className="mt-1.5 text-xs" style={{ color: themeMuted }}>取得した銘柄ニュースをAIが要約・整理</p>
            {lastUpdated ? (
              <p className="mt-2 text-[10px] font-semibold tabular-nums" style={{ color: themeMuted }}>
                最終更新 {lastUpdated.toLocaleString('ja-JP')}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-5 sm:gap-5">
            <div className="text-right">
              <div className="text-[1.75rem] font-bold leading-none tabular-nums tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>
                {loading ? '—' : stats.total}
              </div>
              <div className="mt-0.5 text-[9px] font-bold tracking-wider" style={{ color: themeMuted }}>本日の記事</div>
            </div>
            <div className="h-10 w-px bg-[#DEDAD4] dark:bg-slate-600" aria-hidden />
            <div className="text-right">
              <div className="text-[1.75rem] font-bold leading-none tabular-nums tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: MM_BULL }}>
                {loading ? '—' : stats.bullish}
              </div>
              <div className="mt-0.5 text-[9px] font-bold tracking-wider" style={{ color: themeMuted }}>📈 強気</div>
            </div>
            <div className="h-10 w-px bg-[#DEDAD4] dark:bg-slate-600" aria-hidden />
            <div className="text-right">
              <div className="text-[1.75rem] font-bold leading-none tabular-nums tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: MM_BEAR }}>
                {loading ? '—' : stats.bearish}
              </div>
              <div className="mt-0.5 text-[9px] font-bold tracking-wider" style={{ color: themeMuted }}>📉 弱気</div>
            </div>
          </div>
        </div>

        {/* FILTER */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {FILTER_DEFS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveFilter(t.id)}
              className="cursor-pointer rounded border-[1.5px] px-4 py-1.5 text-[11px] font-bold tracking-wide transition-colors"
              style={{
                borderColor: activeFilter === t.id ? (isDark ? '#e2e8f0' : MM_INK) : themeBorder,
                background: activeFilter === t.id ? (isDark ? '#334155' : MM_INK) : (isDark ? '#1e293b' : MM_WHITE),
                color: activeFilter === t.id ? '#fff' : themeMuted,
              }}
            >
              {t.label}
            </button>
          ))}
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => setSortRelatedFirst((v) => !v)}
              className="cursor-pointer rounded border-[1.5px] px-4 py-1.5 text-[11px] font-bold tracking-wide transition-colors"
              style={{
                borderColor: sortRelatedFirst ? MM_ORANGE : themeBorder,
                background: sortRelatedFirst ? 'rgba(212,114,42,0.15)' : (isDark ? '#1e293b' : MM_WHITE),
                color: sortRelatedFirst ? MM_ORANGE : themeMuted,
              }}
              title="保有資産との関連度が高いニュースを先に表示（価格予測ではありません）"
            >
              保有との関連順
            </button>
          ) : null}
        </div>

        <p className="mb-6 rounded-sm border border-[#DEDAD4] bg-[#FAFAF8]/90 px-3 py-2 text-[10px] font-semibold leading-relaxed text-[#8A8680] dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          {LEGAL_NOTICE_TEMPLATES.newsNotSolicitation}
        </p>

        {loading ? (
          <div className="space-y-1.5 animate-pulse">
            <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-[1.4fr_1fr]">
              <div className="h-[340px] rounded-sm bg-[#DEDAD4]/80 dark:bg-slate-700/80" />
              <div className="flex flex-col gap-1.5">
                <div className="h-[164px] rounded-sm bg-[#DEDAD4]/60 dark:bg-slate-700/60" />
                <div className="h-[164px] rounded-sm bg-[#DEDAD4]/60 dark:bg-slate-700/60" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
              <div className="h-48 rounded-sm bg-[#DEDAD4]/50 dark:bg-slate-700/50" />
              <div className="h-48 rounded-sm bg-[#DEDAD4]/50 dark:bg-slate-700/50" />
              <div className="h-48 rounded-sm bg-[#DEDAD4]/50 dark:bg-slate-700/50" />
            </div>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="rounded-sm border border-dashed bg-[#FAFAF8] px-6 py-16 text-center dark:border-slate-600 dark:bg-slate-800/50" style={{ borderColor: themeBorder }}>
            <Newspaper className="mx-auto mb-3 text-[#8A8680] dark:text-slate-500" size={40} aria-hidden />
            <p className="font-bold text-[#444240] dark:text-slate-200">表示できるニュースがありません</p>
            <button type="button" onClick={() => fetchNews(true)} className="mt-4 text-sm font-bold hover:underline" style={{ color: MM_ORANGE }}>
              再読み込み
            </button>
          </div>
        ) : (
          <>
            {/* HERO */}
            {layout.hero ? (
              <div className="mb-1.5 grid grid-cols-1 gap-1.5 lg:grid-cols-[1.4fr_1fr]">
                <article id={layout.hero?.id ? `news-article-${layout.hero.id}` : undefined} className="relative flex min-h-[340px] flex-col justify-between overflow-hidden px-8 py-8 text-white" style={{ background: themeHeroInkBg }}>
                  <div className="pointer-events-none absolute left-0 right-0 top-0 h-1" style={{ background: MM_ORANGE }} aria-hidden />
                  <div>
                    <div className="mb-3.5 flex flex-wrap items-center gap-2">
                      <SentimentPill sentiment={layout.hero.sentiment} hot isDark={isDark} />
                      {isLoggedIn && !exposureLoading && !exposureProfile?.empty ? (
                        <ExposureLevelBadge level={scoreNewsExposure(layout.hero, exposureProfile).level} compact />
                      ) : null}
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/50">
                        {layout.hero.sector && layout.hero.sector !== 'その他' ? `${layout.hero.sector} · ` : ''}{marketRegionLabel(layout.hero.market)}
                      </span>
                    </div>
                    <div className="mb-1 text-[2.6rem] font-bold leading-none tracking-tight sm:text-[3.15rem]" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>
                      {layout.hero.ticker || '—'}
                    </div>
                    <div className="mb-4 text-[13px] text-white/40">
                      {layout.hero.companyName || '—'} · {exchangeHint(layout.hero)}
                    </div>
                    <h2 className="mb-4 text-[1.35rem] font-bold leading-snug tracking-tight sm:text-[1.4rem]" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>
                      {layout.hero.headline}
                    </h2>
                    <p className="mb-5 text-[13px] leading-[1.8] text-white/60">
                      {summaryBody(layout.hero)}
                    </p>
                    {layout.hero.impact ? (
                      <div className="mb-4 rounded border border-[#D4722A]/30 bg-[#D4722A]/10 px-3.5 py-3">
                        <p className="mb-1 text-[8px] font-black uppercase tracking-widest" style={{ color: MM_ORANGE }}>AI 投資インパクト</p>
                        <p className="text-xs leading-relaxed text-white/75">{layout.hero.impact}</p>
                      </div>
                    ) : null}
                    <PortfolioNewsRelevanceCard
                      news={layout.hero}
                      exposureProfile={exposureProfile}
                      loading={exposureLoading}
                      isLoggedIn={isLoggedIn}
                      variant="dark"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="text-[10px] text-white/30">
                      {layout.hero.source} · {layout.hero.dateText || layout.hero.timeText}
                    </span>
                    <NewsArticleLinks item={layout.hero} variant="dark" />
                  </div>
                </article>

                <div className="flex flex-col gap-1.5">
                  {layout.subs.map((item) => {
                    const b = sentimentBucket(item.sentiment)
                    const kickerColor = b === 'bullish' ? MM_BULL : b === 'bearish' ? MM_BEAR : themeMuted
                    return (
                      <article
                        key={item.id}
                        id={item.id ? `news-article-${item.id}` : undefined}
                        className="flex min-h-[164px] flex-1 flex-col justify-between px-6 py-5"
                        style={{ background: cardSurfaceBySentiment(item.sentiment, isDark) }}
                      >
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-1 text-[9px] font-black uppercase tracking-wider" style={{ color: kickerColor }}>
                            <SentimentPill sentiment={item.sentiment} isDark={isDark} />
                            {isLoggedIn && !exposureLoading && !exposureProfile?.empty ? (
                              <ExposureLevelBadge level={scoreNewsExposure(item, exposureProfile).level} compact />
                            ) : null}
                            <span className="font-normal" style={{ color: themeMuted }}>
                              · {item.sector && item.sector !== 'その他' ? `${item.sector} · ` : ''}{displayNewsFlag(item.flag) || '🌐'}
                            </span>
                          </div>
                          <div className="mb-0.5 text-[1.65rem] font-bold leading-none tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>
                            {item.ticker || '—'}
                          </div>
                          <div className="mb-2.5 text-[11px]" style={{ color: themeMuted }}>{item.companyName} · {exchangeHint(item)}</div>
                          <h3 className="mb-2 text-[15px] font-bold leading-snug tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>
                            {item.headline}
                          </h3>
                          <p className="line-clamp-3 text-[11px] leading-[1.7]" style={{ color: themeMuted }}>{summaryBody(item)}</p>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 border-t pt-2 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: themeBorder }}>
                          <div className="text-[10px]" style={{ color: themeMuted }}>{item.source} · {item.dateText || item.timeText}</div>
                          <NewsArticleLinks item={item} />
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* GRID 3 */}
            {layout.grid.length > 0 ? (
              <div className="mb-1.5 grid grid-cols-1 gap-1.5 md:grid-cols-3">
                {layout.grid.map((item, idx) => {
                  const dark = idx === 1
                  const b = sentimentBucket(item.sentiment)
                  const kickerColor = dark
                    ? MM_ORANGE
                    : b === 'bullish'
                      ? MM_BULL
                      : b === 'bearish'
                        ? MM_BEAR
                        : themeMuted
                  return (
                    <article
                      key={item.id}
                      id={item.id ? `news-article-${item.id}` : undefined}
                      className="flex flex-col px-6 py-5"
                      style={{
                        background: dark ? themeHeroInkBg : cardSurfaceBySentiment(item.sentiment, isDark),
                        color: dark ? '#fff' : themeInk,
                        borderLeft: dark ? darkCardLeftAccent(item.sentiment) : undefined,
                      }}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-1 text-[8px] font-black uppercase tracking-wider" style={{ color: kickerColor }}>
                        <SentimentPill sentiment={item.sentiment} isDark={isDark} />
                        {isLoggedIn && !exposureLoading && !exposureProfile?.empty ? (
                          <ExposureLevelBadge level={scoreNewsExposure(item, exposureProfile).level} compact />
                        ) : null}
                        <span style={{ color: dark ? 'rgba(255,255,255,0.3)' : themeMuted, fontWeight: 400 }}>
                          · {item.sector && item.sector !== 'その他' ? `${item.sector} · ` : ''}{marketRegionLabel(item.market).replace(/株$/, '')}
                        </span>
                      </div>
                      <div className="mb-0.5 text-[1.375rem] font-bold tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: dark ? '#fff' : themeInk }}>
                        {item.ticker}
                      </div>
                      <div className="mb-2.5 text-[10px]" style={{ color: dark ? 'rgba(255,255,255,0.35)' : themeMuted }}>
                        {item.companyName} · {exchangeHint(item)}
                      </div>
                      <div className="mb-2.5 h-px" style={{ background: dark ? 'rgba(255,255,255,0.1)' : themeBorder }} aria-hidden />
                      <h3 className="mb-2.5 text-[15px] font-bold leading-snug tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: dark ? '#fff' : themeInk }}>
                        {item.headline}
                      </h3>
                      <p className="line-clamp-4 flex-1 text-[11px] leading-[1.7]" style={{ color: dark ? 'rgba(255,255,255,0.55)' : themeMuted }}>
                        {summaryBody(item)}
                      </p>
                      <div
                        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[10px]"
                        style={{ color: dark ? 'rgba(255,255,255,0.3)' : themeMuted }}
                      >
                        <span>{item.source} · {item.dateText || item.timeText}</span>
                        <NewsArticleLinks item={item} variant={dark ? 'dark' : 'light'} />
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : null}

            {/* WIDE ROW */}
            {(layout.wideMain || layout.wideSides.length > 0) ? (
              <div className="mb-1.5 grid grid-cols-1 gap-1.5 lg:grid-cols-[2fr_1fr_1fr]">
                {layout.wideMain ? (
                  <article id={layout.wideMain?.id ? `news-article-${layout.wideMain.id}` : undefined} className="px-7 py-6" style={{ background: cardSurfaceBySentiment(layout.wideMain.sentiment, isDark) }}>
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                      <SentimentPill sentiment={layout.wideMain.sentiment} isDark={isDark} />
                      {isLoggedIn && !exposureLoading && !exposureProfile?.empty ? (
                        <ExposureLevelBadge level={scoreNewsExposure(layout.wideMain, exposureProfile).level} compact />
                      ) : null}
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: themeMuted }}>
                        {layout.wideMain.sector && layout.wideMain.sector !== 'その他' ? `${layout.wideMain.sector} · ` : ''}{marketRegionLabel(layout.wideMain.market)}
                      </span>
                    </div>
                    <div className="mb-1 text-[2.1rem] font-bold leading-none tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>
                      {layout.wideMain.ticker}{' '}
                      <span className="text-[15px] font-normal" style={{ color: themeMuted }}>{layout.wideMain.companyName}</span>
                    </div>
                    <div className="my-3 h-px" style={{ background: themeBorder }} aria-hidden />
                    <h2 className="mb-3 text-[1.25rem] font-bold leading-snug tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>
                      {layout.wideMain.headline}
                    </h2>
                    <p className="mb-4 text-xs leading-[1.8]" style={{ color: themeBody }}>{summaryBody(layout.wideMain)}</p>
                    {layout.wideMain.impact ? (
                      <div className="mb-4 rounded border border-[#D4722A]/30 bg-[#D4722A]/10 px-3.5 py-3 dark:border-orange-500/30 dark:bg-orange-950/25">
                        <p className="mb-1 text-[8px] font-black uppercase tracking-widest" style={{ color: MM_ORANGE }}>AI 投資インパクト</p>
                        <p className="text-xs leading-relaxed" style={{ color: themeBody }}>{layout.wideMain.impact}</p>
                      </div>
                    ) : null}
                    <PortfolioNewsRelevanceCard
                      news={layout.wideMain}
                      exposureProfile={exposureProfile}
                      loading={exposureLoading}
                      isLoggedIn={isLoggedIn}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="text-[10px]" style={{ color: themeMuted }}>{layout.wideMain.source} · {layout.wideMain.dateText || layout.wideMain.timeText}</span>
                      <NewsArticleLinks item={layout.wideMain} />
                    </div>
                  </article>
                ) : <div className="hidden lg:block" aria-hidden />}

                {layout.wideSides.map((item) => (
                  <article
                    key={item.id}
                    id={item.id ? `news-article-${item.id}` : undefined}
                    className="flex h-full min-h-[200px] flex-col px-5 py-5"
                    style={{ background: cardSurfaceBySentiment(item.sentiment, isDark) }}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <SentimentPill sentiment={item.sentiment} isDark={isDark} />
                      <span className="text-[9px]" style={{ color: themeMuted }}>
                        {item.sector && item.sector !== 'その他' ? `${item.sector} · ` : ''}{displayNewsFlag(item.flag) || '🌐'}
                      </span>
                    </div>
                    <div className="mb-0.5 text-[1.25rem] font-bold tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>
                      {item.ticker}{' '}
                      <span className="text-[11px] font-normal" style={{ color: themeMuted }}>{item.companyName}</span>
                    </div>
                    <div className="my-2.5 h-px" style={{ background: themeBorder }} aria-hidden />
                    <h3 className="mb-2 text-sm font-bold leading-snug" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>{item.headline}</h3>
                    <p className="line-clamp-5 flex-1 text-[11px] leading-[1.7]" style={{ color: themeMuted }}>{summaryBody(item)}</p>
                    <div className="mt-auto flex flex-col gap-2 border-t pt-2.5" style={{ borderColor: themeBorder }}>
                      <div className="text-[10px]" style={{ color: themeMuted }}>{item.source} · {item.dateText || item.timeText}</div>
                      <NewsArticleLinks item={item} />
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {/* STRIP */}
            {layout.strip.length > 0 ? (
              <div className="mb-8 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                {layout.strip.map((item) => (
                  <article key={item.id} id={item.id ? `news-article-${item.id}` : undefined} className="px-4 py-4" style={{ background: cardSurfaceBySentiment(item.sentiment, isDark) }}>
                    <div className="mb-0.5 text-base font-bold tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>
                      {item.ticker}{' '}
                      <span className="text-[10px] font-normal" style={{ color: themeMuted }}>{displayNewsFlag(item.flag) || ''} {item.companyName}</span>
                    </div>
                    <div className="mb-2 text-[10px]" style={{ color: themeMuted }}>
                      <span className="mr-1"><SentimentPill sentiment={item.sentiment} isDark={isDark} /></span>
                      {item.sector && item.sector !== 'その他' ? item.sector : '—'}
                    </div>
                    <div className="mb-2 h-px" style={{ background: themeBorder }} aria-hidden />
                    <p className="mb-2 text-xs font-bold leading-snug line-clamp-3" style={{ color: themeInk }}>{item.headline}</p>
                    <div className="flex justify-between text-[9px]" style={{ color: themeMuted }}>
                      <span>{item.source}</span>
                      <span>{item.dateText || item.timeText}</span>
                    </div>
                    <div className="mt-2 border-t pt-2" style={{ borderColor: themeBorder }}>
                      <NewsArticleLinks item={item} compact />
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {/* 残り一覧（レイアウトに載らなかった分） */}
            {(() => {
              const used = new Set()
              if (layout.hero) used.add(layout.hero.id)
              layout.subs.forEach((x) => used.add(x.id))
              layout.grid.forEach((x) => used.add(x.id))
              if (layout.wideMain) used.add(layout.wideMain.id)
              layout.wideSides.forEach((x) => used.add(x.id))
              layout.strip.forEach((x) => used.add(x.id))
              const rest = filteredNews.filter((n) => !used.has(n.id))
              if (rest.length === 0) return null
              return (
                <section className="mb-10 border-t pt-8" aria-label="その他のニュース" style={{ borderTopColor: themeBorder }}>
                  <h2 className="mb-4 text-lg font-bold tracking-tight" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>その他のトピック</h2>
                  <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                    {rest.map((item) => {
                      const sourceHref = resolvedSourceHref(item)
                      return (
                      <article key={item.id} id={item.id ? `news-article-${item.id}` : undefined} className="border p-5 dark:border-slate-600" style={{ borderColor: themeBorder, background: cardSurfaceBySentiment(item.sentiment, isDark) }}>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {item.isHot ? <Flame className="text-[#D4722A]" size={14} aria-hidden /> : null}
                          <span className="font-mono text-sm font-bold" style={{ color: themeInk }}>{item.ticker}</span>
                          <SentimentPill sentiment={item.sentiment} isDark={isDark} />
                          <span className="text-[10px]" style={{ color: themeMuted }}>{item.dateText || item.timeText}</span>
                        </div>
                        <h3 className="mb-2 text-base font-bold leading-snug" style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: themeInk }}>{item.headline}</h3>
                        <p className="mb-3 line-clamp-3 text-xs leading-relaxed" style={{ color: themeBody }}>{summaryBody(item)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {sourceHref && !isAiTrendSummarySource(item.source) ? (
                            <a
                              href={sourceHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-sm border px-3 py-2 text-[11px] font-black no-underline hover:border-[#D4722A] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-orange-500"
                              style={{ borderColor: themeBorder, background: isDark ? '#0f172a' : '#fff', color: themeBody }}
                            >
                              元記事 <ExternalLink size={12} aria-hidden />
                            </a>
                          ) : null}
                          {item.ticker ? (
                            <Link to={`/stocks?symbol=${encodeURIComponent(stockPageSymbolQuery(item))}`} className="rounded-sm px-3 py-2 text-[11px] font-black text-white no-underline hover:opacity-90" style={{ background: isDark ? '#475569' : '#111110' }}>
                              株式詳細へ
                            </Link>
                          ) : null}
                        </div>
                      </article>
                      )
                    })}
                  </div>
                </section>
              )
            })()}
          </>
        )}

        {manualNews.length > 0 ? (
          <section className="mb-10 mt-2 border-t pt-10" aria-label="手動ニュース" style={{ borderTopColor: themeBorder }}>
            <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: MM_ORANGE }}>エディターズピック</p>
            <div className="flex flex-col gap-6">
              {manualNews.map((item) => (
                <ManualPickCard key={item.id} item={item} isDark={isDark} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
        </div>
      </MembersBlurGate>

      <div className="mx-auto max-w-[1080px] px-6 sm:px-6">
        {/* A8 リーダーボード 728×90 */}
        <aside
          className="mb-8 mt-2 border-t pt-8 dark:border-slate-600"
          style={{ borderTopColor: themeBorder }}
          aria-label="スポンサー広告"
        >
          <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-wider" style={{ color: themeMuted }}>
            広告
          </p>
          <div className="flex justify-center overflow-x-auto px-0">
            <a
              href={MATSUI_FX_A8.clickUrl}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="inline-block max-w-full"
            >
              <img
                src={MATSUI_FX_A8.bannerSrc728x90}
                width={728}
                height={90}
                alt={MATSUI_FX_HEADLINE}
                className="h-auto w-full max-w-[728px]"
                loading="lazy"
                decoding="async"
              />
            </a>
          </div>
          <ul className="mx-auto mt-3 max-w-[728px] space-y-1 text-[9px] leading-relaxed text-left" style={{ color: themeMuted }}>
            {MATSUI_FX_AFFILIATE_DISCLOSURE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="h-0 w-0 overflow-hidden" aria-hidden>
            <img
              src={MATSUI_FX_A8.pixelSrc}
              width={1}
              height={1}
              alt=""
              decoding="async"
            />
          </div>
        </aside>

        <div className="border-t pb-12 pt-5" style={{ borderTopColor: themeBorder }}>
          <p className="mb-4 text-[10px] leading-[1.85] text-justify" style={{ color: themeMuted }}>
            {LEGAL_NOTICE_TEMPLATES.newsMarketFooter}
          </p>
          <p className="text-[10px] leading-[1.8]" style={{ color: themeMuted }}>
            {LEGAL_NOTICE_TEMPLATES.investment}
          </p>
        </div>
      </div>
    </div>
  )
}

export default NewsPage
