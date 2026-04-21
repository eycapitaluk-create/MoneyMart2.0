import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import InsightArticleView from '../components/insights/InsightArticleView'
import { fetchInsightBySlug, fetchPublishedInsights } from '../lib/insightApi'
import { looksLikeInsightHtml, plainTextFromInsightHtml } from '../lib/insightHtml'

function formatDate(dateText) {
  if (!dateText) return '日付未設定'
  const d = new Date(dateText)
  if (Number.isNaN(d.getTime())) return String(dateText).slice(0, 10)
  return d.toLocaleDateString('ja-JP')
}

function buildPreviewText(row) {
  const doc = row?.document || {}
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

function truncateTitle(s, max = 56) {
  const t = String(s || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** 一覧1ページあたりの件数 */
const INSIGHT_INDEX_PAGE_SIZE = 3
const SITE_ORIGIN = 'https://www.moneymart.co.jp'

function upsertMetaTag(attrName, attrValue, content) {
  if (!attrValue) return
  const selector = `meta[${attrName}="${attrValue}"]`
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute('content', String(content || ''))
}

function upsertCanonicalHref(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export default function InsightPage() {
  const { slug } = useParams()
  const [row, setRow] = useState(null)
  const [rows, setRows] = useState([])
  const [listPage, setListPage] = useState(1)
  /** 記事ページ用：一覧と同じ並び（新しい順）で前後記事を決める */
  const [navList, setNavList] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const trimmedSlug = String(slug ?? '').trim()
  const isIndex = !trimmedSlug

  const indexTotalPages = Math.max(1, Math.ceil(rows.length / INSIGHT_INDEX_PAGE_SIZE))
  const pagedIndexRows = useMemo(() => {
    const start = (listPage - 1) * INSIGHT_INDEX_PAGE_SIZE
    return rows.slice(start, start + INSIGHT_INDEX_PAGE_SIZE)
  }, [rows, listPage])

  useEffect(() => {
    if (!isIndex) return
    setListPage((p) => Math.min(Math.max(1, p), indexTotalPages))
  }, [isIndex, indexTotalPages])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setNotFound(false)
    setRow(null)
    setRows([])
    setNavList([])

    const run = async () => {
      try {
        if (isIndex) {
          const list = await fetchPublishedInsights(80)
          if (!alive) return
          setRows(list)
          return
        }

        const [data, list] = await Promise.all([
          fetchInsightBySlug(trimmedSlug),
          fetchPublishedInsights(80),
        ])
        if (!alive) return
        setNavList(Array.isArray(list) ? list : [])
        if (data) {
          setRow(data)
          setNotFound(false)
        } else {
          setNotFound(true)
        }
      } catch (e) {
        if (!alive) return
        console.warn(e)
        if (isIndex) setRows([])
        else setNotFound(true)
      } finally {
        if (alive) setLoading(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [isIndex, trimmedSlug])

  useEffect(() => {
    const pathname = window.location.pathname || '/insights'
    const canonical = `${SITE_ORIGIN}${pathname}`
    const title = isIndex
      ? 'インサイト一覧 | MoneyMart'
      : row?.pageTitle
        ? `${row.pageTitle} | MoneyMart`
        : 'インサイト | MoneyMart'
    const description = isIndex
      ? 'MoneyMartの投資インサイト記事一覧。マーケット分析、ETF・株式の注目テーマ、投資判断に役立つ解説を掲載しています。'
      : (() => {
          const text = buildPreviewText(row || {}).replace(/\s+/g, ' ').trim()
          return text ? text.slice(0, 140) : 'MoneyMartの投資インサイト記事です。'
        })()

    document.title = title
    upsertCanonicalHref(canonical)
    upsertMetaTag('name', 'description', description)
    upsertMetaTag('property', 'og:title', title)
    upsertMetaTag('property', 'og:description', description)
    upsertMetaTag('property', 'og:url', canonical)
    upsertMetaTag('name', 'twitter:title', title)
    upsertMetaTag('name', 'twitter:description', description)
  }, [isIndex, row])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 bg-[#f6f4ef] dark:bg-slate-950 text-stone-600 dark:text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-amber-700 dark:text-amber-400" />
        <p className="text-sm font-bold">読み込み中…</p>
      </div>
    )
  }

  if (isIndex) {
    return (
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
                <h1 className="mt-3 text-3xl sm:text-[2.1rem] font-black tracking-tight text-stone-900 dark:text-white leading-tight">
                  インサイト一覧
                </h1>
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

          {rows.length === 0 ? (
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
                  return (
                  <Link
                    key={item.id || item.slug}
                    to={`/insights/${item.slug}`}
                    className={`group relative flex w-full max-w-[280px] flex-col overflow-hidden rounded-2xl border transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 min-h-[240px] ${
                      globalIdx === 0
                        ? 'border-amber-200/90 dark:border-amber-800/50 bg-white dark:bg-slate-900 shadow-md hover:shadow-lg'
                        : 'border-stone-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-sm hover:shadow-md hover:border-amber-200/70 dark:hover:border-amber-800/40'
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
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 via-orange-400 to-amber-600" aria-hidden />
                    ) : (
                      <div
                        className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-stone-200 dark:bg-slate-700 group-hover:bg-gradient-to-b group-hover:from-amber-400 group-hover:to-orange-400 transition-colors"
                        aria-hidden
                      />
                    )}
                    <div className={`relative flex flex-1 flex-col p-5 ${globalIdx === 0 ? 'pl-6' : 'pl-5'}`}>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] mb-2.5">
                        {globalIdx === 0 ? (
                          <span className="rounded-full border border-amber-300/80 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 font-black text-amber-900 dark:text-amber-200">
                            LATEST
                          </span>
                        ) : null}
                        <span className="font-bold tracking-[0.16em] text-stone-500 dark:text-slate-400">
                          {formatDate(item.publishedAt || item.updatedAt)}
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-black leading-snug tracking-tight text-stone-900 dark:text-white group-hover:text-amber-900 dark:group-hover:text-amber-300 transition-colors line-clamp-4">
                        {item.pageTitle || '無題'}
                      </h2>
                      <p className="mt-2 flex-1 line-clamp-4 text-xs sm:text-[13px] leading-relaxed text-stone-600 dark:text-slate-300">
                        {buildPreviewText(item)}
                      </p>
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
                      onClick={() => setListPage((p) => Math.max(1, p - 1))}
                      className="min-h-[38px] rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs sm:text-sm font-bold text-stone-700 dark:text-slate-200 transition enabled:hover:border-amber-400 dark:enabled:hover:border-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
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
                          onClick={() => setListPage(n)}
                          aria-current={n === listPage ? 'page' : undefined}
                          className={`min-h-[38px] min-w-[38px] rounded-lg border px-2.5 py-1.5 text-sm font-black transition ${
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
                      onClick={() => setListPage((p) => Math.min(indexTotalPages, p + 1))}
                      className="min-h-[38px] rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs sm:text-sm font-bold text-stone-700 dark:text-slate-200 transition enabled:hover:border-amber-400 dark:enabled:hover:border-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      次へ
                    </button>
                  </div>
                </nav>
              ) : null}

              <footer className="mt-12 border-t border-stone-200/80 dark:border-slate-700/80 pt-8 pb-4 text-center">
                <p className="text-[11px] leading-relaxed text-stone-500 dark:text-slate-400 max-w-lg mx-auto">
                  インサイトの記事・構成・ビジュアルは MoneyMart が独自に編集・提供するものです。本コンテンツは情報提供を目的としており、投資助言ではありません。
                </p>
                <p className="mt-3 text-[11px] leading-relaxed text-stone-500 dark:text-slate-400 max-w-lg mx-auto">
                  本コンテンツの著作権は MoneyMart（運営：MoneyLab Ltd.）に帰属します。無断での転載・複製・配布・改変を禁じます。一部記事の作成にAIを活用している場合があります。すべての記事は編集チームが内容を確認しています。
                </p>
                <p className="mt-3 text-[10px] font-semibold text-stone-400 dark:text-slate-500">
                  © MoneyMart
                </p>
              </footer>
            </>
          )}
        </div>
      </div>
    )
  }

  if (notFound) {
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

  return (
    <div className="relative bg-[#f6f4ef] dark:bg-slate-950">
      <div className="sticky top-0 z-20 border-b border-stone-200/90 dark:border-slate-700/90 bg-[#f6f4ef]/90 dark:bg-slate-950/90 backdrop-blur-md supports-[backdrop-filter]:bg-[#f6f4ef]/80 dark:supports-[backdrop-filter]:bg-slate-950/80">
        <div className="mx-auto max-w-5xl px-4 py-2 sm:px-6 lg:px-8">
          <Link
            to="/insights"
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-bold text-stone-700 dark:text-slate-200 shadow-sm transition hover:border-amber-200 dark:hover:border-amber-600 hover:text-amber-900 dark:hover:text-amber-300"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            一覧に戻る
          </Link>
        </div>
      </div>
      <InsightArticleView document={row?.document || {}} />

      <div className="border-t border-stone-200/90 dark:border-slate-800/90 bg-gradient-to-b from-[#f0ece6]/95 to-[#ebe6dc]/90 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
          <nav className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6" aria-label="前後の記事">
            <div className="min-h-[5.5rem]">
              {olderPost ? (
                <Link
                  to={`/insights/${olderPost.slug}`}
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
                  return (
                    <Link
                      key={item.id || item.slug}
                      to={`/insights/${item.slug}`}
                      className="group rounded-2xl border border-stone-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:border-amber-200/90 dark:hover:border-amber-800/50 hover:shadow-md"
                    >
                      <span className="inline-block rounded-md bg-amber-100/90 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-black text-amber-900 dark:text-amber-200">
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
  )
}
