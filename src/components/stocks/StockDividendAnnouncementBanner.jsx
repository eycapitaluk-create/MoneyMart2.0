import { Link } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { getStockDividendAnnouncement } from '../../lib/stockDividendAnnouncement'

export default function StockDividendAnnouncementBanner({ symbol = '' }) {
  const info = getStockDividendAnnouncement(symbol)
  if (!info) return null

  const exNote = info.isEstimatedExDate ? '（予定）' : ''

  return (
    <div className="rounded-xl border border-sky-200/90 dark:border-sky-900/50 bg-sky-50/90 dark:bg-sky-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-start gap-3 min-w-0">
        <span className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
          <Banknote size={18} aria-hidden />
        </span>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <span className="font-black text-slate-900 dark:text-white">{info.symbol}</span>
          {' '}が現金配当{' '}
          <span className="font-black text-sky-800 dark:text-sky-300">{info.amountLabel}</span>
          {' '}を発表（権利落ち日{exNote}:{' '}
          <span className="font-bold">{info.exDateLabel}</span>
          ）
        </p>
      </div>
      <Link
        to="/dividend-calendar"
        className="shrink-0 text-xs font-black text-sky-700 dark:text-sky-300 underline underline-offset-2 hover:text-sky-900 dark:hover:text-sky-200"
      >
        配当カレンダーで見る
      </Link>
    </div>
  )
}
