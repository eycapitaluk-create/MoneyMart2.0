import { Link } from 'react-router-dom'
import { ArrowRight, Gift, Sparkles, Star } from 'lucide-react'
import { CAMPAIGN_CP2026_SNS_SEP_PATH } from '../../constants/campaignCp2026SnsSep.js'
import { isCampaignCp2026SnsSepUiVisible } from '../../lib/campaignUiFlags.js'
import { trackAnalyticsEvent } from '../../lib/analytics.js'

const DECO_STARS = [
  { className: 'left-[8%] top-2', color: 'text-amber-400', size: 12, delay: '0s' },
  { className: 'left-[42%] top-1', color: 'text-orange-400', size: 10, delay: '0.35s' },
  { className: 'right-[18%] top-2', color: 'text-yellow-300', size: 11, delay: '0.7s' },
  { className: 'right-[6%] bottom-2', color: 'text-amber-300', size: 10, delay: '0.2s' },
  { className: 'left-[24%] bottom-1.5', color: 'text-orange-300', size: 9, delay: '1s' },
]

export default function CampaignHomeBanner({ userEmail = '' }) {
  if (!isCampaignCp2026SnsSepUiVisible({ userEmail, allowStaffReview: true })) return null

  return (
    <div
      className="mm-campaign-banner-flash relative mb-5 overflow-hidden rounded-2xl border-2 border-orange-400/70 dark:border-orange-500/55 bg-gradient-to-r from-orange-50 via-white to-amber-50/90 dark:from-orange-950/35 dark:via-slate-900 dark:to-amber-950/20"
      role="region"
      aria-label="SNSキャンペーンのお知らせ"
    >
      <div className="mm-campaign-banner-tint" aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-[3]" aria-hidden>
        {DECO_STARS.map((star) => (
          <span
            key={star.className}
            className={`mm-campaign-star-deco absolute ${star.className}`}
            style={{ animationDelay: star.delay }}
          >
            <Star size={star.size} className={star.color} fill="currentColor" strokeWidth={1.5} />
          </span>
        ))}
      </div>

      <div className="relative z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="mm-campaign-gift-pulse flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/30">
            <Gift size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                MoneyMart アンケート（2026年10月1日〜30日）
              </p>
              <span className="mm-campaign-live-badge inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                <Sparkles size={10} aria-hidden />
                開催中
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              抽選でAmazonギフトカード1,000円×50名 ＋ Premium 1か月利用クーポン×1000名
            </p>
          </div>
        </div>

        <Link
          to={CAMPAIGN_CP2026_SNS_SEP_PATH}
          onClick={() => trackAnalyticsEvent('campaign_home_banner_click', { campaign_id: 'cp2026_sns_oct' })}
          className="mm-campaign-cta-flash inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/40 transition hover:from-orange-600 hover:to-amber-600 sm:self-center"
        >
          <Star size={11} fill="currentColor" className="opacity-90" aria-hidden />
          キャンペーン詳細
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>

      <div className="mm-campaign-shine-overlay" aria-hidden />
    </div>
  )
}
