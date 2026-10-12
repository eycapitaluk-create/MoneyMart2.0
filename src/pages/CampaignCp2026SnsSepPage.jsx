import { useEffect, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Gift, ArrowRight } from 'lucide-react'
import {
  CAMPAIGN_CP2026_SNS_SEP_DISCLAIMERS,
  CAMPAIGN_CP2026_SNS_SEP_HASHTAG,
  CAMPAIGN_CP2026_SNS_SEP_PARTICIPATION_STEPS,
  CAMPAIGN_CP2026_SNS_SEP_ID,
  CAMPAIGN_CP2026_SNS_SEP_PATH,
  CAMPAIGN_CP2026_SNS_SEP_PRIZES,
} from '../constants/campaignCp2026SnsSep.js'
import { getCampaignCp2026SnsSepPublicPhase, isCampaignCp2026SnsSepPageAccessible } from '../lib/campaignUiFlags.js'
import CampaignCp2026SnsSepPanel from '../components/campaign/CampaignCp2026SnsSepPanel.jsx'
import CampaignCp2026PrizeLawNotice from '../components/campaign/CampaignCp2026PrizeLawNotice.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { trackAnalyticsEvent } from '../lib/analytics.js'

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref']
const CAMPAIGN_VIEW_KEY = 'mm_campaign_cp2026_view_tracked'

function isLocalAnalyticsHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
}

function campaignAuthReturnPath(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  const keep = new URLSearchParams()
  UTM_KEYS.forEach((key) => {
    const value = String(params.get(key) || '').trim().slice(0, 120)
    if (value) keep.set(key, value)
  })
  const query = keep.toString()
  return query ? `${CAMPAIGN_CP2026_SNS_SEP_PATH}?${query}` : CAMPAIGN_CP2026_SNS_SEP_PATH
}

export default function CampaignCp2026SnsSepPage({
  session = null,
  onUiMessage = null,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = session?.user || null
  const userEmail = user?.email || ''
  const applicationsOpen = isCampaignCp2026SnsSepPageAccessible({ userEmail })
  const publicPhase = getCampaignCp2026SnsSepPublicPhase()
  const analyticsPhase = publicPhase === 'before' ? 'prelaunch' : publicPhase
  const returnPath = useMemo(
    () => campaignAuthReturnPath(location.search),
    [location.search],
  )

  useDocumentTitle('MoneyMart アンケート | MoneyMart')

  useEffect(() => {
    if (isLocalAnalyticsHost()) return
    try {
      if (sessionStorage.getItem(CAMPAIGN_VIEW_KEY)) return
      sessionStorage.setItem(CAMPAIGN_VIEW_KEY, '1')
    } catch {
      /* still record one view below if storage is blocked */
    }
    trackAnalyticsEvent('campaign_view', {
      campaign_id: CAMPAIGN_CP2026_SNS_SEP_ID,
      phase: analyticsPhase,
    }, { campaignUtmOnly: true })
  }, [analyticsPhase])

  const trackCta = (stage) => {
    if (isLocalAnalyticsHost()) return
    trackAnalyticsEvent('campaign_cta', {
      campaign_id: CAMPAIGN_CP2026_SNS_SEP_ID,
      stage,
    }, { campaignUtmOnly: true })
  }

  const goPortfolioTab = (tab) => {
    navigate(`/mypage?tab=${tab}`)
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 dark:bg-slate-950 pb-16">
      <Helmet>
        <meta
          name="description"
          content="応募条件を満たした方の中から抽選で、Amazonギフトカード1,000円分を50名様、MoneyMart Premium 1か月利用クーポンを1,000名様に。"
        />
      </Helmet>

      <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-orange-950/30 border-b border-orange-100 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-10 md:py-12">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/25">
              <Gift size={28} aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-1">
                Campaign
              </p>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                MoneyMart アンケート
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                応募受付は2026年10月1日 0:00〜10月30日 23:59（JST）
              </p>
              {applicationsOpen ? null : publicPhase === 'ended' ? (
                <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                  応募受付は終了しました。受付期間は2026年10月1日 0:00〜10月30日 23:59（JST）でした。
                </p>
              ) : (
                <p className="mt-3 text-sm font-bold text-amber-800 dark:text-amber-200 leading-relaxed rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 px-3 py-2.5">
                  10月1日開始です。いまは参加条件の確認ができます。応募の送信は開始日時まで受け付けません。
                </p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              参加方法
            </h2>
            <ol className="space-y-2">
              {CAMPAIGN_CP2026_SNS_SEP_PARTICIPATION_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 min-w-0 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 text-xs font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 min-w-0 break-words">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-8">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              特典
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {CAMPAIGN_CP2026_SNS_SEP_PRIZES.map((prize) => (
                <div
                  key={prize.title}
                  className="rounded-xl border border-orange-200/80 dark:border-orange-900/40 bg-white/80 dark:bg-slate-900/60 px-4 py-3"
                >
                  <p className="text-sm font-black text-slate-900 dark:text-white">{prize.title}</p>
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mt-1">{prize.detail}</p>
                  {prize.note ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{prize.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words">
            口座・証券会社との連携は不要です。投稿には {CAMPAIGN_CP2026_SNS_SEP_HASHTAG} と画面スクリーンショットを含め、公開投稿のURLをこのページで提出してください。スクリーンショットでは氏名・口座残高・口座番号が写らないようにしてください。
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-10 space-y-6">
        {!user ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
              {applicationsOpen
                ? '応募にはログインが必要です'
                : publicPhase === 'ended'
                  ? '応募受付は終了しました'
                  : '会員登録は今からできます'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              {applicationsOpen
                ? '既存会員も、これから登録する方も、このページでアンケート・投稿URLの提出・応募まで進められます。応募の送信は2026年10月1日 0:00〜10月30日 23:59（JST）です。'
                : publicPhase === 'ended'
                  ? '参加条件の確認はできます。新規のアンケート送信・投稿URL提出・応募は受け付けていません。'
                  : '既存会員のログインも、新規の会員登録も今からできます。アンケートと投稿URLの提出、応募の送信は10月1日 0:00からです。'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                to="/login"
                state={{ from: returnPath }}
                onClick={() => trackCta('login')}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-orange-500 text-white text-sm font-black"
              >
                ログイン
                <ArrowRight size={16} aria-hidden />
              </Link>
              <Link
                to="/signup"
                state={{ from: returnPath }}
                onClick={() => trackCta('signup')}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-sm font-black text-slate-800 dark:text-slate-100"
              >
                無料登録
              </Link>
            </div>
          </div>
        ) : applicationsOpen ? (
          <CampaignCp2026SnsSepPanel
            onSwitchPortfolioTab={goPortfolioTab}
            onUiMessage={onUiMessage}
          />
        ) : null}

        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-3">ご注意</h2>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed list-none">
            {CAMPAIGN_CP2026_SNS_SEP_DISCLAIMERS.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-slate-400 shrink-0">※</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <CampaignCp2026PrizeLawNotice />
      </div>
    </div>
  )
}
