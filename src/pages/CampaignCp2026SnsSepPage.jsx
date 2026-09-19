import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Gift, ArrowRight } from 'lucide-react'
import {
  CAMPAIGN_CP2026_SNS_SEP_DISCLAIMERS,
  CAMPAIGN_CP2026_SNS_SEP_HASHTAG,
  CAMPAIGN_CP2026_SNS_SEP_PARTICIPATION_STEPS,
  CAMPAIGN_CP2026_SNS_SEP_PATH,
  CAMPAIGN_CP2026_SNS_SEP_PRIZES,
} from '../constants/campaignCp2026SnsSep.js'
import { isCampaignCp2026SnsSepPageAccessible } from '../lib/campaignUiFlags.js'
import CampaignCp2026SnsSepPanel from '../components/campaign/CampaignCp2026SnsSepPanel.jsx'
import CampaignCp2026PrizeLawNotice from '../components/campaign/CampaignCp2026PrizeLawNotice.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

export default function CampaignCp2026SnsSepPage({
  session = null,
  onUiMessage = null,
}) {
  const navigate = useNavigate()
  const user = session?.user || null
  const userEmail = user?.email || ''

  useDocumentTitle('MoneyMart アンケート | MoneyMart')

  if (!isCampaignCp2026SnsSepPageAccessible({ userEmail })) {
    return <Navigate to="/" replace />
  }

  const goPortfolioTab = (tab) => {
    navigate(`/mypage?tab=${tab}`)
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-16">
      <Helmet>
        <meta
          name="description"
          content="MoneyMart アンケート（2026年10月）。抽選でAmazonギフトカード1,000円×50名、Premium 1か月利用クーポン×1000名。"
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
                2026年10月1日〜10月30日（JST）
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              参加方法
            </h2>
            <ol className="space-y-2">
              {CAMPAIGN_CP2026_SNS_SEP_PARTICIPATION_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 text-xs font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
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

          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            口座・証券会社との連携は不要です。投稿には {CAMPAIGN_CP2026_SNS_SEP_HASHTAG} と画面スクリーンショットを含めてください。
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-10 space-y-6">
        {!user ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
              応募にはログインが必要です
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              無料会員登録後、このページでアンケート・SNS URL・応募まで進められます。
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                to="/login"
                state={{ from: CAMPAIGN_CP2026_SNS_SEP_PATH }}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-orange-500 text-white text-sm font-black"
              >
                ログイン
                <ArrowRight size={16} aria-hidden />
              </Link>
              <Link
                to="/signup"
                state={{ from: CAMPAIGN_CP2026_SNS_SEP_PATH }}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-sm font-black text-slate-800 dark:text-slate-100"
              >
                無料登録
              </Link>
            </div>
          </div>
        ) : (
          <CampaignCp2026SnsSepPanel
            onSwitchPortfolioTab={goPortfolioTab}
            onUiMessage={onUiMessage}
          />
        )}

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
