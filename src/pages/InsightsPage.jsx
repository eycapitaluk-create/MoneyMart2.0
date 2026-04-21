import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { SITE_ORIGIN } from '../lib/seoConfig'
import { INSIGHTS } from '../data/insightsEditorial'
import { fetchPublishedInsights } from '../lib/insightsApi'
import { isEmptyInsightBodyHtml, looksLikeInsightHtml, sanitizeInsightBodyHtml } from '../lib/insightHtml'
import InsightToolPill from '../components/insights/InsightToolPill'

function DataMetric({ label, value, note }) {
  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/80 bg-white/60 dark:bg-slate-800/40 px-4 py-3.5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
        <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">{value}</p>
        {note ? <p className="text-[11px] text-slate-500 dark:text-slate-400">{note}</p> : null}
      </div>
    </div>
  )
}

function InsightTextBlock({ text, className = '' }) {
  const raw = String(text || '')
  const normalized = raw.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return null

  if (looksLikeInsightHtml(normalized)) {
    if (isEmptyInsightBodyHtml(normalized)) return null
    const html = sanitizeInsightBodyHtml(normalized)
    if (!html.trim()) return null
    return (
      <div
        className={`insight-body-html ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  return (
    <div className={className}>
      {paragraphs.map((paragraph, idx) => (
        <p key={`${paragraph.slice(0, 24)}-${idx}`} className="mb-3 last:mb-0 whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

function FeaturedCard({ insight, onClick }) {
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="group relative w-full text-left overflow-hidden rounded-3xl border border-orange-200/70 dark:border-orange-800/50 bg-white dark:bg-slate-900 shadow-[0_20px_50px_-24px_rgba(234,88,12,0.35)] dark:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)] transition duration-300 hover:shadow-[0_28px_60px_-20px_rgba(234,88,12,0.45)] hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
    >
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-orange-400/25 via-amber-300/15 to-transparent blur-2xl dark:from-orange-500/20"
        aria-hidden
      />
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-500 via-amber-400 to-orange-600 rounded-l-3xl" aria-hidden />
      <div className="relative p-6 md:p-8 pl-7 md:pl-9">
        <div className="flex flex-wrap items-center gap-2 text-[11px] mb-4">
          <span className="px-2.5 py-1 rounded-full border border-orange-300/80 dark:border-orange-700/80 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/30 text-orange-800 dark:text-orange-200 font-black tracking-wide shadow-sm">
            FEATURED
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200/80 dark:border-slate-700">
            {insight.category}
          </span>
          <span className="text-slate-500 dark:text-slate-400 font-medium">{insight.date}</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-slate-500 dark:text-slate-400">{insight.readTime}</span>
        </div>
        <h2 className="text-2xl md:text-[1.75rem] font-black text-slate-900 dark:text-white leading-[1.2] tracking-tight group-hover:text-orange-700 dark:group-hover:text-orange-200 transition-colors">
          {insight.headline}
        </h2>
        <InsightTextBlock text={insight.summary} className="mt-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl" />
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {insight.relatedTools.map((tool) => <InsightToolPill key={`${insight.id}-${tool}`} name={tool} />)}
        </div>
        <p className="mt-5 text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1 opacity-90 group-hover:gap-2 transition-all">
          記事を読む <span aria-hidden>→</span>
        </p>
      </div>
    </article>
  )
}

function ArticleCard({ insight, onClick }) {
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="group relative w-full text-left rounded-2xl border border-slate-200/90 dark:border-slate-700/90 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm pl-5 pr-5 py-5 shadow-sm hover:shadow-lg hover:border-orange-200/80 dark:hover:border-orange-800/50 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
    >
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-gradient-to-b from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800 group-hover:from-orange-400 group-hover:to-amber-400 transition-colors"
        aria-hidden
      />
      <div className="pl-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] mb-2.5">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200/80 dark:border-slate-600/80">
            {insight.category}
          </span>
          <span className="text-slate-500 dark:text-slate-400">{insight.date}</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-slate-500 dark:text-slate-400">{insight.readTime}</span>
        </div>
        <h3 className="text-[17px] font-black text-slate-900 dark:text-white leading-snug group-hover:text-orange-700 dark:group-hover:text-orange-200 transition-colors">
          {insight.headline}
        </h3>
        <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed whitespace-pre-line">
          {insight.summary}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <InsightToolPill name={insight.relatedTools[0]} compact />
          <span className="text-xs font-bold text-orange-600/90 dark:text-orange-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity max-sm:opacity-100">
            読む →
          </span>
        </div>
      </div>
    </article>
  )
}

function SectionLabel({ children, tone = 'slate' }) {
  const tones = {
    emerald: 'text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30',
    blue: 'text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60 bg-blue-50/80 dark:bg-blue-950/30',
    slate: 'text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-600/60 bg-slate-100/80 dark:bg-slate-800/50',
    amber: 'text-amber-800 dark:text-amber-200 border-amber-200/80 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/25',
    orange: 'text-orange-800 dark:text-orange-200 border-orange-200/80 dark:border-orange-800/60 bg-orange-50/80 dark:bg-orange-950/25',
  }
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black tracking-[0.2em] uppercase mb-3 ${tones[tone] || tones.slate}`}>
      {children}
    </div>
  )
}

function InsightArticle({ insight, onBack }) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:border-orange-300 dark:hover:border-orange-700 hover:text-orange-600 dark:hover:text-orange-300 transition"
      >
        ← 一覧に戻る
      </button>

      <article className="rounded-3xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 overflow-hidden shadow-[0_24px_60px_-28px_rgba(15,23,42,0.2)] dark:shadow-[0_28px_70px_-24px_rgba(0,0,0,0.55)]">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />
        <div className="relative px-6 md:px-10 pt-8 pb-8 md:pb-10 border-b border-slate-100 dark:border-slate-800 overflow-hidden">
          <div
            className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-orange-400/10 dark:bg-orange-500/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-wrap items-center gap-2 text-[11px] mb-5">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-600">
              {insight.category}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-medium">{insight.date}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-slate-500 dark:text-slate-400">読了 {insight.readTime}</span>
          </div>
          <h1 className="relative text-3xl md:text-[2.15rem] font-black text-slate-900 dark:text-white leading-[1.15] tracking-tight max-w-3xl">
            {insight.headline}
          </h1>
          <div className="relative mt-5 max-w-2xl rounded-2xl border-l-4 border-orange-400 dark:border-orange-500 bg-gradient-to-r from-orange-50/90 to-transparent dark:from-orange-950/40 dark:to-transparent pl-5 pr-4 py-4">
            <InsightTextBlock text={insight.summary} className="text-[15px] md:text-base text-slate-700 dark:text-slate-200 leading-relaxed" />
          </div>
          <div className="relative mt-6 inline-flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 rounded-2xl border border-orange-200/90 dark:border-orange-800/60 bg-gradient-to-br from-orange-50 to-amber-50/50 dark:from-orange-950/40 dark:to-amber-950/20 px-5 py-3.5 shadow-sm">
            <p className="text-sm font-black text-slate-900 dark:text-white">MoneyMart リサーチ</p>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">|</span>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">中立・データドリブンの投資分析</p>
          </div>
        </div>

        <div className="px-6 md:px-10 py-8 md:py-10 space-y-10 md:space-y-12 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-900">
          <section className="scroll-mt-8">
            <SectionLabel tone="emerald">投資テーゼ</SectionLabel>
            <InsightTextBlock text={insight.idea} className="text-[16px] md:text-[17px] leading-[1.85] text-slate-800 dark:text-slate-100 font-medium" />
          </section>

          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" aria-hidden />

          <section>
            <SectionLabel tone="blue">根拠</SectionLabel>
            <InsightTextBlock text={insight.rationale} className="text-[16px] md:text-[17px] leading-[1.85] text-slate-800 dark:text-slate-100" />
          </section>

          <section className="rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-6 shadow-sm">
            <SectionLabel tone="slate">主要データ</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insight.data.map((row) => <DataMetric key={`${insight.id}-${row.label}`} {...row} />)}
            </div>
            {insight.dataNote ? (
              <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-4">
                {insight.dataNote}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-amber-200/90 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/90 to-white dark:from-amber-950/25 dark:to-slate-900 p-6 shadow-sm">
            <SectionLabel tone="amber">リスク要因</SectionLabel>
            <InsightTextBlock text={insight.risk} className="text-[16px] leading-[1.85] text-slate-800 dark:text-slate-100" />
          </section>

          <section className="rounded-2xl border border-orange-200/90 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/40 dark:from-orange-950/30 dark:via-slate-900 dark:to-amber-950/15 p-6 shadow-sm">
            <p className="text-sm font-black text-orange-800 dark:text-orange-200 mb-3">この分析に関連するツール</p>
            <div className="flex flex-wrap gap-2">
              {insight.relatedTools.map((tool) => <InsightToolPill key={`article-${insight.id}-${tool}`} name={tool} />)}
            </div>
            <p className="text-xs text-orange-700/85 dark:text-orange-300/85 mt-3 leading-relaxed">
              インサイト → データ確認 の順で使うと、判断精度が上がります。
            </p>
          </section>
        </div>

        <div className="px-6 md:px-10 py-5 bg-slate-100/80 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-3xl">
            本コンテンツは情報提供のみを目的としており、特定の金融商品の購入・売却を推奨するものではありません。投資判断はご自身の責任でお願いいたします。
          </p>
        </div>
      </article>
    </div>
  )
}

export default function InsightsPage() {
  const [selectedInsightId, setSelectedInsightId] = useState(null)
  const [insights, setInsights] = useState(INSIGHTS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const rows = await fetchPublishedInsights()
        if (!alive) return
        if (Array.isArray(rows) && rows.length > 0) setInsights(rows)
      } catch (err) {
        if (!alive) return
        setLoadError(String(err?.message || 'インサイトの読み込みに失敗しました。'))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const featured = useMemo(() => insights.find((item) => item.featured) || insights[0], [insights])
  const others = useMemo(() => insights.filter((item) => item.id !== featured?.id), [featured?.id, insights])
  const selected = useMemo(
    () => insights.find((item) => item.id === selectedInsightId) || null,
    [selectedInsightId, insights]
  )

  const articleCanonical = selected ? `${SITE_ORIGIN}/insights?id=${selected.id}` : null
  const articleLd = selected
    ? {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: selected.headline,
      description: selected.summary,
      datePublished: selected.date || undefined,
    }
    : null

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 font-sans">
      <div
        className="pointer-events-none fixed inset-0 -z-10 dark:hidden"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 100% 0%, rgba(251, 146, 60, 0.09), transparent 50%),
            radial-gradient(ellipse 60% 40% at 0% 100%, rgba(59, 130, 246, 0.06), transparent 45%)
          `,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 hidden dark:block"
        style={{
          background: `
            radial-gradient(ellipse 70% 45% at 90% 10%, rgba(234, 88, 12, 0.12), transparent 50%),
            radial-gradient(ellipse 50% 35% at 10% 90%, rgba(59, 130, 246, 0.08), transparent 45%)
          `,
        }}
        aria-hidden
      />
      {selected ? (
        <Helmet>
          <title>{`${selected.headline} | MoneyMart`}</title>
          <meta name="description" content={selected.summary} />
          <link rel="canonical" href={articleCanonical} />
          <meta property="og:title" content={`${selected.headline} | MoneyMart`} />
          <meta property="og:description" content={selected.summary} />
          <meta property="og:url" content={articleCanonical} />
          <meta name="twitter:title" content={`${selected.headline} | MoneyMart`} />
          <meta name="twitter:description" content={selected.summary} />
          {articleLd ? (
            <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
          ) : null}
        </Helmet>
      ) : null}
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <header className="relative mb-8 md:mb-10 overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-700/90 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md px-6 py-7 md:px-10 md:py-9 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-400/15 dark:bg-orange-500/15 blur-3xl"
            aria-hidden
          />
          <p className="relative text-[11px] font-black tracking-[0.28em] text-orange-600 dark:text-orange-400">MONEYMART RESEARCH</p>
          <h1 className="relative text-3xl md:text-[2.35rem] font-black text-slate-900 dark:text-white mt-3 leading-tight tracking-tight">
            投資インサイト
          </h1>
          <p className="relative mt-3 text-sm md:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            コミュニティ投稿ではなく、編集コンテンツとして公開する分析記事です。データと根拠に基づく判断材料を提供します。
          </p>
          <div className="relative mt-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/25 border border-orange-200/70 dark:border-orange-800/50 text-xs font-bold text-orange-800 dark:text-orange-200 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
              </span>
              週1-2回更新
            </div>
            <Link
              to="/insights"
              className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-300 underline-offset-4 hover:underline"
            >
              スラッグ付きマガジン版（/insights）→
            </Link>
          </div>
        </header>

        {selected ? (
          <InsightArticle insight={selected} onBack={() => setSelectedInsightId(null)} />
        ) : (
          <>
            {loading ? <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">読み込み中...</p> : null}
            {!loading && loadError ? <p className="text-sm text-amber-600 dark:text-amber-300 mb-4">{loadError}</p> : null}
            {featured ? <FeaturedCard insight={featured} onClick={() => setSelectedInsightId(featured.id)} /> : null}
            <div className="mt-8 md:mt-10">
              <div className="flex items-center gap-3 mb-4">
                <p className="text-[11px] font-black tracking-[0.22em] text-slate-600 dark:text-slate-300">最近の分析</p>
                <div className="h-px flex-1 bg-gradient-to-r from-slate-300/90 to-transparent dark:from-slate-600 dark:to-transparent" />
              </div>
              <div className="space-y-4">
                {others.map((insight) => (
                  <ArticleCard key={insight.id} insight={insight} onClick={() => setSelectedInsightId(insight.id)} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

