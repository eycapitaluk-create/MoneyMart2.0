import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EXPOSURE_LEVEL_META, EXPOSURE_SCORE_THRESHOLDS, scoreNewsExposure } from '../../lib/portfolioExposureMap.js'

const LEVEL_STYLES = {
  HIGH: 'bg-red-500/15 text-red-700 border-red-400/50 dark:text-red-300 dark:border-red-500/40',
  MEDIUM: 'bg-orange-500/15 text-orange-700 border-orange-400/50 dark:text-orange-300 dark:border-orange-500/40',
  LOW: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/50 dark:text-emerald-300 dark:border-emerald-500/40',
  NONE: 'bg-slate-500/10 text-slate-500 border-slate-300/60 dark:text-slate-400 dark:border-slate-600',
}

export function ExposureLevelBadge({ level = 'NONE', compact = false, className = '' }) {
  const meta = EXPOSURE_LEVEL_META[level] || EXPOSURE_LEVEL_META.NONE
  if (level === 'NONE' && compact) return null
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wide ${LEVEL_STYLES[level] || LEVEL_STYLES.NONE} ${className}`}
      title={meta.hintJa}
    >
      {compact ? `あなたとの関連：${meta.labelJa}` : `関連度 ${meta.labelJa}`}
    </span>
  )
}

export function PortfolioNewsRelevanceCard({
  news,
  exposureProfile,
  loading = false,
  isLoggedIn = false,
  variant = 'light',
}) {
  const [open, setOpen] = useState(false)
  const score = useMemo(
    () => scoreNewsExposure(news, exposureProfile),
    [news, exposureProfile],
  )

  const dark = variant === 'dark'
  const btnClass = dark
    ? 'border-white/25 bg-white/10 text-white hover:bg-white/15'
    : 'border-orange-300/70 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-700/50 dark:bg-orange-950/40 dark:text-orange-200'

  if (!isLoggedIn) {
    return (
      <div className={`mt-3 rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed ${dark ? 'border-white/15 bg-white/5 text-white/70' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300'}`}>
        <p className="font-bold">保有資産との関連</p>
        <p className="mt-1">
          ログインして保有を登録すると、このニュースとあなたの資産の重なりを表示します（価格予測ではありません）。
        </p>
        <Link to="/login" className="mt-2 inline-flex font-black text-orange-600 dark:text-orange-400 underline underline-offset-2">
          ログイン
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`mt-3 h-10 animate-pulse rounded-lg ${dark ? 'bg-white/10' : 'bg-slate-100 dark:bg-slate-800'}`} />
    )
  }

  if (exposureProfile?.empty) {
    return (
      <div className={`mt-3 rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed ${dark ? 'border-white/15 bg-white/5 text-white/70' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300'}`}>
        <p className="font-bold">保有資産との関連</p>
        <p className="mt-1">マイページで保有を登録すると、関連度を表示できます。</p>
        <Link to="/mypage?tab=related" className="mt-2 inline-flex font-black text-orange-600 dark:text-orange-400 underline underline-offset-2">
          保有を登録する
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <ExposureLevelBadge level={score.level} compact />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-black transition ${btnClass}`}
        >
          あなたの資産への関連を見る
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center px-3 py-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55"
            aria-label="閉じる"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-[131] w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  保有資産との関連
                </p>
                <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white leading-snug">
                  {news?.headline || news?.title || 'このニュース'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-500 dark:border-slate-600"
              >
                閉じる
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ExposureLevelBadge level={score.level} />
              {score.primaryFactor ? (
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {score.primaryFactor.emoji} {score.primaryFactor.labelJa}
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {score.disclaimerJa}
            </p>
            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[10px] font-black text-slate-500">スコア定義</p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                {EXPOSURE_SCORE_THRESHOLDS.definitionJa.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            {score.breakdown?.length ? (
              <div className="mt-4">
                <p className="text-xs font-black text-slate-800 dark:text-slate-100">あなたのポートフォリオとの関連</p>
                <ul className="mt-2 space-y-1.5">
                  {score.breakdown.map((row) => (
                    <li key={row.label} className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-200">
                      <span>{row.label}</span>
                      <span className="tabular-nums">{row.pct.toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {score.pathJa?.length ? (
              <div className="mt-4">
                <p className="text-xs font-black text-slate-800 dark:text-slate-100">主な関連経路</p>
                <ol className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {score.pathJa.map((step, i) => (
                    <li key={`${step}-${i}`} className="flex gap-2">
                      <span className="font-black text-orange-500">{i === 0 ? '→' : '↓'}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className="mt-4">
              <p className="text-xs font-black text-slate-800 dark:text-slate-100">なぜこの関連度？</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-slate-600 dark:text-slate-300">
                {score.whyLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            {score.matchedHoldings?.length ? (
              <div className="mt-4">
                <p className="text-xs font-black text-slate-800 dark:text-slate-100">関連する保有資産</p>
                <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                  {score.matchedHoldings.map((h) => (
                    <li key={h.symbol} className="flex items-center justify-between gap-2 bg-slate-50/80 px-3 py-2 dark:bg-slate-800/50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{h.name}</p>
                        <p className="text-[10px] text-slate-500">{h.symbol}</p>
                      </div>
                      <p className="shrink-0 text-xs font-black tabular-nums text-slate-700 dark:text-slate-200">
                        {h.weightPct.toFixed(0)}%
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Link
              to="/mypage?tab=related"
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-black text-white dark:bg-orange-500"
              onClick={() => setOpen(false)}
            >
              マイページで関連一覧を見る
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
