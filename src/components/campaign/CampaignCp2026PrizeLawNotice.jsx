import { Link } from 'react-router-dom'
import { CAMPAIGN_CP2026_SNS_SEP_PRIZE_LAW_ROWS } from '../../constants/campaignCp2026SnsSepPrizeLaw.js'

/** 景品表示法に基づく表示（キャンペーンページ最下部） */
export default function CampaignCp2026PrizeLawNotice() {
  return (
    <section
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 p-5 shadow-sm"
      aria-labelledby="campaign-prize-law-heading"
    >
      <h2
        id="campaign-prize-law-heading"
        className="text-sm font-black text-slate-800 dark:text-slate-100 mb-1"
      >
        景品表示法に基づく表示
      </h2>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
        本キャンペーンは景品類の提供を伴う懸賞です。景品の最高額・総額は景品表示法の届出基準を下回るため、本ページに必要事項を表示しています（別ページは設けていません）。
      </p>
      <dl className="space-y-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        {CAMPAIGN_CP2026_SNS_SEP_PRIZE_LAW_ROWS.map((row) => (
          <div key={row.label} className="grid gap-1 sm:grid-cols-[minmax(7rem,9rem)_1fr] sm:gap-3">
            <dt className="font-bold text-slate-800 dark:text-slate-200 shrink-0">{row.label}</dt>
            <dd className="min-w-0 break-words">
              {row.href ? (
                <a
                  href={row.href}
                  className="font-mono font-semibold text-orange-600 dark:text-orange-400 underline underline-offset-2 break-all"
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        個人情報の取扱いの詳細は
        {' '}
        <Link to="/legal/privacy" className="font-bold text-orange-600 underline underline-offset-2 dark:text-orange-400">
          プライバシーポリシー
        </Link>
        をご確認ください。有料プランの販売条件は
        {' '}
        <Link to="/legal/commerce" className="font-bold text-orange-600 underline underline-offset-2 dark:text-orange-400">
          特定商取引法に基づく表記
        </Link>
        をご確認ください。
      </p>
    </section>
  )
}
