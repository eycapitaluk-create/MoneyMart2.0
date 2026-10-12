import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Compass,
  Globe2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  WalletCards,
} from 'lucide-react'
import { SITE_ORIGIN } from '../lib/seoConfig'

const QUESTIONS = [
  {
    id: 'horizon',
    icon: Timer,
    title: '投資期間は何年くらい？',
    detail: '1年以内なのか、10年以上なのかで選ぶ商品・リスクの取り方が変わります。',
    tag: '期間',
  },
  {
    id: 'monthly',
    icon: WalletCards,
    title: '毎月いくらなら無理なく続けられる？',
    detail: '相場が下がった月も続けられる金額を先に決めておくと、途中で崩れにくくなります。',
    tag: '積立額',
  },
  {
    id: 'region',
    icon: Globe2,
    title: '日本株・米国株・全世界株の違いを理解している？',
    detail: '投資対象の地域が違うと、成長性・為替・値動きのクセも変わります。',
    tag: '投資先',
  },
  {
    id: 'fee',
    icon: CircleDollarSign,
    title: '信託報酬を見た？',
    detail: '長期投資では年0.1%の差でも積み上がります。ランキングより先にコストを確認します。',
    tag: 'コスト',
  },
  {
    id: 'fx',
    icon: RefreshCw,
    title: '為替の影響を受ける商品か？',
    detail: '海外資産のETF・投信は、株価だけでなく円高・円安でも評価額が動きます。',
    tag: '為替',
  },
  {
    id: 'distribution',
    icon: BarChart3,
    title: '分配金あり/なしの違いを知っている？',
    detail: '分配金を受け取るか、再投資で増やすか。NISAでの目的に合わせて整理します。',
    tag: '分配',
  },
  {
    id: 'drawdown',
    icon: ShieldCheck,
    title: '下がった時も続けられる？',
    detail: '値下がり時のルールを決めておくと、感情で売買しにくくなります。',
    tag: '下落耐性',
  },
]

const RESULT_COPY = [
  {
    max: 2,
    label: 'まずは目的整理から',
    tone: 'orange',
    title: 'ランキングを見る前に、投資の前提を3つだけ決めましょう。',
    body: '期間・毎月額・投資対象を先に決めると、ETFや投信の比較がかなり楽になります。',
    next: 'MoneyMartのETF比較で、信託報酬とNISA区分を横並びで確認してみましょう。',
  },
  {
    max: 5,
    label: '比較準備中',
    tone: 'indigo',
    title: 'かなり整理できています。次は比較軸を数字で見ていきましょう。',
    body: '信託報酬・分配方針・為替の影響まで見れば、人気だけに流されにくくなります。',
    next: '候補を2〜3本に絞って、ETF比較やファンド探索で差を見てください。',
  },
  {
    max: 7,
    label: '比較へ進める状態',
    tone: 'emerald',
    title: 'NISA/ETFを比較する準備はできています。',
    body: '目的とリスクの前提が整理できているので、コスト・分散・分配方針を見ながら候補を選べます。',
    next: '候補を保存したい場合は、無料登録してウォッチリストやマイページに進めます。',
  },
]

function getResult(score) {
  return RESULT_COPY.find((row) => score <= row.max) || RESULT_COPY[RESULT_COPY.length - 1]
}

function resultClasses(tone) {
  if (tone === 'emerald') {
    return {
      box: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-100',
      badge: 'bg-emerald-600 text-white',
      bar: 'from-emerald-500 to-teal-500',
    }
  }
  if (tone === 'indigo') {
    return {
      box: 'border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-100',
      badge: 'bg-indigo-600 text-white',
      bar: 'from-indigo-500 to-violet-500',
    }
  }
  return {
    box: 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-800/70 dark:bg-orange-950/30 dark:text-orange-100',
    badge: 'bg-orange-600 text-white',
    bar: 'from-orange-500 to-amber-500',
  }
}

export default function NisaEtfChecklistPage() {
  const [checked, setChecked] = useState(() => ({}))
  const checkedCount = QUESTIONS.reduce((sum, q) => sum + (checked[q.id] ? 1 : 0), 0)
  const progressPct = Math.round((checkedCount / QUESTIONS.length) * 100)
  const result = getResult(checkedCount)
  const cls = resultClasses(result.tone)
  const missing = useMemo(
    () => QUESTIONS.filter((q) => !checked[q.id]).slice(0, 3),
    [checked],
  )

  const toggle = (id) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      <Helmet>
        <title>NISA・ETFを選ぶ前の初心者チェックリスト | MoneyMart</title>
        <meta
          name="description"
          content="人気ランキングを見る前に、投資期間・積立額・信託報酬・為替・分配金などの比較軸を整理する無料チェックリスト。NISA・ETF初心者向け。"
        />
        <link rel="canonical" href={`${SITE_ORIGIN}/tools/nisa-etf-checklist`} />
        <meta property="og:title" content="NISA・ETFを選ぶ前の初心者チェックリスト | MoneyMart" />
        <meta
          property="og:description"
          content="NISA・ETFを選ぶ前に確認したい7項目を、3分で整理できる無料チェックリストです。"
        />
      </Helmet>

      <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <section className="relative overflow-hidden border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-indigo-50 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
          <div className="absolute -left-20 top-16 h-56 w-56 rounded-full bg-orange-300/25 blur-3xl" />
          <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
            <div className="flex flex-col justify-center">
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1.5 text-xs font-black text-orange-700 shadow-sm dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-200">
                <Sparkles size={14} aria-hidden />
                Xから来た方へ・無料チェック
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                NISA・ETFを選ぶ前の
                <span className="block bg-gradient-to-r from-orange-600 to-indigo-600 bg-clip-text text-transparent">
                  初心者チェックリスト
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
                人気ランキングを見る前に、まず自分の目的と比較軸を整理します。
                7項目をチェックするだけで、次に見るべきポイントがわかります。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#checklist"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                >
                  チェックを始める
                  <ArrowRight size={18} aria-hidden />
                </a>
                <Link
                  to="/etf-compare"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white/80 px-6 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                >
                  ETF比較を見る
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-2xl shadow-orange-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-black/30">
              <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-300">Checklist</p>
                    <p className="mt-1 text-2xl font-black">{checkedCount}/7 完了</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <ClipboardCheck size={26} aria-hidden />
                  </div>
                </div>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${cls.bar} transition-all duration-300`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-4 text-sm font-bold leading-6 text-slate-300">
                  結果は保存されません。まずは気軽に、自分の比較軸を確認してください。
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {['期間', 'コスト', '分散'].map((label) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">先に確認</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="checklist" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.24em] text-orange-600 dark:text-orange-300">
                    3 minutes
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">
                    7つのチェック項目
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setChecked({})}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:border-orange-300 hover:text-orange-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  リセット
                </button>
              </div>

              <div className="grid gap-3">
                {QUESTIONS.map((q, idx) => {
                  const Icon = q.icon
                  const active = Boolean(checked[q.id])
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => toggle(q.id)}
                      className={`group flex w-full items-start gap-4 rounded-3xl border p-4 text-left shadow-sm transition sm:p-5 ${
                        active
                          ? 'border-orange-300 bg-orange-50 shadow-orange-900/5 dark:border-orange-700 dark:bg-orange-950/30'
                          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        active
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                      >
                        {active ? <CheckCircle2 size={22} aria-hidden /> : <Icon size={22} aria-hidden />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-slate-400">{String(idx + 1).padStart(2, '0')}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                            active
                              ? 'bg-orange-200 text-orange-800 dark:bg-orange-900/70 dark:text-orange-100'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                          >
                            {q.tag}
                          </span>
                        </div>
                        <p className="mt-2 text-base font-black leading-6 text-slate-950 dark:text-white">
                          {q.title}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
                          {q.detail}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className={`overflow-hidden rounded-[1.75rem] border shadow-xl shadow-slate-900/5 ${cls.box}`}>
                <div className="p-5">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${cls.badge}`}>
                    {result.label}
                  </span>
                  <p className="mt-4 text-2xl font-black leading-8">{result.title}</p>
                  <p className="mt-3 text-sm font-bold leading-7 opacity-80">{result.body}</p>
                </div>
                <div className="border-t border-current/10 bg-white/45 p-5 dark:bg-slate-950/20">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-black">進捗</span>
                    <span className="text-sm font-black">{progressPct}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/70 dark:bg-slate-900/60">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${cls.bar} transition-all duration-300`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  {missing.length > 0 ? (
                    <div className="mt-5 rounded-2xl bg-white/70 p-4 dark:bg-slate-900/60">
                      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">Next check</p>
                      <ul className="mt-2 space-y-2">
                        {missing.map((q) => (
                          <li key={q.id} className="text-sm font-bold leading-6">
                            {q.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="mt-5 text-sm font-bold leading-7 opacity-85">{result.next}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <Link
                  to="/etf-compare"
                  className="inline-flex items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                >
                  ETF比較を開く
                  <ArrowRight size={18} aria-hidden />
                </Link>
                <Link
                  to="/funds"
                  className="inline-flex items-center justify-between rounded-2xl border border-slate-300 bg-white px-5 py-4 text-sm font-black text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  ファンドを探す
                  <Compass size={18} aria-hidden />
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm font-black text-orange-800 hover:border-orange-300 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200"
                >
                  無料登録して続ける
                  <ArrowRight size={18} aria-hidden />
                </Link>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['比較の入口にする', 'チェック結果からETF比較・ファンド探索へ自然に進めます。'],
              ['保存は登録後に', 'ウォッチリストや配分セットは、ログイン後のマイページで管理できます。'],
              ['投資助言ではありません', '商品選びの前提整理を助ける無料チェックリストです。'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-lg font-black text-slate-950 dark:text-white">{title}</p>
                <p className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
            本ページは情報提供を目的としたものであり、特定の金融商品の売買を勧誘するものではありません。
            最終的な投資判断はご自身の責任で行ってください。
          </p>
        </section>
      </main>
    </>
  )
}
