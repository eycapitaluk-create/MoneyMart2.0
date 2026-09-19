import { Link } from 'react-router-dom'
import { BarChart2, LogIn, Sparkles } from 'lucide-react'
import { GUEST_ETF_COMPARE_TRIAL_LIMIT } from '../../lib/guestEtfCompareTrial'

export default function GuestEtfCompareTrialWall({
  returnPath = '/etf-compare',
  title = '無料お試しは1回までです',
  compact = false,
}) {
  const authState = { from: returnPath }

  return (
    <div
      className={`rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-950 ${
        compact ? 'px-4 py-5' : 'px-6 py-8 sm:px-8'
      } text-center shadow-sm`}
    >
      <div className={`mx-auto mb-3 flex items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ${
        compact ? 'h-11 w-11' : 'h-14 w-14'
      }`}>
        <BarChart2 size={compact ? 22 : 28} aria-hidden />
      </div>
      <p className="text-[11px] font-black tracking-[0.12em] text-amber-700 dark:text-amber-400">
        無料お試し {GUEST_ETF_COMPARE_TRIAL_LIMIT}回
      </p>
      <h2 className={`mt-2 font-black text-slate-900 dark:text-white leading-snug ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
        {title}
      </h2>
      <p className={`mt-2 text-slate-600 dark:text-slate-300 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
        ETF比較（信託報酬・リターン・リスクチャート）は無料登録で何度でもご利用いただけます。登録は約1分・口座連携不要です。
      </p>
      <div className={`mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 ${compact ? 'mt-4' : ''}`}>
        <Link
          to="/signup"
          state={authState}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-400 px-5 py-3 text-sm font-black text-white transition"
        >
          <Sparkles size={16} aria-hidden />
          無料登録して比較を続ける
        </Link>
        <Link
          to="/login"
          state={authState}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 dark:border-amber-700 px-5 py-3 text-sm font-black text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition"
        >
          <LogIn size={16} aria-hidden />
          ログイン
        </Link>
      </div>
    </div>
  )
}
