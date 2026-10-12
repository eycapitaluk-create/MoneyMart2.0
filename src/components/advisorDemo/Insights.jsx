import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowUpRight, Clock3, RefreshCw } from 'lucide-react'
import { fetchPublishedInsights } from '../../lib/insightApi'
import { mockArticles } from './mockCatalog'
import { looksLikeInsightHtml, plainTextFromInsightHtml } from '../../lib/insightHtml'
import { C } from './theme'
import { Card, Pill } from './ui'

function getCategory(article) {
  return String(article?.document?.admin?.category || article?.document?.hero?.badge || 'インサイト')
    .split(/[—–]/)[0]
    .trim() || 'インサイト'
}

function getCoverImage(article) {
  return String(
    article?.document?.admin?.coverImageUrl
    || article?.document?.hero?.coverImageUrl
    || '',
  ).trim()
}

function toPlainText(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return looksLikeInsightHtml(text) ? plainTextFromInsightHtml(text) : text
}

function getSummary(article) {
  const doc = article?.document || {}
  const hero = toPlainText(doc?.hero?.sub)
  if (hero) return hero
  const prose = Array.isArray(doc?.sections) ? doc.sections.find((section) => section?.type === 'prose') : null
  return toPlainText(prose?.lead || prose?.paragraphs?.find(Boolean))
}

function getReadTime(article) {
  const meta = article?.document?.hero?.meta
  if (!Array.isArray(meta)) return ''
  return String(meta.find((value) => /分/.test(String(value))) || '').trim()
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
}

function openArticle(article, onToast) {
  if (!article?.slug) return
  window.open(`/insights/${encodeURIComponent(article.slug)}`, '_blank', 'noopener,noreferrer')
  onToast?.(`「${article.pageTitle}」を開きました`)
}

export default function InsightsPage({ onToast }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadArticles = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await fetchPublishedInsights(30)
      setArticles(Array.isArray(rows) ? rows : [])
    } catch (loadError) {
      setArticles([])
      setError(String(loadError?.message || 'インサイトを読み込めませんでした。'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  const featured = articles[0] || null
  const remaining = useMemo(() => articles.slice(1), [articles])

  return (
    <div className="space-y-5 p-5 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>インサイト</h1>
            {!loading && !error ? <Pill bg="#dcfce7" color="#15803d">Live</Pill> : null}
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: C.textMuted }}>
            MoneyMartが公開している最新のマーケット分析
          </p>
        </div>
        <button
          type="button"
          onClick={loadArticles}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-[11px] font-bold disabled:opacity-50"
          style={{ borderColor: C.border, color: C.textSecondary }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-2xl border bg-white" style={{ borderColor: C.border }}>
              <div className="h-32 rounded-t-2xl bg-slate-100" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-16 rounded bg-slate-100" />
                <div className="h-4 w-4/5 rounded bg-slate-100" />
                <div className="h-3 w-full rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="space-y-3">
          <Card className="flex items-start gap-3" padding={18}>
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <div className="text-[13px] font-bold" style={{ color: C.navy }}>公開インサイトを取得できませんでした</div>
              <div className="mt-1 text-[11px]" style={{ color: C.textMuted }}>{error} 下記は顧客対話用の参考トピックです。</div>
            </div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mockArticles.slice(0, 6).map((article) => (
              <div key={article.id} className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: C.border }}>
                <div className="grid aspect-[16/8.5] place-items-center" style={{ background: '#fff7ed' }}>
                  <span className="text-[12px] font-extrabold" style={{ color: '#c2410c' }}>{article.category_label}</span>
                </div>
                <div className="p-4">
                  <Pill>{article.category_label}</Pill>
                  <div className="mt-2.5 line-clamp-2 text-[14px] font-extrabold leading-snug" style={{ color: C.navy }}>{article.title}</div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed" style={{ color: C.textSecondary }}>{article.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && !error && featured ? (
        <button
          type="button"
          onClick={() => openArticle(featured, onToast)}
          className="group grid w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg lg:grid-cols-[1.25fr_1fr]"
          style={{ borderColor: C.border }}
        >
          <div className="relative min-h-56 overflow-hidden bg-slate-100 lg:min-h-72">
            {getCoverImage(featured) ? (
              <img
                src={getCoverImage(featured)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center" style={{ background: '#fff7ed' }}>
                <div className="px-6 text-center text-[16px] font-extrabold" style={{ color: '#c2410c' }}>{getCategory(featured)}</div>
              </div>
            )}
            <div className="absolute left-4 top-4"><Pill bg="#fff7ed" color="#c2410c">LATEST</Pill></div>
          </div>
          <div className="flex flex-col justify-center p-5 lg:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <Pill>{getCategory(featured)}</Pill>
              <span className="text-[10px]" style={{ color: C.textMuted }}>{formatDate(featured.publishedAt)}</span>
            </div>
            <h2 className="mt-4 text-[20px] font-extrabold leading-snug lg:text-[24px]" style={{ color: C.navy }}>
              {featured.pageTitle}
            </h2>
            <p className="mt-3 line-clamp-3 text-[12px] leading-relaxed" style={{ color: C.textSecondary }}>
              {getSummary(featured)}
            </p>
            <div className="mt-5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px]" style={{ color: C.textMuted }}>
                <Clock3 className="h-3.5 w-3.5" />{getReadTime(featured) || 'MoneyMart Research'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: C.accentDark }}>
                記事を読む <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </button>
      ) : null}

      {!loading && !error && remaining.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {remaining.map((article) => (
          <button
            key={article.slug}
            type="button"
            onClick={() => openArticle(article, onToast)}
            className="group overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ borderColor: C.border }}
          >
            <div className="relative aspect-[16/8.5] overflow-hidden bg-slate-100">
              {getCoverImage(article) ? (
                <img
                  src={getCoverImage(article)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="grid h-full w-full place-items-center" style={{ background: '#faf8f2' }}>
                  <span className="text-[12px] font-extrabold" style={{ color: C.accentDark }}>{getCategory(article)}</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <Pill>{getCategory(article)}</Pill>
                <span className="text-[9px]" style={{ color: C.textMuted }}>{formatDate(article.publishedAt)}</span>
              </div>
              <div className="mt-2.5 line-clamp-2 text-[14px] font-extrabold leading-snug" style={{ color: C.navy }}>
                {article.pageTitle}
              </div>
              <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed" style={{ color: C.textSecondary }}>
                {getSummary(article)}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[9px]" style={{ color: C.textMuted }}>
                  <Clock3 className="h-3 w-3" />{getReadTime(article) || 'MoneyMart Research'}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5" style={{ color: C.accentDark }} />
              </div>
            </div>
          </button>
          ))}
        </div>
      ) : null}

      {!loading && !error && articles.length === 0 ? (
        <div className="space-y-3">
          <Card padding={14}>
            <div className="text-[13px] font-bold" style={{ color: C.navy }}>公開記事の取得待ち</div>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>
              本番の公開インサイトが空のときは、顧客対話用の参考トピックを表示します。価格予測ではなく関連性の共有に使ってください。
            </p>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mockArticles.slice(0, 6).map((article) => (
              <div key={article.id} className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: C.border }}>
                <div className="grid aspect-[16/8.5] place-items-center" style={{ background: '#fff7ed' }}>
                  <span className="text-[12px] font-extrabold" style={{ color: '#c2410c' }}>{article.category_label}</span>
                </div>
                <div className="p-4">
                  <Pill>{article.category_label}</Pill>
                  <div className="mt-2.5 line-clamp-2 text-[14px] font-extrabold leading-snug" style={{ color: C.navy }}>{article.title}</div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed" style={{ color: C.textSecondary }}>{article.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
