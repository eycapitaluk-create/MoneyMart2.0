import { Link, useLocation } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { CAMPAIGN_CP2026_SNS_SEP_PATH } from '../../constants/campaignCp2026SnsSep.js'
import { isCampaignCp2026SnsSepUiVisible } from '../../lib/campaignUiFlags.js'
import { trackAnalyticsEvent } from '../../lib/analytics.js'

/**
 * キャンペーン期間中の常設導線（ポップアップを閉じてもナビ・フッターから再開可能）
 * ※期間前は非表示（社内メールでもナビには出さない）
 */
export default function CampaignCp2026NavLink({
  variant = 'nav',
  onClick,
  className = '',
}) {
  const { pathname } = useLocation()
  if (!isCampaignCp2026SnsSepUiVisible()) return null

  const base =
    variant === 'footer'
      ? 'inline-flex items-center gap-1.5 hover:text-orange-400 transition font-bold text-orange-300/95'
      : variant === 'mobile'
        ? 'flex items-center gap-2 font-bold text-lg text-orange-600 dark:text-orange-400'
        : 'inline-flex items-center gap-1 rounded-sm px-0.5 -mx-0.5 transition text-xs xl:text-sm font-bold whitespace-nowrap text-orange-600 dark:text-orange-400 hover:text-orange-500'

  const activeClass =
    pathname === CAMPAIGN_CP2026_SNS_SEP_PATH
      ? ' underline underline-offset-[7px] decoration-2 decoration-orange-500'
      : ''

  return (
    <Link
      to={CAMPAIGN_CP2026_SNS_SEP_PATH}
      onClick={() => {
        trackAnalyticsEvent('campaign_nav_click', { campaign_id: 'cp2026_sns_sep', variant })
        onClick?.()
      }}
      className={`${base}${activeClass} ${className}`.trim()}
      title="MoneyMart アンケート（抽選キャンペーン）"
    >
      <Gift size={variant === 'footer' ? 12 : 14} className="shrink-0" aria-hidden />
      アンケート
    </Link>
  )
}
