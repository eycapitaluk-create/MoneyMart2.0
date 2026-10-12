import { Link } from 'react-router-dom'
import {
  EXPOSURE_LEVEL_META,
  EXPOSURE_SCORE_THRESHOLDS,
  rankFactorsForPortfolio,
  scoreManyNews,
} from '../../lib/portfolioExposureMap.js'
import { ExposureLevelBadge } from './PortfolioNewsRelevance.jsx'

const LEVEL_DOT = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-orange-500',
  LOW: 'bg-emerald-500',
  NONE: 'bg-slate-400',
}

function resolvedSourceHref(item) {
  const raw = String(item?.sourceUrl || item?.source_url || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  return `https://${raw.replace(/^\/+/, '')}`
}

function isAiTrendSummarySource(source) {
  return String(source || '').includes('AIトレンド要約')
}

function stockPageSymbolQuery(item) {
  const raw = String(item?.ticker || '').trim()
  if (!raw) return ''
  const u = raw.toUpperCase()
  if (/\.[A-Z]{1,3}$/i.test(raw)) return u
  if (item?.market === 'jp' && /^\d{4,5}$/.test(u)) return `${u}.T`
  return u
}

/** Prefer original article → stock page → news page focus */
export function resolveNewsDestination(news = {}) {
  const href = resolvedSourceHref(news)
  if (href && !isAiTrendSummarySource(news.source)) {
    return { type: 'external', href }
  }
  const sym = stockPageSymbolQuery(news)
  if (sym) {
    return { type: 'internal', href: `/stocks?symbol=${encodeURIComponent(sym)}` }
  }
  const id = String(news.id || '').trim()
  if (id) {
    return { type: 'internal', href: `/news?article=${encodeURIComponent(id)}` }
  }
  return { type: 'internal', href: '/news' }
}

/**
 * MyPage / Home: market-factor exposure board (not price prediction).
 */
export default function PortfolioRelatedPanel({
  exposureProfile,
  loading = false,
  newsRows = [],
  compact = false,
}) {
  const factorRows = rankFactorsForPortfolio(exposureProfile).slice(0, compact ? 3 : 8)
  const topNews = scoreManyNews(newsRows, exposureProfile)
    .filter((r) => r.score.level !== 'NONE')
    .slice(0, compact ? 3 : 6)

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
  }

  if (!exposureProfile || exposureProfile.empty) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 dark:border-slate-600 dark:bg-slate-900">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">保有資産との関連</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          株式・ファンドの保有を登録すると、今日の市場要因とあなたの資産の重なり（関連度）を表示します。価格の上下予測や売買の勧誘ではありません。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/mypage?tab=stock" className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white dark:bg-orange-500">
            株式を登録
          </Link>
          <Link to="/mypage?tab=fund" className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
            ファンドを登録
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">
            Exposure Mapping
          </p>
          <h3 className={`${compact ? 'text-base' : 'text-lg'} font-black text-slate-900 dark:text-white`}>
            保有資産との関連
          </h3>
        </div>
        {!compact ? (
          <Link to="/news" className="text-xs font-black text-orange-600 dark:text-orange-400 underline underline-offset-2">
            ニュースを見る
          </Link>
        ) : null}
      </div>

      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">スコア定義</p>
        <ul className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
          {EXPOSURE_SCORE_THRESHOLDS.definitionJa.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs font-black text-slate-800 dark:text-slate-100">MARKET FACTORS</p>
        <ul className="mt-2 space-y-2">
          {factorRows.length === 0 ? (
            <li className="text-sm text-slate-500">表示できる要因がありません。</li>
          ) : (
            factorRows.map((row) => (
              <li
                key={row.factorId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL_DOT[row.level]}`} aria-hidden />
                  <span className="truncate text-sm font-black text-slate-900 dark:text-white">
                    {row.factor?.emoji} {row.factor?.labelJa}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] font-bold tabular-nums text-slate-500">
                    露出 ~{row.matchedWeightPct.toFixed(0)}%
                  </span>
                  <ExposureLevelBadge level={row.level} />
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {topNews.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-black text-slate-800 dark:text-slate-100">
            {compact ? '今日、関係しやすいニュース' : '関連度の高いニュース'}
          </p>
          <ul className="mt-2 space-y-2">
            {topNews.map(({ news, score }) => {
              const dest = resolveNewsDestination(news)
              const body = (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <ExposureLevelBadge level={score.level} compact />
                    {score.primaryFactor ? (
                      <span className="text-[10px] font-bold text-slate-500">
                        {score.primaryFactor.labelJa}
                      </span>
                    ) : null}
                    <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                      {dest.type === 'external' ? '元記事 →' : '記事を開く →'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold leading-snug text-slate-900 dark:text-white group-hover:underline">
                    {news.headline || news.title}
                  </p>
                </>
              )
              const className = 'group block rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-orange-300 hover:bg-orange-50/40 dark:border-slate-700 dark:hover:border-orange-700/60 dark:hover:bg-orange-950/20'
              if (dest.type === 'external') {
                return (
                  <li key={news.id || news.headline}>
                    <a href={dest.href} target="_blank" rel="noopener noreferrer" className={className}>
                      {body}
                    </a>
                  </li>
                )
              }
              return (
                <li key={news.id || news.headline}>
                  <Link to={dest.href} className={className}>
                    {body}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
        {EXPOSURE_LEVEL_META.HIGH.hintJa} / {EXPOSURE_LEVEL_META.MEDIUM.hintJa} / {EXPOSURE_LEVEL_META.LOW.hintJa}。
        売買の勧誘や将来リターンの保証ではありません。
      </p>
    </div>
  )
}
