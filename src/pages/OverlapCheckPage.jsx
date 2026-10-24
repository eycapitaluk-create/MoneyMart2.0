import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, Copy, Layers, Search, X } from 'lucide-react'
import { SITE_ORIGIN } from '../lib/seoConfig'
import { APP_STORE_IOS_URL } from '../constants/appStore'
import { trackAnalyticsEvent } from '../lib/analytics'
import {
  OVERLAP_FUNDS,
  POPULAR_IDS,
  POPULAR_PAIRS,
  fundById,
  overlapHeadline,
  overlapLines,
  pairSlug,
  parseFundIds,
  searchFunds,
  shareUrl,
} from '../lib/overlapCheck'

const DISCLAIMER =
  '連動指数の構成ルールにもとづく表示です。実際の保有銘柄・比率は商品ごとに異なります。特定の金融商品の売買を勧誘するものではありません。'

function track(name, meta) {
  // 計測失敗は画面に影響させない
  Promise.resolve()
    .then(() => trackAnalyticsEvent(name, meta))
    .catch(() => {})
}

export default function OverlapCheckPage() {
  const { pair } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const initial = useMemo(() => {
    if (pair) return parseFundIds(pair)
    return parseFundIds(new URLSearchParams(location.search).get('f'))
    // 初回だけ URL から読む (以降は画面の選択を優先)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [selected, setSelected] = useState(initial)
  // 検索ページ (/check/a-vs-b) どうしを移動したら選択を入れ替える
  useEffect(() => {
    if (pair) setSelected(parseFundIds(pair))
  }, [pair])
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    track('overlap_check_view', { from_link: initial.length > 0 ? 1 : 0, pair: pair || '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 選択を URL に反映 (そのまま共有できる). 検索ページ (/check/a-vs-b) では URL を変えない.
  useEffect(() => {
    if (pair) return
    const next = selected.length ? `?f=${selected.map((f) => f.id).join(',')}` : ''
    if (next !== location.search) navigate({ pathname: '/check', search: next }, { replace: true })
  }, [selected, pair, location.search, navigate])

  const lines = useMemo(() => overlapLines(selected), [selected])
  const headline = overlapHeadline(selected)
  const popular = POPULAR_IDS.map(fundById).filter(Boolean)
  const results = searchFunds(query)
  const list = query ? results : OVERLAP_FUNDS.filter((f) => !POPULAR_IDS.includes(f.id))
  const url = shareUrl(selected, SITE_ORIGIN || 'https://www.moneymart.co.jp')
  const shareText = `オルカンとS&P500、どこまで重なる？「${headline}」 #MoneyMart`

  const toggle = (f) => {
    setSelected((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f].slice(0, 8)))
  }

  const pairFunds = pair ? parseFundIds(pair) : []
  const pairTitle = pairFunds.length === 2 ? `${pairFunds[0].short} と ${pairFunds[1].short} の重なり` : null
  const title = pairTitle
    ? `${pairTitle}｜連動指数で3秒チェック | MoneyMart`
    : 'オルカンとS&P500、どこまで重なる？ 重なりチェック | MoneyMart'
  const description = pairTitle
    ? `${pairFunds[0]?.name}（${pairFunds[0]?.index}）と ${pairFunds[1]?.name}（${pairFunds[1]?.index}）の連動指数の重なりを確認できます。${overlapHeadline(pairFunds)}。`
    : '持っている（気になる）投資信託・ETFを選ぶだけで、連動指数の重なりを3秒で確認。オルカン・S&P500・全米株式・NASDAQ100・TOPIXなど。'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      track('overlap_check_share', { channel: 'copy', n: selected.length })
    } catch {
      /* クリップボード不可の環境 */
    }
  }

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE_ORIGIN}${pairFunds.length === 2 ? `/check/${pairSlug(pairFunds[0].id, pairFunds[1].id)}` : '/check'}`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
      </Helmet>

      <main className="min-h-screen bg-slate-50 pb-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <section className="border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-orange-100/40 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
            <p className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1 text-xs font-black text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-200">
              <Layers size={14} aria-hidden /> 無料・登録不要・3秒
            </p>
            <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              {pairTitle || 'オルカンとS&P500、どこまで重なる？'}
            </h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
              持っている（気になる）投資信託・ETFを選ぶだけ。連動指数の重なりを確認できます。金額の入力はいりません。
            </p>
          </div>
        </section>

        <div className="mx-auto mt-6 grid max-w-3xl gap-4 px-4 sm:px-6">
          {/* 選んだ商品 */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-black">選んだ商品 {selected.length}</h2>
            {selected.length === 0 ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">下のリストから2本以上選んでください。</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggle(f)}
                    className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
                    aria-label={`${f.short} を外す`}
                  >
                    {f.short}
                    <X size={12} aria-hidden />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 結果 */}
          {selected.length >= 2 && (
            <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm dark:border-orange-900/60 dark:bg-slate-900" aria-live="polite">
              <h2 className="text-lg font-black">{headline}</h2>
              <div className="mt-3 grid gap-2">
                {lines.map((l) => (
                  <div key={l.title} className="rounded-xl bg-orange-50 p-3 dark:bg-orange-950/30">
                    <p className="text-sm font-black">{l.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{l.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('overlap_check_share', { channel: 'x', n: selected.length })}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950"
                >
                  X でシェア
                </a>
                <a
                  href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('overlap_check_share', { channel: 'line', n: selected.length })}
                  className="inline-flex items-center justify-center rounded-xl bg-[#06C755] px-4 py-3 text-sm font-black text-white"
                >
                  LINEで送る
                </a>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                  {copied ? 'コピーしました' : 'リンクをコピー'}
                </button>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">シェアされるのは選んだ商品と結果だけです。金額は含まれません。</p>
            </section>
          )}

          {/* アプリへ */}
          {selected.length >= 2 && (
            <section className="rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-base font-black">保有をまとめて、重なりを毎月チェック</p>
              <p className="mt-1 text-xs font-semibold leading-6 text-slate-300">
                アプリなら証券会社の保有画面のスクリーンショット1枚で登録。資産・配当・NISA枠もひとつに。
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <a
                  href={APP_STORE_IOS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('overlap_check_app_cta', { platform: 'ios' })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white"
                >
                  iPhoneアプリ（無料） <ArrowRight size={16} aria-hidden />
                </a>
                <Link
                  to="/signup"
                  onClick={() => track('overlap_check_app_cta', { platform: 'web_signup' })}
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 px-5 py-3 text-sm font-black text-white"
                >
                  Webで無料登録
                </Link>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-slate-400">Androidアプリは公開準備中です。</p>
            </section>
          )}

          {/* 商品を選ぶ */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-black">商品を選ぶ</h2>
            <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <Search size={16} className="text-slate-400" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="商品名・指数・コードで検索（例: オルカン、S&P500、VOO）"
                className="w-full bg-transparent text-sm font-semibold outline-none"
              />
            </label>
            {!query && <p className="mt-4 text-[11px] font-black text-slate-500">よく選ばれる商品</p>}
            <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
              {(query ? [] : popular).concat(list).map((f) => {
                const on = selected.includes(f)
                return (
                  <li key={f.id}>
                    <button type="button" onClick={() => toggle(f)} className="flex w-full items-start gap-3 py-3 text-left">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                          on ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        aria-hidden
                      >
                        {on && <Check size={12} />}
                      </span>
                      <span>
                        <span className="block text-sm font-black">{f.name}</span>
                        <span className="block text-xs font-semibold text-slate-500">
                          {f.kind} · 連動指数 {f.index}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <p className="text-[11px] font-semibold leading-5 text-slate-500">{DISCLAIMER}</p>

          {/* よく見られている組み合わせ (検索ページ) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-black">よく見られている組み合わせ</h2>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {POPULAR_PAIRS.map(([a, b]) => {
                const fa = fundById(a)
                const fb = fundById(b)
                return (
                  <li key={`${a}-${b}`}>
                    <Link to={`/check/${pairSlug(a, b)}`} className="text-xs font-bold text-orange-700 hover:underline dark:text-orange-300">
                      {fa.short} と {fb.short} の重なり
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </main>
    </>
  )
}
