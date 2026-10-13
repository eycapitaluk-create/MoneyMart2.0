import { Fragment, useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Activity,
  BarChart2,
  Bell,
  BellRing,
  BookMarked,
  Bot,
  CheckCircle2,
  Calendar,
  CircleDollarSign,
  Globe,
  Headphones,
  LayoutGrid,
  LineChart,
  ListTree,
  PieChart,
  RefreshCw,
  Save,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  User,
} from 'lucide-react'
import {
  PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN,
  PREMIUM_ANNUAL_PRICE_INCL_TAX_YEN,
  PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN,
  PREMIUM_SALE_PRICE_YEN,
  PREMIUM_TRIAL_DAYS,
  hasPremiumEntitlement,
  isPremiumTrialActive,
} from '../lib/membership'
import { cancelPayjpPremiumSubscription } from '../lib/billingClient'
import PayjpPremiumCheckout from '../components/billing/PayjpPremiumCheckout'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import { APP_STORE_IOS_URL } from '../constants/appStore'
import { PAYJP_WEB_CARD_BRANDS_LABEL } from '../constants/payjpBillingFaq'
import { trackAnalyticsEvent } from '../lib/analytics'

/** ファンド画面の無料オプティマイザー回数（FundPage.jsx の定数と整合） */
const FREE_FUND_OPTIMIZER_RUNS_PER_MONTH = 1
const FREE_FUND_WATCHLIST_LIMIT = 3

const COMPARISON_ROWS = [
  { label: '相場・センチメント、ヒートマップ、EOD 市場データ', rowIcon: LayoutGrid, free: 'yes', premium: 'yes' },
  { label: '金融商品の比較（ファンド・ETF 等）', rowIcon: BarChart2, free: 'yes', premium: 'yes' },
  { label: '配分シミュレーション（実行回数）', rowIcon: SlidersHorizontal, free: 'partial', freeNote: `月${FREE_FUND_OPTIMIZER_RUNS_PER_MONTH}回まで`, premium: 'yes', premiumNote: '無制限' },
  { label: '配分シミュレーションの「ウォッチセット」：保存・削除', rowIcon: Save, free: 'no', freeNote: '使い捨て試算のみ', premium: 'yes', premiumNote: '保存可能' },
  { label: 'マイページの目標配分プリセット（配分セット）', rowIcon: PieChart, free: 'partial', freeNote: '表示のみ', premium: 'yes', premiumNote: '保存・上書・削除' },
  { label: 'ファンドウォッチリスト（登録本数）', rowIcon: ListTree, free: 'partial', freeNote: `最大${FREE_FUND_WATCHLIST_LIMIT}本`, premium: 'yes', premiumNote: '無制限' },
  { label: '配当カレンダー・配当ウォッチ（登録銘柄数）', rowIcon: Calendar, free: 'partial', freeNote: '最大3銘柄', premium: 'yes', premiumNote: '無制限＋グループ' },
  { label: '配当の税引後（手取り）表示・NISA 反映', rowIcon: BookMarked, free: 'no', premium: 'yes' },
  { label: '配当アラート（手取りベースの入金試算等）', rowIcon: Bell, free: 'no', premium: 'yes' },
  {
    label: 'マイページ（株式）：追加買い・平均取得単価計算',
    rowIcon: LineChart,
    free: 'no',
    freeNote: 'プレミアム',
    premium: 'yes',
    premiumNote: '目標平均・数量で試算',
  },
  { label: 'ポートフォリオ下落・上昇アラート', rowIcon: BellRing, free: 'no', premium: 'yes' },
  { label: '資産＋家計の AI レポート', rowIcon: Sparkles, free: 'no', premium: 'yes' },
]

const COMPARISON_SECTIONS = [
  { id: 'market', title: '市場', shortLabel: '市場', subtitle: 'ヒートマップ・EOD 等', sectionIcon: Globe },
  { id: 'product', title: '商品比較', shortLabel: '比較', subtitle: 'ファンド・ETF', sectionIcon: PieChart },
  { id: 'optimizer', title: '配分・連携', shortLabel: '配分', subtitle: 'シム・保存・配分', sectionIcon: SlidersHorizontal },
  { id: 'dividend', title: '配当', shortLabel: '配当', subtitle: 'カレンダー・手取り', sectionIcon: CircleDollarSign },
  { id: 'mypage', title: 'マイページ', shortLabel: 'マイページ', subtitle: '株式・試算', sectionIcon: User },
  { id: 'alerts', title: 'アラート・分析', shortLabel: '分析', subtitle: '通知・AI', sectionIcon: Activity },
]

/** 各 COMPARISON_SECTIONS 行に対応する COMPARISON_ROWS の index（重複なし） */
const ROW_INDEX_BY_SECTION = [
  [0],
  [1],
  [2, 3, 4, 5],
  [6, 7, 8],
  [9],
  [10, 11],
]

const RECOMMENDATION_CARDS = [
  {
    icon: Target,
    title: 'より深く分析したい方',
    body: 'ヒートマップやシミュレーションで、情報整理をサポートします。',
    iconGradient: 'from-orange-500 to-amber-500 shadow-orange-500/25',
  },
  {
    icon: LineChart,
    title: '配分を比べたい方',
    body: 'シミュレーションと保存機能で、配分を見比べられます。',
    iconGradient: 'from-blue-500 to-indigo-600 shadow-blue-500/25',
  },
  {
    icon: Bell,
    title: '重要な情報を見逃したくない方',
    body: 'アラートで市場の変化を即時に把握できます。',
    iconGradient: 'from-orange-500 to-amber-500 shadow-orange-500/25',
  },
  {
    icon: PieChart,
    title: 'データに基づいて判断したい方',
    body: 'AIレポートで検討材料を整理しやすくします。',
    iconGradient: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
  },
]

const PREMIUM_CORE_BENEFIT_CARDS = [
  {
    icon: BarChart2,
    title: '配分シミュを無制限に',
    body: '回数無制限のシミュレーションで、資産配分の試算を継続的に比較できます。',
    iconGradient: 'from-orange-500 to-amber-500 shadow-orange-500/25',
    bullets: null,
  },
  {
    icon: Bot,
    title: 'AI 詳細分析レポート',
    body: '保有銘柄・市場の流れ・リスク要因を、AI がひとめで整理します。',
    iconGradient: 'from-blue-500 to-indigo-600 shadow-blue-500/25',
    bullets: null,
  },
  {
    icon: Bell,
    title: '条件に応じた通知',
    body: null,
    iconGradient: 'from-orange-500 to-amber-500 shadow-orange-500/25',
    bullets: ['ポートフォリオの急騰・急落通知', '配当日程の通知', '重要な市場変化の通知'],
  },
  {
    icon: Target,
    title: '追加購入シミュレーション',
    body: '追加購入の数量・平均取得単価の変化を試算できます。',
    iconGradient: 'from-orange-500 to-amber-500 shadow-orange-500/25',
    bullets: null,
  },
  {
    icon: Star,
    title: 'ウォッチリスト無制限',
    body: '株式・ETF・ファンドを登録上限なくフォローし続けられます。',
    iconGradient: 'from-orange-500 to-amber-500 shadow-orange-500/25',
    bullets: null,
  },
]

/** 料金セクション右列（信頼の根拠） */
const TRUST_PILLARS = [
  {
    icon: Shield,
    title: 'データは安全に保護されています',
    body: '通信暗号化などの安全管理措置により、データ保護に努めています。',
  },
  {
    icon: RefreshCw,
    title: 'いつでも解約可能',
    body: '契約期間の縛りはありません。いつでも解約できます。',
  },
  {
    icon: Calendar,
    title: '7日間無料体験',
    body: 'Premium のすべての機能を7日間無料でお試しいただけます。',
  },
  {
    icon: Headphones,
    title: 'サポート対応あり',
    body: 'ご不明点はお問い合わせ窓口で順次対応します。',
  },
]

/** 料金カード用の短い箇条書き（LP デザイン準拠） */
const PRICING_BASIC_BULLETS = [
  '市場・株式モニタリング',
  'ウォッチリスト（最大3銘柄）',
  'お気に入り銘柄（最大3件）',
  '基本レポート',
]

const PRICING_PREMIUM_BULLETS = [
  'すべての Basic 機能',
  '資産配分シミュレーション無制限',
  'ウォッチリスト無制限',
  'AI 詳細分析レポート',
  '価格変動・配当・資産アラート',
  '配当カレンダー無制限など',
]

const CellCheck = ({ variant = 'orange' }) => (
  <span
    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm ${
      variant === 'orange' ? 'bg-gradient-to-br from-orange-500 to-amber-500' : 'bg-slate-400 dark:bg-slate-600'
    }`}
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

function ComparisonCell({ kind, note, checkVariant = 'orange' }) {
  if (kind === 'yes' || kind === 'partial') {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 py-1"
        aria-label={kind === 'partial' ? '制限付きで利用可能' : '利用可能'}
      >
        <CellCheck variant={checkVariant} />
        {note ? <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center max-w-[10rem] leading-tight">{note}</span> : null}
      </div>
    )
  }
  if (kind === 'no') {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-1" aria-label="未対象">
        <CellDash />
        {note ? <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center max-w-[9rem] leading-tight">{note}</span> : null}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-1">
      <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 text-center leading-snug">{note || '一部'}</span>
    </div>
  )
}

const FeatureRow = ({ text, dense }) => (
  <li
    className={`flex items-start gap-2 ${dense ? 'gap-2 text-[12px] leading-snug sm:text-[13px]' : 'gap-2.5 text-sm'} text-slate-700 dark:text-slate-200`}
  >
    <CheckCircle2 size={dense ? 15 : 16} className="mt-0.5 shrink-0 text-orange-500" aria-hidden />
    <span>{text}</span>
  </li>
)

/** LP ヒーロー用の単体 SVG（ノート外型＋抽象 UI）。実銘柄・実数値は含まない */
function PremiumHeroDeviceMockups() {
  const uid = useId().replace(/:/g, '')
  const gidLine = `ph-line-${uid}`
  const gidFill = `ph-fill-${uid}`
  const heatRects = useMemo(() => {
    const fills = ['#34d399cc', '#f87171cc', '#4ade80aa', '#64748bcc', '#10b981bb']
    const out = []
    let k = 0
    const x0 = 44
    const y0 = 56
    const cw = 12
    const ch = 10
    const g = 2.5
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        out.push({
          key: `h-${row}-${col}`,
          x: x0 + col * (cw + g),
          y: y0 + row * (ch + g),
          w: cw,
          h: ch,
          fill: fills[k % fills.length],
        })
        k += 1
      }
    }
    return out
  }, [])
  return (
    <div
      className="relative mx-auto h-[11.5rem] w-full min-w-[min(100%,220px)] max-w-full sm:h-[11.75rem] lg:ml-auto"
      aria-hidden
    >
      <svg
        className="h-full w-full max-h-[11.75rem] drop-shadow-[0_22px_40px_-16px_rgba(15,23,42,0.45)]"
        viewBox="0 0 320 164"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 底座 */}
        <ellipse cx="160" cy="152" rx="118" ry="9" className="fill-slate-400/35 dark:fill-slate-600/50" />
        <path
          className="fill-slate-300 dark:fill-slate-700"
          d="M42 146 C42 146 278 146 278 146 C289 146 296 140 294 134 L274 138 L46 138 L26 134 C24 140 31 146 42 146 Z"
        />
        {/* アウター筐体 */}
        <rect x="22" y="22" width="276" height="116" rx="11" className="fill-slate-200 stroke-slate-400/90 dark:fill-slate-800 dark:stroke-slate-500" strokeWidth="1.25" />
        {/* ディスプレイ */}
        <rect x="31" y="31" width="258" height="98" rx="6" className="fill-slate-950 stroke-slate-700/95 dark:stroke-slate-600" strokeWidth="1" />
        {/* OS クローム */}
        <circle cx="44" cy="43" r="3" className="fill-rose-400/95" />
        <circle cx="56" cy="43" r="3" className="fill-amber-400/95" />
        <circle cx="68" cy="43" r="3" className="fill-emerald-500/90" />
        {/* ヒート簡略グリッド */}
        {heatRects.map((r) => (
          <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} rx="1.2" fill={r.fill} />
        ))}
        {/* 区切り */}
        <line x1="150" y1="52" x2="150" y2="118" className="stroke-slate-700/85 dark:stroke-slate-600/90" strokeWidth="0.85" opacity="0.65" />
        {/* グラフ */}
        <defs>
          <linearGradient id={gidFill} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(249,115,22,0.08)" />
            <stop offset="100%" stopColor="rgba(251,191,36,0.32)" />
          </linearGradient>
          <linearGradient id={gidLine} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(234,88,12)" />
            <stop offset="100%" stopColor="rgb(251,191,36)" />
          </linearGradient>
        </defs>
        <path
          d="M164 106 L174 96 L184 102 L194 82 L206 92 L218 74 L228 82 L246 62 L274 74 L274 118 L164 118 Z"
          fill={`url(#${gidFill})`}
        />
        <path
          d="M164 106 L174 96 L184 102 L194 82 L206 92 L218 74 L228 82 L246 62 L274 74"
          stroke={`url(#${gidLine})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* 下端ハイライト */}
        <path
          className="fill-white dark:fill-slate-500/25"
          opacity="0.12"
          d="M32 134 H288 Q288 139 284 139 H36 Q32 139 32 134 Z"
        />
      </svg>
    </div>
  )
}

export default function PremiumPage({ session = null, userProfile = null }) {
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelMessage, setCancelMessage] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [checkoutSuccess, setCheckoutSuccess] = useState('')

  const accessToken = session?.access_token || ''
  const premiumTrialEndsRaw = userProfile?.premiumTrialEndsAt ?? userProfile?.premium_trial_ends_at ?? null
  const isPaidSubscriber = hasPremiumEntitlement({
    planTier: String(userProfile?.planTier || '').toLowerCase(),
    premiumTrialEndsAt: premiumTrialEndsRaw,
  })

  const fmtYen = (v) => Math.round(Number(v || 0)).toLocaleString('ja-JP')

  const annualSavePct = useMemo(() => {
    const yearlyByMonthlyIncl = PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN * 12
    if (yearlyByMonthlyIncl <= 0) return 0
    return Math.max(
      0,
      Math.round(((yearlyByMonthlyIncl - PREMIUM_ANNUAL_PRICE_INCL_TAX_YEN) / yearlyByMonthlyIncl) * 100),
    )
  }, [])

  const trialActive = isPremiumTrialActive(premiumTrialEndsRaw)
  const trialEndsJa = trialActive && premiumTrialEndsRaw
    ? new Date(premiumTrialEndsRaw).toLocaleString('ja-JP', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Tokyo',
    })
    : ''

  const handleCancelPayjp = async () => {
    if (!accessToken || cancelLoading) return
    if (!window.confirm('次回更新を停止します。現在の契約期間終了までは Premium をご利用いただけます。よろしいですか？')) return
    setCancelLoading(true)
    setCancelError('')
    setCancelMessage('')
    try {
      await cancelPayjpPremiumSubscription(accessToken)
      setCancelMessage('次回更新を停止しました。ページを再読み込みすると反映されます。')
    } catch (e) {
      setCancelError(String(e?.message || e || '解約に失敗しました'))
    } finally {
      setCancelLoading(false)
    }
  }

  useEffect(() => {
    trackAnalyticsEvent('premium_page_intent', {
      logged_in: Boolean(session),
      is_premium: isPaidSubscriber,
    })
  }, [session, isPaidSubscriber])

  return (
    <>
      <Helmet>
        <title>{`MoneyMart Premium 月額 ¥${fmtYen(PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN)}（税込）・年額 ¥${fmtYen(PREMIUM_ANNUAL_PRICE_INCL_TAX_YEN)}（税込）`}</title>
        <meta
          name="description"
          content={`月額 ¥${fmtYen(PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN)}（税込）・年額 ¥${fmtYen(PREMIUM_ANNUAL_PRICE_INCL_TAX_YEN)}（税込、月換算約 ¥${fmtYen(PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN)}）。手取り配当の確認、配分シミュレーションの保存、資産・家計のAI参考レポート。新規登録から${PREMIUM_TRIAL_DAYS}日間は Premium 機能を無料でご利用いただけます。`}
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-[#f4f6f8] to-[#f4f6f8] dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
        <div className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/90 to-[#f3f6f9] dark:border-slate-800/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
          <div
            className="pointer-events-none absolute -right-20 top-[-10%] h-[clamp(14rem,32vw,24rem)] w-[clamp(14rem,32vw,24rem)] rounded-full bg-emerald-400/[0.12] blur-3xl dark:bg-emerald-500/10"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-indigo-400/[0.08] blur-3xl dark:bg-indigo-500/10"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTR2Ni00eiIgZmlsbD0iIzM0NzQ5NSIgZmlsbC1vcGFjaXR5PSIuMDUiLz48L2c+PC9zdmc+')] opacity-[0.08] dark:opacity-[0.12]"
            aria-hidden
          />
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-10 sm:py-12 lg:py-14">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
              <div className="text-center lg:col-span-6 lg:text-left">
                <p className="text-[12px] font-black uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400 sm:text-[13px]">
                  MoneyMart
                </p>
                <h1 className="mt-1.5 text-4xl font-black tracking-tight text-orange-600 sm:text-5xl sm:leading-[1.08] dark:text-orange-400">
                  Premium
                </h1>
                <div className="mx-auto mt-4 max-w-xl space-y-3 text-base font-semibold leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[17px] sm:leading-relaxed lg:mx-0 lg:max-w-none lg:text-lg">
                  <p>Basic は毎日の相場チェックに十分。</p>
                  <p>Premium は手取り配当の確認・配分シミュレーションの保存・資産アラート &amp; AI参考レポートまで、情報整理をまとめて支えます。</p>
                </div>
              </div>
              <div className="flex w-full min-w-0 justify-center lg:col-span-6 lg:justify-end">
                <div className="w-full max-w-[28rem] shrink-0 sm:max-w-[30rem] lg:max-w-[min(100%,36rem)]">
                  <PremiumHeroDeviceMockups />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-10">
          <section className="mb-10 lg:mb-12" aria-labelledby="premium-compare-heading">
            <h2 id="premium-compare-heading" className="text-center text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              プラン比較
            </h2>
            <p className="mt-2 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              無料（Basic）と Premium の機能差を、カテゴリ別に一覧しています。閲覧・比較の土台は Basic にも揃っており、課金価値は Premium の強みである手取り・制限解除・深い分析に集中します。
            </p>
            <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-orange-200/80 dark:border-orange-900/50 bg-white dark:bg-slate-900 shadow-lg shadow-orange-500/5">
              <table className="w-full min-w-[640px] text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                    <th scope="col" className="px-2 py-3.5 text-center font-black w-[5.5rem] sm:w-[6.5rem] border-b border-b-orange-400/30 border-r border-r-white/25">
                      カテゴリ
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left font-black min-w-[12rem] border-b border-b-orange-400/30">
                      項目
                    </th>
                    <th scope="col" className="px-2 py-3.5 text-center font-black w-[120px] sm:w-[140px] border-b border-b-orange-400/30">
                      Basic（無料）
                    </th>
                    <th scope="col" className="px-2 py-3.5 text-center font-black w-[120px] sm:w-[140px] border-b border-b-orange-400/30">
                      Premium
                    </th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child]:border-b-0">
                  {COMPARISON_SECTIONS.map((section, si) => {
                    const idxs = ROW_INDEX_BY_SECTION[si] || []
                    const uniqueIdx = [...new Set(idxs)]
                    const rowCount = uniqueIdx.length
                    const SecIcon = section.sectionIcon
                    return (
                      <Fragment key={section.id}>
                        {uniqueIdx.map((ri, rowInSection) => {
                          const row = COMPARISON_ROWS[ri]
                          if (!row) return null
                          const RowIc = row.rowIcon
                          const isFirstInSection = rowInSection === 0
                          const isSectionStart = isFirstInSection && si > 0
                          return (
                            <tr
                              key={`row-${ri}-${row.label}`}
                              className={[
                                'border-b border-slate-200/95 dark:border-slate-600/90 bg-white dark:bg-slate-900',
                                isSectionStart
                                  ? 'border-t-2 border-t-orange-200/80 dark:border-t-orange-800/60'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {isFirstInSection ? (
                                <th
                                  scope="rowgroup"
                                  rowSpan={rowCount}
                                  className="w-[5.5rem] sm:w-[6.5rem] align-middle border-r border-orange-200 dark:border-orange-800/50 bg-gradient-to-b from-orange-50/95 to-amber-50/40 dark:from-orange-950/30 dark:to-orange-950/20 px-2 py-4"
                                >
                                  <div className="flex min-h-0 w-full max-w-[5.5rem] mx-auto flex-col items-center justify-center gap-2 text-center">
                                    <span className="inline-flex h-10 w-10 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 border border-orange-200/90 dark:border-orange-800/60 shadow-sm">
                                      <SecIcon size={20} strokeWidth={1.75} aria-hidden />
                                    </span>
                                    <span className="text-[10px] sm:text-[11px] font-black text-orange-950 dark:text-orange-100 leading-tight">
                                      {section.shortLabel}
                                    </span>
                                    <span className="text-[8px] sm:text-[9px] font-bold text-orange-800/90 dark:text-orange-300/95 leading-[1.35] tracking-tight">
                                      {section.subtitle}
                                    </span>
                                  </div>
                                </th>
                              ) : null}
                              <th
                                scope="row"
                                className="min-w-0 max-w-md border-r border-slate-200/90 px-3 py-[0.9rem] text-left font-bold text-slate-800 dark:text-slate-100 align-middle dark:border-slate-600/50"
                              >
                                <div className="flex items-start gap-2.5">
                                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-200/60 bg-orange-100/80 dark:border-orange-800/50 dark:bg-orange-950/45 text-orange-600 dark:text-orange-400">
                                    <RowIc size={16} strokeWidth={2} aria-hidden />
                                  </span>
                                  <span className="text-[12px] sm:text-[13px] font-bold leading-[1.45] text-slate-800 dark:text-slate-100">
                                    {row.label}
                                  </span>
                                </div>
                              </th>
                              <td className="border-r border-slate-200/80 px-2 py-[0.9rem] text-center align-middle dark:border-slate-600/45">
                                <ComparisonCell
                                  kind={row.free === 'yes' ? 'yes' : row.free === 'no' ? 'no' : 'partial'}
                                  note={row.freeNote}
                                  checkVariant="slate"
                                />
                              </td>
                              <td className="px-2 py-[0.9rem] align-middle text-center border-l border-orange-200/50 bg-orange-50/70 dark:border-orange-900/40 dark:bg-orange-950/25">
                                <ComparisonCell
                                  kind={row.premium === 'yes' ? 'yes' : row.premium === 'no' ? 'no' : 'partial'}
                                  note={row.premiumNote}
                                  checkVariant="orange"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
              * 回数・件数はアプリの現行仕様に基づきます。今後、リリース内容により変更される場合があります。
            </p>
          </section>

          <section
            className="mb-10 lg:mb-12 rounded-2xl border border-slate-200/90 bg-[#fbfbf9] px-4 py-8 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40 sm:px-6 sm:py-10"
            aria-labelledby="premium-core-benefits-heading"
          >
            <h2
              id="premium-core-benefits-heading"
              className="text-center text-lg font-black text-orange-600 sm:text-xl dark:text-orange-400"
            >
              Premium の核心特典
            </h2>
            <div className="mx-auto mt-6 grid max-w-7xl grid-cols-1 items-stretch gap-x-4 gap-y-5 md:grid-cols-2 md:gap-x-5 md:gap-y-6 xl:grid-cols-5 xl:gap-x-4">
              {PREMIUM_CORE_BENEFIT_CARDS.map((c) => {
                const Ic = c.icon
                const grad = c.iconGradient || 'from-orange-500 to-amber-500 shadow-orange-500/25'
                const copyClass =
                  'text-[12px] leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[13px]'
                return (
                  <article
                    key={c.title}
                    className="flex min-h-0 h-full flex-col rounded-xl border border-slate-200/90 bg-white px-4 py-5 shadow-sm dark:border-slate-700/90 dark:bg-slate-950/80 sm:px-[1.125rem]"
                  >
                    <div
                      className={`mx-auto mb-3.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${grad}`}
                      aria-hidden
                    >
                      <Ic size={24} strokeWidth={2} />
                    </div>
                    <h3 className="mb-px flex min-h-[2.875rem] items-center justify-center px-1 text-center text-[13px] font-black leading-snug tracking-tight text-slate-900 text-balance [word-break:keep-all] sm:min-h-[3rem] sm:text-[14px] dark:text-white">
                      {c.title}
                    </h3>
                    <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-y-2">
                      {c.body ? (
                        <p className={`flex-1 text-pretty text-center ${copyClass}`}>{c.body}</p>
                      ) : null}
                      {c.bullets?.length ? (
                        <ul className={`flex-1 space-y-1 text-left ${copyClass}`}>
                          {c.bullets.map((line) => (
                            <li key={line} className="flex gap-2 leading-relaxed">
                              <span className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-orange-400" aria-hidden />
                              <span className="min-w-0">{line}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="mb-10" aria-labelledby="premium-picks-heading">
            <h2
              id="premium-picks-heading"
              className="text-center text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white"
            >
              Premiumはこんな方に向いています
            </h2>
            <div className="mx-auto mt-6 grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
              {RECOMMENDATION_CARDS.map((c) => {
                const Ic = c.icon
                const grad = c.iconGradient || 'from-orange-500 to-amber-500 shadow-orange-500/25'
                return (
                  <article
                    key={c.title}
                    className="flex items-start gap-4 rounded-xl border border-slate-200/95 bg-[#fafafa] p-5 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95"
                  >
                    <div
                      className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${grad} sm:h-12 sm:w-12`}
                      aria-hidden
                    >
                      <Ic size={22} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black leading-snug text-slate-900 dark:text-white sm:text-[15px]">
                        {c.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[13px]">
                        {c.body}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="mb-12" aria-labelledby="premium-pricing-heading">
            <h2 id="premium-pricing-heading" className="text-center text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              料金
            </h2>
            <p className="mt-2 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              月額・年額を切り替えて比較できます。年額は一括払いで月額換算がお得になります。
            </p>

            <div className="mx-auto mt-6 mb-6 w-full max-w-xl rounded-2xl border-2 border-orange-200/80 dark:border-orange-800/50 bg-white dark:bg-slate-900 px-3 py-3 shadow-md">
              <p className="text-center text-[11px] font-black text-orange-600 dark:text-orange-400 mb-2">支払いサイクル</p>
              <div className="inline-flex w-full items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${
                    billingCycle === 'monthly'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  月額
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${
                    billingCycle === 'annual'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  年額
                </button>
              </div>
              <div className="mt-2 flex items-center justify-center">
                <span className="rounded-md border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-black text-orange-700 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                  年額は約 {annualSavePct}% お得
                </span>
              </div>
              <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                年額 ¥{fmtYen(PREMIUM_ANNUAL_PRICE_INCL_TAX_YEN)}（税込）、月額 ¥{fmtYen(PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN)}（税込）のところ、月換算{' '}
                <span className="font-black text-orange-600 dark:text-orange-400">¥{fmtYen(PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN)}</span>
                とお得
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-stretch">
              <section className="flex h-full flex-col xl:col-span-3 xl:min-h-0 rounded-3xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Basic（無料）</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  基本機能を無料でご利用いただけます。
                </p>
                <p className="mt-6 text-4xl sm:text-5xl font-black text-slate-900 dark:text-white">
                  ¥0 <span className="text-lg text-slate-500 dark:text-slate-400">/ 月</span>
                </p>

                <Link
                  to={session ? '/mypage' : '/signup'}
                  className="mt-6 inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  無料で始める
                </Link>

                <ul className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                  {PRICING_BASIC_BULLETS.map((line) => (
                    <FeatureRow key={line} text={line} dense />
                  ))}
                </ul>
                <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  ※ 一部機能に制限があります。
                </p>
              </section>

              <section className="relative flex h-full flex-col overflow-visible xl:col-span-5 xl:min-h-0 rounded-3xl border-2 border-orange-400 dark:border-orange-500 bg-gradient-to-b from-white to-orange-50/30 dark:from-slate-900 dark:to-orange-950/20 p-5 sm:p-8 shadow-xl shadow-orange-500/15">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2.5 py-1 text-[10px] font-black text-white shadow">
                    人気
                  </span>
                  <span className="max-w-[11rem] shrink rounded-full bg-orange-100 px-2.5 py-1 text-center text-[9px] font-black leading-tight text-orange-800 shadow-sm ring-1 ring-orange-200/80 dark:bg-orange-950/70 dark:text-orange-200 dark:ring-orange-800/60 sm:max-w-none sm:text-[10px]">
                    年間払いで {annualSavePct}%お得
                  </span>
                </div>

                <h3 className="text-xl font-black tracking-tight text-orange-600 dark:text-orange-400 sm:text-2xl">
                  Premium（有料）
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pr-2">
                  手取りベースでの分析・管理により、検討材料をより整理しやすくなります。
                </p>
                <p className="mt-6 text-4xl sm:text-5xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent tabular-nums dark:from-orange-400 dark:to-amber-300">
                  ¥{fmtYen(billingCycle === 'annual' ? PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN : PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN)}
                  <span className="text-lg text-slate-500 dark:text-slate-400"> / 月</span>
                  <span className="block sm:inline sm:ml-1 text-lg font-black text-orange-600 dark:text-orange-400">（税込）</span>
                </p>
                {billingCycle === 'annual' ? (
                  <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
                    年額一括 ¥{fmtYen(PREMIUM_ANNUAL_PRICE_INCL_TAX_YEN)}（税込）・月あたり換算 ¥{fmtYen(PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN)}（税込）
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
                    月額 ¥{fmtYen(PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN)}（税込）・本体価格 ¥{fmtYen(PREMIUM_SALE_PRICE_YEN)}（税抜）
                  </p>
                )}

                <div className="mt-6 space-y-3 rounded-xl border border-orange-200/70 bg-orange-50/40 px-4 py-3.5 dark:border-orange-800/50 dark:bg-orange-950/25">
                  <p className="text-center text-sm font-bold leading-relaxed text-slate-800 dark:text-slate-100">
                    新規アカウント登録から
                    <span className="text-orange-600 dark:text-orange-400">{PREMIUM_TRIAL_DAYS}日間</span>
                    は Premium の全機能を無料でご利用いただけます。お試し終了後はご契約が必要です。
                  </p>
                  {trialActive && trialEndsJa ? (
                    <p className="text-center text-xs font-black text-orange-700 dark:text-orange-300">
                      現在お試し利用中（{trialEndsJa} まで）
                    </p>
                  ) : null}
                  {!session ? (
                    <p className="text-center text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                      <Link
                        to="/signup"
                        state={{ from: '/premium' }}
                        className="font-black text-orange-600 underline underline-offset-2 dark:text-orange-400"
                      >
                        無料登録
                      </Link>
                      {' · '}
                      <Link
                        to="/login"
                        state={{ from: '/premium' }}
                        className="font-black text-orange-600 underline underline-offset-2 dark:text-orange-400"
                      >
                        ログイン
                      </Link>
                    </p>
                  ) : null}
                </div>

                {session && isPaidSubscriber ? (
                  <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <p className="text-sm font-black text-emerald-800 dark:text-emerald-200 text-center">
                      Premium 契約中
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-700/90 dark:text-emerald-300/90 text-center leading-relaxed">
                      Web（PAY.JP）でお申し込みの場合は下のボタンから次回更新を停止できます。App Store 経由の場合は Apple ID のサブスクリプション設定から解約してください。
                    </p>
                    <button
                      type="button"
                      onClick={handleCancelPayjp}
                      disabled={cancelLoading}
                      className="mt-3 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200"
                    >
                      {cancelLoading ? '処理中…' : '次回更新を停止（Web・PAY.JP）'}
                    </button>
                    {cancelMessage ? (
                      <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 text-center">{cancelMessage}</p>
                    ) : null}
                    {cancelError ? (
                      <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 text-center">{cancelError}</p>
                    ) : null}
                  </div>
                ) : null}

                {session && !isPaidSubscriber ? (
                  <div className="payjp-premium-checkout mt-4 w-full min-w-0 overflow-visible rounded-xl border border-orange-300/70 bg-white/90 px-3 py-4 sm:px-4 dark:border-orange-800/60 dark:bg-slate-900/80">
                    <p className="mb-1 text-center text-sm font-black text-gray-900 dark:text-white">
                      クレジットカードで申し込む（Web）
                    </p>
                    <p className="mb-3 text-center text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {PAYJP_WEB_CARD_BRANDS_LABEL}
                    </p>
                    <PayjpPremiumCheckout
                      accessToken={accessToken}
                      billingCycle={billingCycle}
                      onSuccess={() => {
                        setCheckoutSuccess('Premium のお申し込みが完了しました。反映まで数秒お待ちください。')
                        window.setTimeout(() => window.location.reload(), 1500)
                      }}
                    />
                    {checkoutSuccess ? (
                      <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 text-center">{checkoutSuccess}</p>
                    ) : null}
                  </div>
                ) : null}

                <p className="mt-3 text-center text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  お試しはカード登録なし。ご契約後のお支払いは Web（PAY.JP）または{' '}
                  <a
                    href={APP_STORE_IOS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-black text-orange-600 underline underline-offset-2 dark:text-orange-400"
                  >
                    App Store（自動更新）
                  </a>
                  。解約・請求の管理は各プラットフォームの手続きに従ってください。詳細は{' '}
                  <Link to="/legal/commerce" className="font-bold text-slate-600 underline underline-offset-2 hover:text-orange-600 dark:text-slate-300 dark:hover:text-orange-400">
                    特定商取引法に基づく表記
                  </Link>
                  をご確認ください。
                </p>

                <ul className="mt-6 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-orange-200/60 pt-4 dark:border-orange-800/50 sm:grid-cols-2">
                  {PRICING_PREMIUM_BULLETS.map((line) => (
                    <FeatureRow key={line} text={line} dense />
                  ))}
                </ul>
              </section>

              <aside className="relative mt-6 flex w-full min-w-0 flex-col gap-3 xl:col-span-4 xl:mt-0 xl:h-full xl:min-h-0 xl:gap-3">
                {TRUST_PILLARS.map((t) => {
                  const Ic = t.icon
                  return (
                    <div
                      key={t.title}
                      className="flex min-h-[4rem] w-full min-w-0 shrink-0 items-start gap-3 rounded-xl border border-slate-200/95 bg-white px-4 py-3.5 dark:border-slate-700/90 dark:bg-slate-900 sm:py-4"
                    >
                      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
                        <Ic size={20} strokeWidth={2} aria-hidden />
                      </div>
                      <div className="min-w-0 flex flex-1 flex-col gap-1 pt-0.5">
                        <p className="break-words text-[13px] font-black leading-snug text-slate-900 dark:text-white sm:text-sm">
                          {t.title}
                        </p>
                        <p className="break-words text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 sm:text-xs">
                          {t.body}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </aside>
            </div>

            <p className="mt-8 max-w-3xl mx-auto text-center text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              ※ Premium機能は情報整理・記録・通知・シミュレーションを補助するツールです。投資助言・投資運用・売買の勧誘を行うものではありません。{LEGAL_NOTICE_TEMPLATES.investment}
              <br />
              ※ サービスの改善のため、一部の機能や仕様を変更する場合があります。
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
