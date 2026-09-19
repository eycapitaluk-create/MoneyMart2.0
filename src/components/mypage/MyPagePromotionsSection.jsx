import { REFERRAL_INVITE_UI_ENABLED } from '../../lib/referralUiFlags'
import { isCampaignCp2026SnsSepUiVisible } from '../../lib/campaignUiFlags'
import CampaignCp2026SnsSepTeaser from '../campaign/CampaignCp2026SnsSepTeaser'
import { ReferralShareMenu } from '../ReferralShareMenu'
import { getReferralCopyUrl } from '../../lib/referralShare'
import { useState } from 'react'

export default function MyPagePromotionsSection({
  user = null,
  referralInviteCode = null,
  referralCopied = false,
  onReferralCopied = () => {},
  referralShareHint = '',
  onReferralShareHint = () => {},
}) {
  const showCampaign = Boolean(
    user?.id && isCampaignCp2026SnsSepUiVisible({ userEmail: user?.email, allowStaffReview: true }),
  )
  const showReferral = Boolean(REFERRAL_INVITE_UI_ENABLED && user?.id && referralInviteCode)

  if (!showCampaign && !showReferral) return null

  return (
    <section
      className="mt-6 pt-5 border-t border-slate-200/90 dark:border-slate-800"
      aria-label="イベント・お知らせ"
    >
      <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 mb-2.5">
        お知らせ
      </h2>

      <div className="space-y-2">
        {showCampaign ? <CampaignCp2026SnsSepTeaser userEmail={user?.email} /> : null}

        {showReferral ? (
          <ReferralInviteCard
            inviteCode={referralInviteCode}
            copied={referralCopied}
            onCopied={onReferralCopied}
            shareHint={referralShareHint}
            onShareHint={onReferralShareHint}
          />
        ) : null}
      </div>
    </section>
  )
}

function ReferralInviteCard({
  inviteCode,
  copied,
  onCopied,
  shareHint,
  onShareHint,
}) {
  const [open, setOpen] = useState(false)
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${inviteCode}` : ''

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
        aria-expanded={open}
      >
        <span className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-black shrink-0">
          友
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">友だち招待</span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            紹介リンクをシェア
          </span>
        </span>
        <span className="text-[10px] font-bold text-slate-400 shrink-0">{open ? '閉じる' : '開く'}</span>
      </button>

      {open ? (
        <div className="px-3.5 pb-3.5 pt-0 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-3 mb-2 leading-relaxed">
            このURLをシェアすると、友だちが
            <span className="font-bold text-slate-800 dark:text-slate-200">無料登録</span>
            したときに紹介として記録されます。
          </p>
          <code className="block text-[11px] font-mono break-all text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 mb-2">
            {inviteUrl}
          </code>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={async () => {
                onShareHint('')
                try {
                  await navigator.clipboard.writeText(getReferralCopyUrl(inviteUrl))
                  onCopied(true)
                  window.setTimeout(() => onCopied(false), 2000)
                } catch {
                  onCopied(false)
                  onShareHint('コピーできませんでした')
                }
              }}
              className="flex-1 h-9 px-3 rounded-lg bg-slate-900 dark:bg-orange-500 hover:opacity-95 text-white text-xs font-black"
            >
              {copied ? 'コピーしました' : 'リンクをコピー'}
            </button>
            <ReferralShareMenu
              inviteUrl={inviteUrl}
              onNotify={(msg) => {
                onShareHint(msg)
                window.setTimeout(() => onShareHint(''), 2500)
              }}
              triggerClassName={
                'flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 ' +
                'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 text-xs font-black ' +
                'inline-flex items-center justify-center gap-1.5 disabled:opacity-50 w-full'
              }
            />
          </div>
          {shareHint ? (
            <p className="mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{shareHint}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
