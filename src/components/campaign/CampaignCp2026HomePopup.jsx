import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { CAMPAIGN_CP2026_SNS_SEP_PATH } from '../../constants/campaignCp2026SnsSep.js'
import { CAMPAIGN_CP2026_SNS_SEP_HOME_POPUP_IMAGE } from '../../constants/campaignCp2026SnsSepAssets.js'
import { isCampaignCp2026SnsSepUiVisible } from '../../lib/campaignUiFlags.js'
import {
  clearCampaignCp2026HomePopupDismiss,
  dismissCampaignCp2026HomePopupForSession,
  dismissCampaignCp2026HomePopupForToday,
  isCampaignHomePopupForceOpen,
  shouldShowCampaignCp2026HomePopup,
} from '../../lib/campaignHomePopup.js'
import { trackAnalyticsEvent } from '../../lib/analytics.js'

export default function CampaignCp2026HomePopup({ userEmail = '', authReady = true }) {
  const [open, setOpen] = useState(false)

  const visible = isCampaignCp2026SnsSepUiVisible({ userEmail, allowStaffReview: true })

  useEffect(() => {
    if (!authReady) return undefined

    if (!visible) {
      setOpen(false)
      return undefined
    }

    if (isCampaignHomePopupForceOpen()) {
      clearCampaignCp2026HomePopupDismiss()
    }

    if (!shouldShowCampaignCp2026HomePopup({ userEmail })) return undefined

    const timer = window.setTimeout(() => {
      setOpen(true)
      trackAnalyticsEvent('campaign_home_popup_show', { campaign_id: 'cp2026_sns_sep' })
    }, 500)

    return () => window.clearTimeout(timer)
  }, [visible, userEmail, authReady])

  const closeForSession = () => {
    dismissCampaignCp2026HomePopupForSession()
    setOpen(false)
    trackAnalyticsEvent('campaign_home_popup_dismiss', { campaign_id: 'cp2026_sns_sep', mode: 'session' })
  }

  const closeForToday = () => {
    dismissCampaignCp2026HomePopupForToday()
    setOpen(false)
    trackAnalyticsEvent('campaign_home_popup_dismiss', { campaign_id: 'cp2026_sns_sep', mode: 'today' })
  }

  const handleCtaClick = () => {
    dismissCampaignCp2026HomePopupForSession()
    setOpen(false)
    trackAnalyticsEvent('campaign_home_popup_click', { campaign_id: 'cp2026_sns_sep' })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center p-1.5 sm:p-3 bg-black/60 backdrop-blur-[3px]"
      onClick={closeForSession}
      role="presentation"
    >
      <div
        className="relative w-[min(98vw,920px)] sm:w-[min(96vw,880px)] max-h-[min(96vh,1100px)] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="MoneyMart イベントアンケート"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeForSession}
          className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-lg ring-1 ring-slate-200 hover:text-slate-800"
          aria-label="閉じる"
        >
          <X size={22} />
        </button>

        <Link
          to={CAMPAIGN_CP2026_SNS_SEP_PATH}
          onClick={handleCtaClick}
          className="block min-h-0 overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200/80"
        >
          <img
            src={CAMPAIGN_CP2026_SNS_SEP_HOME_POPUP_IMAGE}
            alt="MoneyMart アンケート — Amazonギフトカード抽選50名・Premium 1か月利用クーポン抽選1000名"
            className="block w-full h-auto max-h-[min(90vh,1020px)] object-contain object-center"
            width={1080}
            height={1400}
            decoding="async"
          />
        </Link>

        <div className="mt-3 sm:mt-4 flex flex-col items-center gap-2 shrink-0">
          <Link
            to={CAMPAIGN_CP2026_SNS_SEP_PATH}
            onClick={handleCtaClick}
            className="text-xs font-bold text-white hover:text-orange-200 underline underline-offset-2"
          >
            アンケートページを開く
          </Link>
          <p className="text-[10px] text-white/75 text-center leading-relaxed max-w-sm">
            閉じた後も、画面上部ナビの「アンケート」またはホームのバナーからいつでも再開できます。
          </p>
          <button
            type="button"
            onClick={closeForSession}
            className="text-xs font-bold text-white/90 hover:text-white"
          >
            あとで
          </button>
          <button
            type="button"
            onClick={closeForToday}
            className="text-[11px] text-white/70 hover:text-white underline underline-offset-2"
          >
            今日は表示しない
          </button>
        </div>
      </div>
    </div>
  )
}
