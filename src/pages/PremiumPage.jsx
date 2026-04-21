import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Activity,
  BellRing,
  CheckCircle2,
  CircleDollarSign,
  Crosshair,
  Loader2,
  PieChart,
  Sparkles,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN,
  PREMIUM_ANNUAL_PRICE_YEN,
  PREMIUM_FIRST_MONTH_PROMO_YEN,
  PREMIUM_SALE_PRICE_YEN,
} from '../lib/membership'

const BASIC_FEATURES = [
  '相場の動き・センチメント・セクター／地域ヒートマップをまとめてチェック',
  '米国株・日本株の市場データ（EOD）を確認可能',
  'ファンドを含む金融商品の比較は回数無制限',
  '月1回のポートフォリオ最適化で資産配分を見直し',
  '配当カレンダー＆アラート、最大3銘柄のウォッチリストに対応',
  '毎日の市況ニュース、NISA／FX／税金／積立シミュレーターを利用可能',
]

const PREMIUM_FEATURES = [
  '配当金：税引後をリアルタイム確認（NISA対応）',
  '配当アラート：今月の税引後入金見込みまで通知',
  'オプティマイザー：無制限実行＋結果保存',
  'ウォッチリスト：無制限＋グループ管理',
  '追加買い：目標単価から必要株数を逆算',
  'AI分析レポート：資産＋家計の総合分析',
]

/** ファンド画面の無料オプティマイザー回数（FundPage.jsx の定数と整合） */
const FREE_FUND_OPTIMIZER_RUNS_PER_MONTH = 1
const FREE_FUND_WATCHLIST_LIMIT = 3

const COMPARISON_ROWS = [
  { label: '相場・センチメント・ヒートマップ・EOD市場データ', free: 'yes', premium: 'yes' },
  { label: '金融商品の比較（ファンド等）', free: 'yes', premium: 'yes' },
  { label: 'ポートフォリオ／構成の最適化（シミュレーター実行）', free: 'partial', freeNote: `月${FREE_FUND_OPTIMIZER_RUNS_PER_MONTH}回まで`, premium: 'yes', premiumNote: '無制限' },
  { label: '最適化ウォッチセットの保存・適用・削除', free: 'no', premium: 'yes' },
  { label: 'マイページの配分セット（保存・削除）', free: 'partial', freeNote: '閲覧のみ', premium: 'yes' },
  { label: 'ファンドウォッチリスト（表示件数）', free: 'partial', freeNote: `最大${FREE_FUND_WATCHLIST_LIMIT}件`, premium: 'yes', premiumNote: '無制限' },
  { label: '配当カレンダー・配当ウォッチ（銘柄数）', free: 'partial', freeNote: '最大3銘柄', premium: 'yes', premiumNote: '無制限＋グループ' },
  { label: '配当金の税引後表示（NISA反映）', free: 'no', premium: 'yes' },
  { label: '配当アラート（税引後の入金見込みなど）', free: 'no', premium: 'yes' },
  { label: '追加買いシミュレーション', free: 'partial', freeNote: '基本表示', premium: 'yes', premiumNote: '詳細モード' },
  { label: 'ナンピン詳細シミュレーション', free: 'no', premium: 'yes' },
  { label: 'ポートフォリオ下落・上昇アラート', free: 'no', premium: 'yes' },
  { label: '家計インサイト詳細', free: 'no', premium: 'yes' },
  { label: '資産AIレポート', free: 'no', premium: 'yes' },
]

const PREMIUM_DETAIL_BLOCKS = [
  {
    icon: CircleDollarSign,
    title: '税引後の配当をいつでも把握',
    body: 'NISAの枠まで反映した受取見込みを、マイページでリアルタイムに確認できます。無料プランでは税引前中心の表示にとどまります。',
  },
  {
    icon: BellRing,
    title: '配当アラートを税引後まで',
    body: '今月の税引後入金見込みやウォッチ銘柄の動きを逃さずキャッチ。配当管理をより精密に行えます。',
  },
  {
    icon: Activity,
    title: 'ポートフォリオ下落・上昇アラート',
    body: '資産の変化に応じた通知で、見守りたい局面を取りこぼしにくくします。',
  },
  {
    icon: PieChart,
    title: 'オプティマイザー無制限＋結果の保存',
    body: `構成シミュレーターは無料で月${FREE_FUND_OPTIMIZER_RUNS_PER_MONTH}回まで。プレミアムでは回数を気にせず試行でき、ウォッチセットの保存・適用も可能です。`,
  },
  {
    icon: Crosshair,
    title: '追加買い・ナンピンの詳細モード',
    body: '目標単価から必要株数を逆算する追加買いの詳細や、ナンピン戦略の詳細シミュレーションをご利用いただけます。',
  },
  {
    icon: Sparkles,
    title: '家計インサイト詳細＆資産AIレポート',
    body: '支出傾向の深掘りに加え、資産と家計をあわせたAI分析レポートで意思決定をサポートします。',
  },
]

const CellCheck = () => (
  <span
    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"
    aria-label="利用可能"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
)

const CellDash = () => (
  <span className="text-lg font-bold text-slate-300 dark:text-slate-600" aria-label="対象外">
    —
  </span>
)

function ComparisonCell({ kind, note }) {
  // 無料でも「使える」（回数・件数・閲覧のみ等の枠内）はチェックを緑で統一（制限は下段の注記）
  if (kind === 'yes' || kind === 'partial') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 py-1"
        aria-label={kind === 'partial' ? '制限付きで利用可能' : '利用可能'}
      >
        <CellCheck />
        {note ? <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{note}</span> : null}
      </div>
    )
  }
  if (kind === 'no') return <CellDash />
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-1">
      <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 text-center leading-snug">{note || '一部'}</span>
    </div>
  )
}

function PremiumDetailBlock({ block, withBorder }) {
  if (!block) {
    return (
      <div
        className={`hidden md:block p-6 ${withBorder ? 'md:border-r border-slate-200 dark:border-slate-700' : ''}`}
        aria-hidden
      />
    )
  }
  const Icon = block.icon
  return (
    <div
      className={`flex gap-4 sm:gap-5 p-5 sm:p-6 ${withBorder ? 'md:border-r border-slate-200 dark:border-slate-700' : ''}`}
    >
      <div
        className="shrink-0 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-emerald-200/80 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40"
        aria-hidden
      >
        <Icon className="text-emerald-700 dark:text-emerald-400" size={30} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">{block.title}</h3>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{block.body}</p>
      </div>
    </div>
  )
}

const FeatureRow = ({ text }) => (
  <li className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
    <span>{text}</span>
  </li>
)

export default function PremiumPage({ session = null }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const fmtYen = (v) => Math.round(Number(v || 0)).toLocaleString('ja-JP')

  const annualSavePct = useMemo(() => {
    const yearlyByMonthly = PREMIUM_SALE_PRICE_YEN * 12
    if (yearlyByMonthly <= 0) return 0
    return Math.max(0, Math.round(((yearlyByMonthly - PREMIUM_ANNUAL_PRICE_YEN) / yearlyByMonthly) * 100))
  }, [])

  const handleSubscribe = async () => {
    setErr('')
    setOk('')
    const userId = session?.user?.id
    const userEmail = String(session?.user?.email || '').trim()
    if (!userId || !userEmail) {
      setErr('ログインが必要です。')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase
        .from('prime_waitlist')
        .insert({
          user_id: userId,
          email: userEmail,
          plan_preference: billingCycle === 'annual' ? 'yearly' : 'monthly',
          source: 'premium_page',
        })
      if (error) {
        if (error.code === '23505') {
          setOk('既にお申し込み済みです。運営からの案内をお待ちください。')
          return
        }
        throw error
      }
      setOk('プレミアム申し込みを受け付けました。ご案内までお待ちください。')
    } catch (e) {
      setErr(e?.message || '申し込み処理に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>{`MoneyMart Premium ¥${fmtYen(PREMIUM_SALE_PRICE_YEN)}/月 · 年額 ¥${fmtYen(PREMIUM_ANNUAL_PRICE_YEN)}`}</title>
        <meta
          name="description"
          content={`月額 ¥${fmtYen(PREMIUM_SALE_PRICE_YEN)}・年額 ¥${fmtYen(PREMIUM_ANNUAL_PRICE_YEN)}（月あたり約 ¥${fmtYen(PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN)}）。7日無料体験と初月 ¥${fmtYen(PREMIUM_FIRST_MONTH_PROMO_YEN)} で始められます。`}
        />
      </Helmet>

      <div className="min-h-screen bg-[#f7f7f7] dark:bg-slate-950 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <header className="mb-10 text-center">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">MoneyMart Premium</h1>
            <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              無料の Basic でも市場チェックや比較は十分に使えます。Premium は<span className="font-black text-slate-900 dark:text-white">税引後・通知・シミュレーション</span>
              を一段深く、資産管理の「次の一手」まで伴走するプランです。
            </p>
          </header>

          <section className="mb-12" aria-labelledby="premium-compare-heading">
            <h2 id="premium-compare-heading" className="sr-only">
              Basic と Premium の機能比較
            </h2>
            <p className="mb-4 text-center text-lg font-black text-slate-900 dark:text-white">機能比較一覧</p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full min-w-[520px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <th scope="col" className="px-4 py-3.5 text-left font-black text-slate-900 dark:text-white">
                      機能
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-center font-black text-slate-900 dark:text-white w-[140px] sm:w-[160px]">
                      Basic（無料）
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-center font-black text-orange-700 dark:text-orange-300 w-[140px] sm:w-[160px]">
                      Premium
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${
                        i % 2 === 0 ? 'bg-slate-50/80 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      <th scope="row" className="px-4 py-3.5 text-left font-bold text-slate-800 dark:text-slate-100 align-middle">
                        {row.label}
                      </th>
                      <td className="px-2 py-3 align-middle text-center">
                        <ComparisonCell
                          kind={row.free === 'yes' ? 'yes' : row.free === 'no' ? 'no' : 'partial'}
                          note={row.freeNote}
                        />
                      </td>
                      <td className="px-2 py-3 align-middle text-center">
                        <ComparisonCell
                          kind={row.premium === 'yes' ? 'yes' : row.premium === 'no' ? 'no' : 'partial'}
                          note={row.premiumNote}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-center text-sm font-black text-slate-900 dark:text-white">
              ほかにも使いやすさを高めるアップデートを順次ご用意する予定です。
            </p>
            <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
              * 表の回数・件数はアプリの現行仕様に基づきます。今後のリリースで変更される場合があります。
            </p>
          </section>

          <section className="mb-12" aria-labelledby="premium-detail-heading">
            <h2 id="premium-detail-heading" className="mb-2 text-center text-lg font-black text-slate-900 dark:text-white">
              Premium で深まる体験
            </h2>
            <p className="mb-6 text-center text-xs text-slate-500 dark:text-slate-400">アイコンとあわせて、代表的な差分をピックアップしています。</p>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              {Array.from({ length: Math.ceil(PREMIUM_DETAIL_BLOCKS.length / 2) }, (_, rowIdx) => {
                const left = PREMIUM_DETAIL_BLOCKS[rowIdx * 2]
                const right = PREMIUM_DETAIL_BLOCKS[rowIdx * 2 + 1]
                return (
                  <div
                    key={left?.title || rowIdx}
                    className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
                  >
                    <PremiumDetailBlock block={left} withBorder />
                    <PremiumDetailBlock block={right} withBorder={false} />
                  </div>
                )
              })}
            </div>
          </section>

          <div className="mx-auto mb-8 w-fit rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3 shadow-sm">
            <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                月額決済
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                  billingCycle === 'annual'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                年額決済
              </button>
            </div>
            <div className="mt-2 flex items-center justify-center">
              <span className="rounded-md border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-black text-orange-700 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                {annualSavePct}% 節約
              </span>
            </div>
            <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">
              年額決済なら <span className="font-black text-orange-700 dark:text-orange-300">月 ¥{fmtYen(PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN)}</span> 相当（年 ¥{fmtYen(PREMIUM_ANNUAL_PRICE_YEN)} 一括）
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8">
              <p className="text-2xl mb-3">🪴</p>
              <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Basic</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">無料で始める、毎日の投資管理</p>
              <p className="mt-8 text-5xl font-black text-slate-900 dark:text-white">¥0 <span className="text-xl text-slate-500 dark:text-slate-400">/ 月</span></p>

              <Link
                to={session ? '/mypage' : '/signup'}
                className="mt-8 inline-flex w-full min-h-[48px] items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-black text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                無料で始める
              </Link>
              <p className="mt-2 text-center text-xs text-slate-400">契約不要・すぐ利用可能</p>

              <ul className="mt-7 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                {BASIC_FEATURES.map((line) => (
                  <FeatureRow key={line} text={line} />
                ))}
              </ul>
            </section>

            <section className="relative rounded-3xl border-2 border-orange-400 bg-white dark:bg-slate-900 p-8">
              <span className="absolute top-3 right-3 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white">人気</span>
              <p className="text-2xl mb-3">🌳</p>
              <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Premium</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">税引後まで見える精密な投資管理</p>
              <p className="mt-8 text-5xl font-black text-orange-700 dark:text-orange-300">
                ¥{billingCycle === 'annual' ? PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN : PREMIUM_SALE_PRICE_YEN}
                <span className="text-xl text-slate-500 dark:text-slate-400"> / 月</span>
              </p>
              {billingCycle === 'annual' ? (
                <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                  年額 <span className="text-slate-900 dark:text-white">¥{fmtYen(PREMIUM_ANNUAL_PRICE_YEN)}</span>（一括）
                </p>
              ) : (
                <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                  年額なら <span className="text-slate-900 dark:text-white">¥{fmtYen(PREMIUM_ANNUAL_PRICE_YEN)}</span>（月あたり約 ¥{fmtYen(PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN)}）
                </p>
              )}

              {session ? (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={busy}
                  className="mt-8 inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-orange-500 text-white text-sm font-black hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={16} />}
                  7日無料体験に申し込む
                </button>
              ) : (
                <Link
                  to="/login"
                  state={{ from: '/premium' }}
                  className="mt-8 inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-orange-500 text-white text-sm font-black hover:opacity-90"
                >
                  ログインして申し込む
                </Link>
              )}
              <p className="mt-2 text-center text-xs text-slate-400">7日間すべての機能が ¥0・いつでも解約可能</p>
              <p className="mt-3 text-center text-xs font-black text-orange-700 dark:text-orange-300">
                今なら初月 ¥{PREMIUM_FIRST_MONTH_PROMO_YEN}
              </p>

              <ul className="mt-7 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                {PREMIUM_FEATURES.map((line) => (
                  <FeatureRow key={line} text={line} />
                ))}
              </ul>
            </section>
          </div>

          <section className="mx-auto mt-8 max-w-3xl">
            <p className="mb-3 text-center text-xs font-black tracking-wide text-orange-700 dark:text-orange-300">機能ミニプレビュー</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">配当金</span>
                  <span className="text-[11px] font-bold text-slate-400">プレビュー</span>
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white">税引前は無料、税引後はプレミアムで表示</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">NISA適用を反映した受取見込みはロック表示</p>
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/30 dark:text-rose-300">
                  🔒 プレミアムで確認
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">追加買い</span>
                  <span className="text-[11px] font-bold text-slate-400">プレビュー</span>
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white">目標単価から必要株数を逆算</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">無料は基本計算まで、詳細モードはプレミアム</p>
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/30 dark:text-rose-300">
                  🔒 詳細モードを解放
                </div>
              </article>
            </div>
          </section>

          {err ? (
            <p className="mt-5 text-sm font-bold text-rose-600 dark:text-rose-400 text-center">{err}</p>
          ) : null}
          {ok ? (
            <p className="mt-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-center">{ok}</p>
          ) : null}
          <p className="mt-8 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
            ※ 特商法・利用規約の表記は既存の法務ページに準拠します。提供条件・開始時期は案内時点の内容に準拠します。
          </p>
        </div>
      </div>
    </>
  )
}
