import { Link } from 'react-router-dom'
import { ArrowRight, Gift } from 'lucide-react'
import { CAMPAIGN_CP2026_SNS_SEP_PATH } from '../../constants/campaignCp2026SnsSep.js'
import { isCampaignCp2026SnsSepUiVisible } from '../../lib/campaignUiFlags.js'

export default function CampaignCp2026SnsSepTeaser({ className = '', userEmail = '' }) {
  if (!isCampaignCp2026SnsSepUiVisible({ userEmail, allowStaffReview: true })) return null

  return (
    <Link
      to={CAMPAIGN_CP2026_SNS_SEP_PATH}
      className={`group flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 shadow-sm hover:border-orange-300 dark:hover:border-orange-800 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 transition ${className}`.trim()}
    >
      <span className="w-9 h-9 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0">
        <Gift size={17} aria-hidden />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-slate-900 dark:text-white">
          MoneyMart アンケート実施中
        </span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
          2026/10/1〜30 · 抽選ギフト券50名＋Premium 1か月クーポン1000名
        </span>
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] font-black text-orange-600 dark:text-orange-400 shrink-0">
        詳細を見る
        <ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}
