import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BarChart2, CalendarDays, PieChart, Wallet } from 'lucide-react'
import HomeOptimizer3DShowcase from '../funds/HomeOptimizer3DShowcase'
import { trackAnalyticsEvent } from '../../lib/analytics'

const DEMO_TOTAL_YEN = 12_450_000
const DEMO_DELTA_YEN = 128_000

const VARIANT_COPY = {
  home: {
    kicker: 'ご利用イメージ',
    title: '無料登録するだけで、資産・配当の管理からファンド選びまで、このアプリひとつで完結します。',
    lead: 'こちらは完成画面のイメージです。下記金額はデモ用の見本で、登録後はご自身の実数が表示されます。',
  },
  stock: {
    kicker: 'マイページ（デモ）',
    title: '気になる銘柄をウォッチリストに保存し、資産全体と一緒に管理できます。',
    lead: '口座連携は不要です。登録後、ご自身の保有・関心銘柄を入力するだけでダッシュボードが完成します（下記は見本）。',
  },
  fund: {
    kicker: 'マイページ（デモ）',
    title: '保有ファンドと配当予定を、ひとつの画面で追跡できます。',
    lead: 'ファンド比較のあと、マイページに登録してポートフォリオ全体を見渡せます（下記はデモ用の見本）。',
  },
}

export default function MyPageDemoShowcase({
  session = null,
  variant = 'home',
  id = 'mypage-demo-showcase',
  className = '',
  onGuestPrimaryClick = null,
}) {
  const navigate = useNavigate()
  const copy = VARIANT_COPY[variant] || VARIANT_COPY.home
  const isLoggedIn = Boolean(session?.user)
  const returnPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search || ''}`
    : '/'

  const go = (to, meta = {}) => {
    trackAnalyticsEvent('mypage_demo_cta_click', { destination: to, variant, ...meta })
    navigate(to, (to === '/login' || to === '/signup') ? { state: { from: returnPath } } : undefined)
  }

  const primaryLabel = isLoggedIn ? 'マイページを開く' : '30秒で資産診断をはじめる'
  const primaryTo = isLoggedIn ? '/mypage?tab=wealth' : '/signup'

  const handlePrimary = () => {
    if (!isLoggedIn && typeof onGuestPrimaryClick === 'function') {
      trackAnalyticsEvent('mypage_demo_cta_click', { destination: 'guest_diagnosis', variant, source: 'primary_cta' })
      onGuestPrimaryClick()
      return
    }
    go(primaryTo, { source: 'primary_cta' })
  }

  return (
    <section
      id={id}
      className={`scroll-mt-24 ${className}`.trim()}
      aria-labelledby={`${id}-heading`}
    >
      <div className="rounded-[1.75rem] border border-orange-200/80 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/90 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-orange-950/30 p-5 md:p-7 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black tracking-[0.2em] text-orange-600 dark:text-orange-400">{copy.kicker}</p>
            <h2 id={`${id}-heading`} className="mt-2 text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-snug">
              {copy.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{copy.lead}</p>
          </div>
          <button
            type="button"
            onClick={handlePrimary}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-black px-6 py-3 shadow-md shadow-orange-500/25"
          >
            {primaryLabel}
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 shadow-sm min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="h-9 w-9 rounded-xl bg-slate-900 dark:bg-orange-500 flex items-center justify-center">
                <Wallet size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-black text-orange-600 dark:text-orange-400">マイページ</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">資産のダッシュボード</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-700 px-4 py-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">総資産</p>
                <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/80 border border-orange-200/80 dark:border-orange-800 rounded-md px-2 py-0.5">デモ</span>
              </div>
              <p className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
                ¥{DEMO_TOTAL_YEN.toLocaleString('ja-JP')}
              </p>
              <p className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                先月比 +¥{DEMO_DELTA_YEN.toLocaleString('ja-JP')} (+1.0%) ※例示
              </p>
              <div className="mt-3 flex items-end justify-between gap-1 h-12">
                {[12, 18, 14, 22, 16, 20, 15].map((h, i) => (
                  <div
                    key={`demo-bar-${i}`}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-orange-200 to-orange-400/90 dark:from-orange-900/60 dark:to-orange-600/50"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 shadow-sm min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center">
                <CalendarDays size={18} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-xs font-black text-rose-600 dark:text-rose-400">配当カレンダー</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">受取予定リスト</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 flex-1">
              {[
                { mo: '3月', t: '登録した銘柄', s: '予定日・金額は自動表示' },
                { mo: '5月', t: '国内株式・ETF など', s: '年次・四半期で整理' },
                { mo: '—', t: 'ウォッチ銘柄もまとめて確認', s: '見落としにくい設計' },
              ].map((row) => (
                <div key={row.t} className="flex items-stretch gap-2 px-3 py-2">
                  <div className="w-9 shrink-0 rounded-lg bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
                    <span className="text-[10px] font-black text-rose-700 dark:text-rose-300">{row.mo}</span>
                  </div>
                  <div className="min-w-0 py-0.5">
                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">{row.t}</p>
                    <p className="text-[10px] font-bold text-slate-400">{row.s}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 shadow-sm min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="h-9 w-9 rounded-xl bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center">
                <BarChart2 size={18} className="text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-black text-sky-600 dark:text-sky-400">ファンド最適化</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">配分を試す（見本）</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <HomeOptimizer3DShowcase />
              <button
                type="button"
                onClick={() => go('/funds', { source: 'optimizer' })}
                className="w-full min-h-9 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-black py-2"
              >
                ファンド一覧で最適化ツールを試す
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 shadow-sm min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
                <PieChart size={18} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-black text-violet-600 dark:text-violet-400">ローン・負債</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">返済の見える化</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-violet-50/40 dark:bg-violet-950/15 px-3.5 py-3 flex-1 flex flex-col">
              <div className="space-y-2.5 flex-1 flex flex-col justify-center">
                {[
                  { lab: '住宅・ローン', tone: 'bg-violet-500', w: 'w-[55%]' },
                  { lab: 'カード・リボ', tone: 'bg-amber-400', w: 'w-[25%]' },
                  { lab: 'その他', tone: 'bg-rose-400', w: 'w-[20%]' },
                ].map((row) => (
                  <div key={row.lab}>
                    <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 mb-1">{row.lab}</p>
                    <div className="h-2 rounded-full bg-slate-200/90 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${row.tone} ${row.w}`} aria-hidden />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => go(isLoggedIn ? '/mypage' : '/signup', { source: 'debt' })}
                className="mt-3 w-full min-h-9 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-black py-2"
              >
                {isLoggedIn ? 'マイページでローンを整理' : '無料登録して借入を記録'}
              </button>
            </div>
          </div>
        </div>

        {!isLoggedIn ? (
          <p className="mt-4 text-center text-[10px] text-slate-500 dark:text-slate-400">
            すでにアカウントをお持ちの方は{' '}
            <Link to="/login" state={{ from: returnPath }} className="font-bold text-orange-600 dark:text-orange-400 underline underline-offset-2">
              ログイン
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  )
}
