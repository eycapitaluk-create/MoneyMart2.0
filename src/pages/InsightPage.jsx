import { useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Copy, Loader2, Mail } from 'lucide-react'
import InsightArticleView from '../components/insights/InsightArticleView'
import InsightArticleSoftGate from '../components/insights/InsightArticleSoftGate'
import {
  fetchInsightBySlug,
  fetchInsightPublicCatalog,
  fetchInsightPublicPreview,
  fetchPublishedInsights,
  mapPublicPreviewToInsightRow,
} from '../lib/insightApi'
import { looksLikeInsightHtml, plainTextFromInsightHtml } from '../lib/insightHtml'
import { normalizeInsightDocumentForRender } from '../lib/insightDocumentNormalize'
import { getInsightCategoryTheme, getInsightCategoryThemeFromDocument } from '../lib/insightCategoryTheme'
import { articleJsonLd, breadcrumbListJsonLd, EDITORIAL_AUTHOR_NAME } from '../lib/seoConfig'
import { appendUtm } from '../lib/utmLinks'

function formatDate(dateText) {
  if (!dateText) return '日付未設定'
  const d = new Date(dateText)
  if (Number.isNaN(d.getTime())) return String(dateText).slice(0, 10)
  return d.toLocaleDateString('ja-JP')
}

function buildPreviewText(row) {
  const doc = normalizeInsightDocumentForRender(row?.document || {})
  const heroSub = String(doc?.hero?.sub || '').trim()
  if (heroSub) return heroSub
  const prose = Array.isArray(doc?.sections) ? doc.sections.find((s) => s?.type === 'prose') : null
  const lead = String(prose?.lead || '').trim()
  if (lead) return lead
  const p = Array.isArray(prose?.paragraphs) ? prose.paragraphs.find(Boolean) : ''
  const raw = String(p || '本文プレビューはありません。').trim()
  if (looksLikeInsightHtml(raw)) return plainTextFromInsightHtml(raw) || '本文プレビューはありません。'
  return raw
}

function getInsightCategoryLabel(item) {
  const admin = item?.document?.admin
  const c = admin && typeof admin === 'object' ? String(admin.category || '').trim() : ''
  if (c) return c
  const badge = String(item?.document?.hero?.badge || '').trim()
  if (badge) return badge.split(/[—\-–]/)[0].trim() || badge
  return 'インサイト'
}

function getReadTimeLabel(item) {
  const meta = item?.document?.hero?.meta
  if (!Array.isArray(meta)) return null
  const third = String(meta[2] || '').trim()
  if (/分$/.test(third)) return third
  return null
}

function getInsightCoverUrl(item) {
  const admin = item?.document?.admin
  const fromAdmin = admin && typeof admin === 'object' ? String(admin.coverImageUrl || '').trim() : ''
  if (fromAdmin) return fromAdmin
  return String(item?.document?.hero?.coverImageUrl || '').trim()
}

/** Absolute URL for Open Graph / X Cards */
function resolveInsightOgImageUrl(item) {
  const raw = getInsightCoverUrl(item)
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  const origin = SITE_ORIGIN.replace(/\/$/, '')
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return `${origin}${path}`
}

/** X ロゴ — lucide にブランド公式アイコンが無い場合の代替 */
function IconXLogo({ className, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function buildInsightShareTargets(pageTitle, canonicalUrl) {
  const title = String(pageTitle || '').trim()
  const url = String(canonicalUrl || '').trim()
  // Each destination carries its own source so a share can be traced back to
  // the network it went out on, not just lumped into Direct / no referrer.
  const tagged = (source, medium = 'social') => (
    url ? appendUtm(url, { source, medium, campaign: 'insight_share' }) : url
  )
  const tweetText = title.slice(0, 220)
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(tagged('twitter'))}`
  const lineHref = `https://line.me/R/msg/text/?${encodeURIComponent(`${title}\n${tagged('line')}`)}`
  const mailSubject = encodeURIComponent(`${title} | MoneyMart`)
  const mailUrl = tagged('newsletter', 'email')
  const mailBody = encodeURIComponent(`${title}\n\n${mailUrl}\n\n— MoneyMart\nhttps://www.moneymart.co.jp`)
  const mailHref = `mailto:?subject=${mailSubject}&body=${mailBody}`
  const copyUrl = url ? appendUtm(url, { medium: 'copy_link', campaign: 'insight_share' }) : url
  return { xHref, lineHref, mailHref, copyUrl }
}

async function copyTextToClipboard(text) {
  const t = String(text || '').trim()
  if (!t) return false
  try {
    await navigator.clipboard.writeText(t)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = t
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function truncateTitle(s, max = 56) {
  const t = String(s || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** 一覧1ページあたりの件数 */
const INSIGHT_INDEX_PAGE_SIZE = 3
const SITE_ORIGIN = 'https://www.moneymart.co.jp'

const INDEX_PAGE_TITLE = 'MoneyMart Insights｜市場・経済・テクノロジー最新インサイト | MoneyMart'
const INDEX_PAGE_DESCRIPTION =
  '家計・資産・マーケットをデータで読み解く MoneyMart 編集インサイト。新NISA・住宅資金・マクロを横断した検証型レポートを無料公開しています。'

const INSIGHT_TOPIC_FILTERS = [
  { key: 'nisa', label: '#新NISA' },
  { key: 'household', label: '#家計' },
  { key: 'mortgage', label: '#住宅ローン' },
  { key: 'market', label: '#マーケット' },
  { key: 'global', label: '#グローバル' },
]

function topicKeywordsInsight(topicKey) {
  const k = String(topicKey || '').toLowerCase()
  const map = {
    nisa: ['nisa', '新nisa', 'つみたて', '成長投資', '累積投資'],
    household: ['家計', '家計金融', '金融資産', '貯蓄'],
    mortgage: ['ローン', '住宅', '金利', '借入'],
    market: ['マーケット', '相場', '指数', 'sentiment', 'センチメント'],
    global: ['グローバル', '世界', '分散', '地政学', '為替'],
  }
  return map[k] || []
}

function articleMatchesTopicInsight(item, topicKey) {
  const keys = topicKeywordsInsight(topicKey)
  if (!keys.length) return true
  const cat = getInsightCategoryLabel(item).toLowerCase()
  const tk = String(topicKey || '').toLowerCase()
  if (tk === 'market' && /マーケット|market|相場|市場/.test(cat)) return true
  if (tk === 'etf' && /etf|投資信託/.test(cat)) return true
  const title = String(item?.pageTitle || '').toLowerCase()
  const prev = buildPreviewText(item).toLowerCase()
  const blob = `${cat} ${title} ${prev}`
  return keys.some((kw) => blob.includes(kw.toLowerCase()))
}

/** 一覧のタグ用：定義済みテーマのうち記事に最初に合致するもの */
function primaryTopicMetaForArticle(item) {
  for (const t of INSIGHT_TOPIC_FILTERS) {
    if (articleMatchesTopicInsight(item, t.key)) return t
  }
  return null
}

/** 一覧のページ番号を記事から `/insights` へ戻すときに使う */
function buildInsightsListHref(insightsListReturn) {
  if (!insightsListReturn || typeof insightsListReturn !== 'object') return '/insights'
  const pg = Number(insightsListReturn.page)
  const topicKey = insightsListReturn.topicKey
  const pageQs = Number.isFinite(pg) && pg > 1 ? `?page=${Math.floor(pg)}` : ''
  const tk = topicKey != null ? String(topicKey).trim() : ''
  if (tk) {
    return `/insights/category/${encodeURIComponent(tk)}${pageQs}`
  }
  return `/insights${pageQs}`
}

export default function InsightPage({ session = null }) {
  const { slug, categoryKey } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isLoggedIn = Boolean(session?.user)
  const [row, setRow] = useState(null)
  const [rows, setRows] = useState([])
  const prevTopicKeyRef = useRef(String(categoryKey ?? '').trim())
  /** 記事ページ用：一覧と同じ並び（新しい順）で前後記事を決める */
  const [navList, setNavList] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [insightLinkCopied, setInsightLinkCopied] = useState(false)
  const insightLinkCopyTimerRef = useRef(null)

  const trimmedTopic = String(categoryKey ?? '').trim()
  const trimmedSlug = String(slug ?? '').trim()
  const isTopicIndex = Boolean(trimmedTopic)
  const isIndex = !trimmedSlug && !isTopicIndex

  const listRows = useMemo(() => {
    if (!isTopicIndex) return rows
    return rows.filter((item) => articleMatchesTopicInsight(item, trimmedTopic))
  }, [rows, isTopicIndex, trimmedTopic])

  const indexTotalPages = Math.max(1, Math.ceil(listRows.length / INSIGHT_INDEX_PAGE_SIZE))
  const rawPageParam = parseInt(searchParams.get('page') || '1', 10)
  const safePageParam = Number.isFinite(rawPageParam) && rawPageParam >= 1 ? rawPageParam : 1
  /** 一覧ページは URL の ?page= のみを真実とする（取得中に totalPages が 1 になるとローカル state が 1 に固定される不具合を避ける） */
  const baseInsightsListPath = useMemo(
    () => (isTopicIndex ? `/insights/category/${encodeURIComponent(trimmedTopic)}` : '/insights'),
    [isTopicIndex, trimmedTopic],
  )
  const listPage = Math.min(Math.max(1, safePageParam), indexTotalPages)

  const pagedIndexRows = useMemo(() => {
    const start = (listPage - 1) * INSIGHT_INDEX_PAGE_SIZE
    return listRows.slice(start, start + INSIGHT_INDEX_PAGE_SIZE)
  }, [listRows, listPage])

  /** 全記事リスト：トップは取得分すべて、テーマ別ページはそのテーマに合致するもの */
  const archiveRows = useMemo(() => {
    if (isTopicIndex) return listRows
    return rows
  }, [isTopicIndex, listRows, rows])

  /** テーマ切り替え時はクエリを落として一覧 1 ページ目相当にする */
  useEffect(() => {
    if (!isTopicIndex) {
      prevTopicKeyRef.current = trimmedTopic
      return
    }
    if (prevTopicKeyRef.current !== trimmedTopic) {
      navigate({ pathname: `/insights/category/${encodeURIComponent(trimmedTopic)}`, search: '' }, { replace: true })
      prevTopicKeyRef.current = trimmedTopic
    }
  }, [trimmedTopic, isTopicIndex, navigate])

  /** 一覧データが揃ったあと、URL の page が総ページを超えているときだけクエリを直す（読み込み中は URL を書き換えない） */
  useEffect(() => {
    if (!isIndex && !isTopicIndex) return
    if (loading) return
    if (safePageParam === listPage) return
    const qs = listPage <= 1 ? '' : `?page=${listPage}`
    navigate(`${baseInsightsListPath}${qs}`, { replace: true, preventScrollReset: true })
  }, [isIndex, isTopicIndex, loading, safePageParam, listPage, baseInsightsListPath, navigate])

  const goToInsightsListPage = (n) => {
    const clamped = Math.min(Math.max(1, Math.floor(Number(n) || 1)), indexTotalPages)
    const qs = clamped <= 1 ? '' : `?page=${clamped}`
    navigate(`${baseInsightsListPath}${qs}`, { preventScrollReset: true })
  }

  const insightsFromListState =
    isIndex || isTopicIndex
      ? {
          insightsListReturn: {
            page: listPage,
            topicKey: isTopicIndex ? trimmedTopic : null,
          },
        }
      : undefined

  useEffect(() => {
    setInsightLinkCopied(false)
    return () => {
      if (insightLinkCopyTimerRef.current) {
        window.clearTimeout(insightLinkCopyTimerRef.current)
        insightLinkCopyTimerRef.current = null
      }
    }
  }, [trimmedSlug])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setNotFound(false)
    setRow(null)
    setRows([])
    setNavList([])
    const run = async () => {
      try {
        if (isIndex || isTopicIndex) {
          let list = await fetchPublishedInsights(80)
          if (!alive) return
          if (!list.length && !isLoggedIn) {
            const catalog = await fetchInsightPublicCatalog(80)
            if (!alive) return
            list = catalog.map(mapPublicPreviewToInsightRow).filter(Boolean)
          }
          setRows(list)
          return
        }

        const [data, list] = await Promise.all([
          fetchInsightBySlug(trimmedSlug),
          fetchPublishedInsights(80),
        ])
        if (!alive) return
        let nav = Array.isArray(list) ? list : []
        if (!nav.length && !isLoggedIn) {
          const catalog = await fetchInsightPublicCatalog(80)
          if (!alive) return
          nav = catalog.map(mapPublicPreviewToInsightRow).filter(Boolean)
        }
        setNavList(nav)
        let article = data
        if (!article && !isLoggedIn) {
          const preview = await fetchInsightPublicPreview(trimmedSlug)
          if (!alive) return
          if (preview) article = mapPublicPreviewToInsightRow(preview)
        }
        if (!article && nav.length) {
          const fromNav = nav.find((r) => String(r?.slug || '') === trimmedSlug)
          if (fromNav) article = fromNav
        }
        if (article) {
          setRow(article)
          setNotFound(false)
        } else {
          setNotFound(true)
        }
      } catch (e) {
        if (!alive) return
        console.warn(e)
        if (isIndex || isTopicIndex) setRows([])
        else setNotFound(true)
      } finally {
        if (alive) setLoading(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [isIndex, isTopicIndex, trimmedSlug, isLoggedIn])

  const topicFilterMeta = useMemo(() => {
    if (!isTopicIndex) return null
    const label = INSIGHT_TOPIC_FILTERS.find((t) => t.key === trimmedTopic)?.label || `#${trimmedTopic}`
    const plain = label.replace(/^#/, '')
    return {
      label,
      title: `インサイト：${label} | MoneyMart`,
      description: `${plain} に関連する MoneyMart の分析記事一覧です。`,
      canonical: `${SITE_ORIGIN}/insights/category/${encodeURIComponent(trimmedTopic)}`,
    }
  }, [isTopicIndex, trimmedTopic])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 bg-[#f6f4ef] dark:bg-slate-950 text-stone-600 dark:text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-amber-700 dark:text-amber-400" />
        <p className="text-sm font-bold">読み込み中…</p>
      </div>
    )
  }

  if (isIndex || isTopicIndex) {
    return (
      <>
        <Helmet>
          <title>{topicFilterMeta?.title || INDEX_PAGE_TITLE}</title>
          <meta name="description" content={topicFilterMeta?.description || INDEX_PAGE_DESCRIPTION} />
          <link rel="canonical" href={topicFilterMeta?.canonical || `${SITE_ORIGIN}/insights`} />
          <meta property="og:title" content={topicFilterMeta?.title || INDEX_PAGE_TITLE} />
          <meta property="og:description" content={topicFilterMeta?.description || INDEX_PAGE_DESCRIPTION} />
          <meta property="og:url" content={topicFilterMeta?.canonical || `${SITE_ORIGIN}/insights`} />
          <meta name="twitter:title" content={topicFilterMeta?.title || INDEX_PAGE_TITLE} />
          <meta name="twitter:description" content={topicFilterMeta?.description || INDEX_PAGE_DESCRIPTION} />
        </Helmet>
      <div className="relative min-h-screen overflow-x-hidden bg-[#f6f4ef] dark:bg-slate-950">
        <div
          className="pointer-events-none fixed inset-0 -z-10 dark:hidden"
          style={{
            background: `
              radial-gradient(ellipse 75% 45% at 100% 0%, rgba(180, 83, 9, 0.08), transparent 52%),
              radial-gradient(ellipse 55% 40% at 0% 100%, rgba(225, 29, 72, 0.05), transparent 48%),
              linear-gradient(180deg, #f0ece4 0%, #f6f4ef 45%, #f6f4ef 100%)
            `,
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none fixed inset-0 -z-10 hidden dark:block bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950"
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <header className="relative mb-8 overflow-hidden rounded-3xl border border-stone-200/90 dark:border-slate-700/90 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-8 sm:px-8 shadow-[0_20px_50px_-28px_rgba(28,25,23,0.15)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)]">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-400/20 dark:bg-amber-500/10 blur-3xl" aria-hidden />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-black tracking-[0.26em] text-amber-800 dark:text-amber-400">MARKET INSIGHTS</p>
                <h1 className="mt-3 text-2xl sm:text-[1.75rem] font-black tracking-tight text-stone-900 dark:text-white leading-snug">
                  MoneyMart Insights｜市場・経済・テクノロジー最新インサイト
                </h1>
                {isTopicIndex ? (
                  <p className="mt-3 text-sm font-bold text-stone-600 dark:text-slate-300">
                    テーマ <span className="text-amber-800 dark:text-amber-400">{topicFilterMeta?.label}</span>
                    {' · '}
                    <Link to="/insights" className="text-amber-800 dark:text-amber-400 underline underline-offset-4">
                      全一覧へ
                    </Link>
                  </p>
                ) : null}
              </div>
              <Link
                to="/"
                className="inline-flex items-center gap-2 self-start shrink-0 rounded-full border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-bold text-stone-700 dark:text-slate-200 shadow-sm transition hover:border-amber-300 dark:hover:border-amber-600 hover:text-amber-900 dark:hover:text-amber-300"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                ホームに戻る
              </Link>
            </div>
            <div className="relative mt-6 h-px w-full bg-gradient-to-r from-amber-500/40 via-stone-200/80 to-transparent dark:from-amber-600/30 dark:via-slate-600" aria-hidden />
          </header>

          {!isLoggedIn ? (
            <div className="mb-8 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm leading-relaxed text-stone-700 dark:text-slate-300">
                <strong className="font-black text-amber-900 dark:text-amber-200">無料会員登録</strong>
                で記事の全文・図表をお読みいただけます（約1分）。
              </p>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  to="/signup"
                  state={{ from: `${location.pathname}${location.search || ''}` }}
                  className="inline-flex items-center justify-center rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs font-black text-white transition"
                >
                  無料登録
                </Link>
                <Link
                  to="/login"
                  state={{ from: `${location.pathname}${location.search || ''}` }}
                  className="inline-flex items-center justify-center rounded-xl border border-stone-300 dark:border-slate-600 px-4 py-2.5 text-xs font-black text-stone-800 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition"
                >
                  ログイン
                </Link>
              </div>
            </div>
          ) : null}

          {listRows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 dark:border-slate-600 bg-white/60 dark:bg-slate-900/60 p-10 text-center text-stone-600 dark:text-slate-300">
              <p className="text-sm font-bold">公開中の記事がまだありません。</p>
            </div>
          ) : (
            <>
              <div
                className="mx-auto flex w-full max-w-5xl flex-wrap justify-center gap-4 px-0 pb-3 pt-1 sm:gap-5"
                role="region"
                aria-label="インサイト記事一覧"
              >
                {pagedIndexRows.map((item, idx) => {
                  const coverUrl = getInsightCoverUrl(item)
                  const globalIdx = (listPage - 1) * INSIGHT_INDEX_PAGE_SIZE + idx
                  const catLabel = getInsightCategoryLabel(item)
                  const catTheme = getInsightCategoryTheme(catLabel)
                  return (
                  <Link
                    key={item.id || item.slug}
                    to={`/insights/${item.slug}`}
                    state={insightsFromListState}
                    className={`group relative flex w-full max-w-[280px] flex-col overflow-hidden rounded-2xl border transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 min-h-[240px] ${
                      globalIdx === 0
                        ? `${catTheme.listCardClass} shadow-md hover:shadow-lg`
                        : catTheme.listCardClass
                    }`}
                  >
                    {coverUrl ? (
                      <div className="relative h-28 w-full shrink-0 overflow-hidden bg-stone-200 dark:bg-slate-800">
                        <img
                          src={coverUrl}
                          alt=""
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : null}
                    {globalIdx === 0 ? (
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${catTheme.listAccentClass}`} aria-hidden />
                    ) : (
                      <div
                        className="absolute left-0 top-4 bottom-4 w-1 rounded-full overflow-hidden bg-stone-200 dark:bg-slate-700 transition-all group-hover:w-1.5"
                        aria-hidden
                      >
                        <div className={`absolute inset-0 bg-gradient-to-b ${catTheme.listAccentClass} opacity-0 group-hover:opacity-100 transition-opacity`} />
                      </div>
                    )}
                    <div className={`relative flex flex-1 flex-col p-5 ${globalIdx === 0 ? 'pl-6' : 'pl-5'}`}>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] mb-2.5">
                        {globalIdx === 0 ? (
                          <span className={`rounded-full border px-2 py-0.5 font-black ${catTheme.listBadgeClass}`}>
                            LATEST
                          </span>
                        ) : null}
                        <span className={`rounded-full border px-2 py-0.5 font-black ${catTheme.listBadgeClass}`}>
                          {catTheme.displayLabel}
                        </span>
                        <span className="font-bold tracking-[0.16em] text-stone-500 dark:text-slate-400">
                          {formatDate(item.publishedAt || item.updatedAt)}
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-black leading-snug tracking-tight text-stone-900 dark:text-white group-hover:text-amber-900 dark:group-hover:text-amber-300 transition-colors line-clamp-4">
                        {item.pageTitle || '無題'}
                      </h2>
                      {!isLoggedIn ? (
                        <div className="mt-2 flex-1 min-h-[2.75rem] space-y-2 select-none" aria-hidden>
                          <div className="h-3 w-full rounded-md bg-stone-300/90 dark:bg-slate-600 blur-[4px]" />
                          <div className="h-3 w-[88%] rounded-md bg-stone-300/90 dark:bg-slate-600 blur-[4px]" />
                        </div>
                      ) : (
                        <p className="mt-2 flex-1 line-clamp-4 text-xs sm:text-[13px] leading-relaxed text-stone-600 dark:text-slate-300">
                          {buildPreviewText(item)}
                        </p>
                      )}
                      <p className="mt-4 text-[11px] font-black text-amber-800 dark:text-amber-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                        続きを読む <span aria-hidden>→</span>
                      </p>
                    </div>
                  </Link>
                  )
                })}
              </div>

              {indexTotalPages > 1 ? (
                <nav
                  className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-2 rounded-2xl border border-stone-200/90 dark:border-slate-700/90 bg-white/70 dark:bg-slate-900/70 px-4 py-4 shadow-sm"
                  aria-label="記事一覧のページ"
                >
                  <p className="text-sm font-black text-stone-800 dark:text-slate-100 tabular-nums shrink-0">
                    <span className="text-stone-500 dark:text-slate-400 font-bold">ページ</span>{' '}
                    <span className="text-amber-800 dark:text-amber-300">{listPage}</span>
                    <span className="text-stone-400 dark:text-slate-500 mx-1">/</span>
                    <span>{indexTotalPages}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      disabled={listPage <= 1}
                      onClick={() => goToInsightsListPage(listPage - 1)}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs sm:text-sm font-bold text-stone-700 dark:text-slate-200 transition enabled:hover:border-amber-400 dark:enabled:hover:border-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      前へ
                    </button>
                    {(indexTotalPages <= 12
                      ? Array.from({ length: indexTotalPages }, (_, i) => i + 1)
                      : [1, 2, 3].includes(listPage)
                        ? [1, 2, 3, 4, '…', indexTotalPages]
                        : [indexTotalPages - 2, indexTotalPages - 1, indexTotalPages].includes(listPage)
                          ? [1, '…', indexTotalPages - 3, indexTotalPages - 2, indexTotalPages - 1, indexTotalPages]
                          : [1, '…', listPage - 1, listPage, listPage + 1, '…', indexTotalPages]
                    ).map((n, ni) =>
                      n === '…' ? (
                        <span key={`e-${ni}`} className="px-0.5 text-stone-400 dark:text-slate-500 font-bold text-sm" aria-hidden>
                          …
                        </span>
                      ) : (
                        <button
                          key={n}
                          type="button"
                          onClick={() => goToInsightsListPage(n)}
                          aria-current={n === listPage ? 'page' : undefined}
                          className={`inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border px-2.5 py-1.5 text-sm font-black transition ${
                            n === listPage
                              ? 'border-amber-500 bg-amber-100 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200'
                              : 'border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-stone-700 dark:text-slate-200 hover:border-amber-400 dark:hover:border-amber-600'
                          }`}
                        >
                          {n}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      disabled={listPage >= indexTotalPages}
                      onClick={() => goToInsightsListPage(listPage + 1)}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs sm:text-sm font-bold text-stone-700 dark:text-slate-200 transition enabled:hover:border-amber-400 dark:enabled:hover:border-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      次へ
                    </button>
                  </div>
                </nav>
              ) : null}

              <section
                id="insights-all-articles"
                className="mx-auto max-w-5xl mt-12 px-2 scroll-mt-24"
                aria-labelledby="insights-archive-heading"
              >
                <div className="rounded-3xl border border-stone-200/95 dark:border-slate-700/90 bg-white/85 dark:bg-slate-900/75 px-5 py-6 sm:px-7 sm:py-8 shadow-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                    <h2
                      id="insights-archive-heading"
                      className="text-lg sm:text-xl font-black tracking-tight text-stone-900 dark:text-white"
                    >
                      全記事一覧
                    </h2>
                    {!isTopicIndex ? (
                      <p className="text-[11px] font-semibold text-stone-500 dark:text-slate-400">
                        {archiveRows.length >= 80
                          ? '新しい順に表示しています（直近80件まで）。'
                          : `全${archiveRows.length}件`}
                      </p>
                    ) : (
                      <p className="text-[11px] font-semibold text-stone-500 dark:text-slate-400">
                        テーマ「{topicFilterMeta?.label?.replace(/^#/, '') || trimmedTopic}」に該当する記事のみ
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-medium text-stone-600 dark:text-slate-400 leading-relaxed">
                    タグをクリックすると、そのテーマの記事一覧に絞り込めます。
                  </p>

                  <ul className="mt-5 divide-y divide-stone-200/95 dark:divide-slate-700/80 border-t border-b border-stone-200/95 dark:border-slate-700/80">
                    {archiveRows.map((item) => {
                      const slug = String(item.slug || '').trim()
                      if (!slug) return null
                      const topicMeta = primaryTopicMetaForArticle(item)
                      const catFallback = getInsightCategoryLabel(item)
                      return (
                        <li key={item.id || slug}>
                          <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4 sm:py-3.5">
                            <div className="min-w-0 flex-1">
                              <Link
                                to={`/insights/${slug}`}
                                state={insightsFromListState}
                                className="block w-full truncate text-sm sm:text-[15px] font-bold text-stone-900 dark:text-slate-100 leading-snug hover:text-amber-800 dark:hover:text-amber-300 underline-offset-2 hover:underline"
                                title={item.pageTitle ? String(item.pageTitle) : undefined}
                              >
                                {item.pageTitle || '無題'}
                              </Link>
                              <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-stone-400 dark:text-slate-500">
                                {formatDate(item.publishedAt || item.updatedAt)}
                              </p>
                            </div>
                            <div className="shrink-0 flex flex-wrap gap-2 sm:justify-end">
                              {topicMeta ? (
                                <Link
                                  to={`/insights/category/${encodeURIComponent(topicMeta.key)}`}
                                  className="inline-flex rounded-full border border-stone-200 dark:border-slate-600 bg-stone-50 dark:bg-slate-800/80 px-2.5 py-1 text-[10px] sm:text-[11px] font-black text-amber-900 dark:text-amber-200 transition hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  title={`「${topicMeta.label.replace(/^#/, '')}」で絞り込む`}
                                >
                                  {topicMeta.label}
                                </Link>
                              ) : (
                                <span className="inline-flex rounded-full border border-stone-200/80 dark:border-slate-600/80 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-stone-500 dark:text-slate-400">
                                  {catFallback}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  {!isTopicIndex ? null : (
                    <p className="mt-5 text-center text-xs font-bold">
                      <Link to="/insights" className="text-amber-800 dark:text-amber-400 underline underline-offset-4">
                        全テーマを表示（トップ一覧へ）
                      </Link>
                    </p>
                  )}
                </div>
              </section>

              <nav className="mx-auto max-w-5xl mt-10 px-2 pb-2" aria-label="テーマタグ">
                <p className="text-[11px] font-black tracking-[0.22em] text-amber-800 dark:text-amber-400 mb-3 text-center">
                  THEMES
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {INSIGHT_TOPIC_FILTERS.map(({ key, label }) => (
                    <Link
                      key={key}
                      to={`/insights/category/${key}`}
                      className={`rounded-full border px-3 py-1.5 text-[11px] sm:text-xs font-black transition ${
                        isTopicIndex && trimmedTopic === key
                          ? 'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-600'
                          : 'border-stone-200 dark:border-slate-600 bg-white/90 dark:bg-slate-900 text-stone-700 dark:text-slate-200 hover:border-amber-300 dark:hover:border-amber-600'
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </nav>

              <footer className="mt-12 border-t border-stone-200/80 dark:border-slate-700/80 pt-8 pb-4 text-center">
                <p className="text-[11px] leading-relaxed text-stone-500 dark:text-slate-400 max-w-lg mx-auto">
                  インサイトの記事・構成・ビジュアルは MoneyMart が独自に編集・提供するものです。本コンテンツは情報提供を目的としており、投資助言ではありません。
                </p>
                <p className="mt-3 text-[11px] leading-relaxed text-stone-500 dark:text-slate-400 max-w-lg mx-auto">
                  <Link to="/legal/methodology" className="font-bold underline underline-offset-2">編集・データ方針</Link>
                  ／ 訂正のご連絡は
                  <a href="mailto:support@moneymart.co.jp" className="font-bold underline underline-offset-2"> support@moneymart.co.jp</a>
                </p>
                <p className="mt-3 text-[10px] font-semibold text-stone-400 dark:text-slate-500">
                  © MoneyMart
                </p>
              </footer>
            </>
          )}
        </div>
      </div>
      </>
    )
  }

  if (notFound) {
    const returnPath = `${location.pathname}${location.search || ''}`
    if (!isLoggedIn) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-5 bg-[#f6f4ef] dark:bg-slate-950 text-stone-800 dark:text-slate-200 px-6 text-center">
          <p className="text-xl font-extrabold tracking-tight text-stone-900 dark:text-white">この記事は無料会員向けです</p>
          <p className="text-sm text-stone-600 dark:text-slate-400 max-w-md leading-relaxed">
            公開中の記事であれば、無料登録後に全文をお読みいただけます。一覧から別の記事をお試しください。
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Link
              to="/signup"
              state={{ from: returnPath }}
              className="inline-flex items-center justify-center rounded-xl bg-amber-600 hover:bg-amber-700 px-5 py-3 text-sm font-black text-white transition"
            >
              無料で登録する
            </Link>
            <Link
              to="/login"
              state={{ from: returnPath }}
              className="inline-flex items-center justify-center rounded-xl border border-stone-300 dark:border-slate-600 px-5 py-3 text-sm font-black text-stone-800 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition"
            >
              ログイン
            </Link>
          </div>
          <Link to="/insights" className="text-sm font-bold text-amber-800 dark:text-amber-400 underline underline-offset-4">
            インサイト一覧へ
          </Link>
        </div>
      )
    }
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 bg-[#f6f4ef] dark:bg-slate-950 text-stone-800 dark:text-slate-200 px-6 text-center">
        <p className="text-xl font-extrabold tracking-tight text-stone-900 dark:text-white">記事が見つかりません</p>
        <p className="text-sm text-stone-600 dark:text-slate-400 max-w-md">URLのスラッグが誤っているか、未公開の可能性があります。</p>
        <Link to="/insights" className="text-sm font-bold text-amber-800 dark:text-amber-400 underline underline-offset-4">
          インサイト一覧へ
        </Link>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 bg-[#f6f4ef] dark:bg-slate-950 text-stone-600 dark:text-slate-400 px-6 text-center">
        <p className="text-sm font-bold">表示できる記事がありません。</p>
        <Link to="/" className="text-sm font-bold text-amber-800 dark:text-amber-400 underline underline-offset-4">ホームへ</Link>
      </div>
    )
  }

  const navIdx = navList.findIndex((r) => String(r?.slug || '') === String(row?.slug || ''))
  /** 一覧は新しい順：index が小さいほど新着 */
  const newerPost = navIdx > 0 ? navList[navIdx - 1] : null
  const olderPost = navIdx >= 0 && navIdx < navList.length - 1 ? navList[navIdx + 1] : null
  const relatedPick = navList.filter((r) => String(r?.slug) !== String(row?.slug)).slice(0, 2)

  const articleDesc =
    buildPreviewText(row).replace(/\s+/g, ' ').trim().slice(0, 160) || 'MoneyMartの投資インサイト記事です。'
  const articleOgImage = resolveInsightOgImageUrl(row) || `${SITE_ORIGIN}/icon.png`
  const articleCanonical = `${SITE_ORIGIN}/insights/${String(row.slug || '').trim()}`
  const insightShare = buildInsightShareTargets(row.pageTitle, articleCanonical)
  const listBackHref = buildInsightsListHref(location.state?.insightsListReturn)
  const insightNavState = location.state?.insightsListReturn ? { insightsListReturn: location.state.insightsListReturn } : undefined

  const handleCopyInsightLink = async () => {
    const ok = await copyTextToClipboard(insightShare.copyUrl || articleCanonical)
    if (ok) {
      setInsightLinkCopied(true)
      if (insightLinkCopyTimerRef.current) window.clearTimeout(insightLinkCopyTimerRef.current)
      insightLinkCopyTimerRef.current = window.setTimeout(() => {
        setInsightLinkCopied(false)
        insightLinkCopyTimerRef.current = null
      }, 2200)
    } else {
      window.alert('リンクをコピーできませんでした。ブラウザの設定をご確認ください。')
    }
  }

  const articleTheme = getInsightCategoryThemeFromDocument(row?.document || {})

  return (
    <>
      <Helmet>
        <title>{`${row.pageTitle} | MoneyMart`}</title>
        <meta name="description" content={articleDesc} />
        <link rel="canonical" href={articleCanonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={`${row.pageTitle} | MoneyMart`} />
        <meta property="og:description" content={articleDesc} />
        <meta property="og:url" content={articleCanonical} />
        <meta property="og:image" content={articleOgImage} />
        <meta property="og:image:secure_url" content={articleOgImage} />
        <meta property="og:image:alt" content={`${row.pageTitle} | MoneyMart`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${row.pageTitle} | MoneyMart`} />
        <meta name="twitter:description" content={articleDesc} />
        <meta name="twitter:image" content={articleOgImage} />
        <script type="application/ld+json">
          {JSON.stringify(articleJsonLd(SITE_ORIGIN, {
            headline: row.pageTitle,
            description: articleDesc,
            url: articleCanonical,
            datePublished: row.publishedAt || undefined,
            dateModified: row.updatedAt || row.publishedAt || undefined,
            image: articleOgImage,
          }))}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbListJsonLd(SITE_ORIGIN, [
            { name: 'ホーム', path: '/' },
            { name: 'インサイト', path: '/insights' },
            { name: row.pageTitle, path: `/insights/${String(row.slug || '').trim()}` },
          ]))}
        </script>
      </Helmet>
    <div className={`relative ${articleTheme.pageShellClass}`}>
      <div className={`sticky top-0 z-20 border-b backdrop-blur-md supports-[backdrop-filter]:bg-opacity-80 ${articleTheme.stickyBarClass}`}>
        <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6 lg:px-8">
          <Link
            to={listBackHref}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-bold text-stone-700 dark:text-slate-200 shadow-sm transition hover:border-amber-200 dark:hover:border-amber-600 hover:text-amber-900 dark:hover:text-amber-300"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            一覧に戻る
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-3xl lg:max-w-4xl px-5 sm:px-6 lg:px-8 pt-4 text-xs text-stone-500 dark:text-slate-400">
        <p>
          <span className="font-bold text-stone-700 dark:text-slate-200">{EDITORIAL_AUTHOR_NAME}</span>
          {' · '}公開 {formatDate(row.publishedAt)}
          {row.updatedAt ? ` · 更新 ${formatDate(row.updatedAt)}` : ''}
          {' · '}
          <Link to="/legal/methodology" className="font-bold text-amber-800 dark:text-amber-400 underline underline-offset-2">
            編集・データ方針
          </Link>
        </p>
      </div>
      <InsightArticleSoftGate
        isLoggedIn={isLoggedIn}
        compact={!isLoggedIn}
        returnPath={`${location.pathname}${location.search || ''}`}
      >
        <InsightArticleView
          document={row?.document || {}}
          pageTitle={row?.pageTitle || ''}
          lockedPreview={!isLoggedIn}
        />
      </InsightArticleSoftGate>

      <div className="border-t border-stone-200/90 dark:border-slate-800/90 bg-gradient-to-b from-[#f0ece6]/95 to-[#ebe6dc]/90 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
          <section aria-labelledby="insight-share-heading" className="rounded-2xl border border-stone-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-5 py-5 shadow-sm">
            <h2 id="insight-share-heading" className="text-[11px] font-black tracking-[0.2em] text-amber-800 dark:text-amber-400 uppercase mb-3">
              この記事をシェア
            </h2>
            <p className="text-xs text-stone-500 dark:text-slate-400 mb-4 leading-relaxed">
              X（旧Twitter）・LINE・メールでリンクを共有できます。リンクをコピーしてお好みのアプリで共有することもできます。
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <a
                href={insightShare.xHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-800 dark:border-stone-100 bg-stone-900 text-white dark:bg-white dark:text-stone-900 px-4 py-2.5 text-sm font-bold hover:opacity-90 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 min-h-[44px]"
              >
                <IconXLogo size={17} className="shrink-0" />
                X でポスト
              </a>
              <a
                href={insightShare.lineHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#06C755] text-white px-4 py-2.5 text-sm font-bold hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 min-h-[44px]"
              >
                LINEで送る
              </a>
              <a
                href={insightShare.mailHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-stone-800 dark:text-slate-100 px-4 py-2.5 text-sm font-bold hover:border-amber-300 dark:hover:border-amber-600 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 min-h-[44px]"
              >
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                メールで送る
              </a>
              <button
                type="button"
                onClick={() => void handleCopyInsightLink()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-stone-800 dark:text-slate-100 px-4 py-2.5 text-sm font-bold hover:border-amber-300 dark:hover:border-amber-600 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 min-h-[44px]"
                aria-live="polite"
              >
                <Copy className="h-4 w-4 shrink-0" aria-hidden />
                {insightLinkCopied ? 'コピーしました！' : 'リンクをコピー'}
              </button>
            </div>
          </section>

          <nav className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6" aria-label="前後の記事">
            <div className="min-h-[5.5rem]">
              {olderPost ? (
                <Link
                  to={`/insights/${olderPost.slug}`}
                  state={insightNavState}
                  className="group flex h-full flex-col justify-center rounded-2xl border border-stone-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 p-5 shadow-sm transition hover:border-amber-300/80 dark:hover:border-amber-700/50 hover:shadow-md"
                >
                  <span className="text-[11px] font-black tracking-[0.18em] text-stone-500 dark:text-slate-400 uppercase mb-1.5">
                    ← 前の記事（過去）
                  </span>
                  <span className="text-sm sm:text-base font-bold text-stone-900 dark:text-white leading-snug group-hover:text-amber-900 dark:group-hover:text-amber-300">
                    {truncateTitle(olderPost.pageTitle, 64)}
                  </span>
                </Link>
              ) : (
                <div className="flex h-full min-h-[5.5rem] items-center rounded-2xl border border-dashed border-stone-300/80 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 px-5 text-sm text-stone-400 dark:text-slate-500">
                  これより過去の記事はありません
                </div>
              )}
            </div>
            <div className="min-h-[5.5rem] sm:text-right">
              {newerPost ? (
                <Link
                  to={`/insights/${newerPost.slug}`}
                  state={insightNavState}
                  className="group flex h-full flex-col justify-center rounded-2xl border border-stone-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 p-5 shadow-sm transition hover:border-amber-300/80 dark:hover:border-amber-700/50 hover:shadow-md sm:items-end sm:text-right"
                >
                  <span className="text-[11px] font-black tracking-[0.18em] text-stone-500 dark:text-slate-400 uppercase mb-1.5">
                    次の記事（新着）→
                  </span>
                  <span className="text-sm sm:text-base font-bold text-stone-900 dark:text-white leading-snug group-hover:text-amber-900 dark:group-hover:text-amber-300">
                    {truncateTitle(newerPost.pageTitle, 64)}
                  </span>
                </Link>
              ) : (
                <div className="flex h-full min-h-[5.5rem] items-center justify-end rounded-2xl border border-dashed border-stone-300/80 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 px-5 text-sm text-stone-400 dark:text-slate-500 sm:text-right">
                  これより新しい記事はありません
                </div>
              )}
            </div>
          </nav>

          <section aria-labelledby="insight-tools-cta" className="rounded-2xl border border-amber-200/80 dark:border-amber-800/40 bg-white/90 dark:bg-slate-900/90 px-5 py-5">
            <h2 id="insight-tools-cta" className="text-[11px] font-black tracking-[0.2em] text-amber-800 dark:text-amber-400 uppercase mb-3">
              関連ツールで確認する
            </h2>
            <p className="text-xs text-stone-500 dark:text-slate-400 mb-4 leading-relaxed">
              記事の論点を、保有の重複やNISA・配当の記録と突き合わせて整理できます。
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/etf-compare" className="inline-flex rounded-xl bg-amber-600 text-white px-4 py-2.5 text-sm font-black hover:bg-amber-700">ETFを比較する</Link>
              <Link to="/tools/nisa-etf-checklist" className="inline-flex rounded-xl border border-stone-300 dark:border-slate-600 px-4 py-2.5 text-sm font-black">NISAの確認項目</Link>
              <Link to="/dividend-calendar" className="inline-flex rounded-xl border border-stone-300 dark:border-slate-600 px-4 py-2.5 text-sm font-black">配当予定を見る</Link>
            </div>
          </section>

          {relatedPick.length > 0 ? (
            <section aria-labelledby="insight-related-heading">
              <div className="mb-4 flex items-center gap-3">
                <h2 id="insight-related-heading" className="text-xs font-black tracking-[0.2em] text-amber-800 dark:text-amber-400 uppercase shrink-0">
                  関連インサイト
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-amber-400/50 to-transparent dark:from-amber-600/35" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                {relatedPick.map((item) => {
                  const rt = getReadTimeLabel(item)
                  const relTheme = getInsightCategoryTheme(getInsightCategoryLabel(item))
                  return (
                    <Link
                      key={item.id || item.slug}
                      to={`/insights/${item.slug}`}
                      state={insightNavState}
                      className={`group rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${relTheme.listCardClass}`}
                    >
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black ${relTheme.relatedBadgeClass}`}>
                        {getInsightCategoryLabel(item)}
                      </span>
                      <h3 className="mt-3 text-base font-black leading-snug text-stone-900 dark:text-white group-hover:text-amber-900 dark:group-hover:text-amber-300">
                        {item.pageTitle || '無題'}
                      </h3>
                      <p className="mt-3 text-xs text-stone-500 dark:text-slate-400">
                        {formatDate(item.publishedAt || item.updatedAt)}
                        {rt ? ` · ${rt}` : ''}
                      </p>
                    </Link>
                  )
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
    </>
  )
}
