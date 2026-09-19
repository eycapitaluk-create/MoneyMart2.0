import { Link } from 'react-router-dom'
import { LogIn, Sparkles } from 'lucide-react'

/**
 * 未ログイン: コンテンツをぼかし、ログイン／無料登録 CTA を重ねる。
 */
export default function MembersBlurGate({
  isLoggedIn = false,
  children,
  label = 'ログイン後に表示されます',
  hint = '無料登録で全文・ランキング・ニュースをご覧いただけます。',
  returnPath = '/',
  className = '',
  overlayRoundedClass = 'rounded-2xl',
}) {
  if (isLoggedIn) {
    return children
  }

  const authState = { from: returnPath }

  return (
    <div className={`relative ${className}`}>
      <div className="blur-[6px] pointer-events-none select-none" aria-hidden={false}>
        {children}
      </div>
      <div
        className={`absolute inset-0 z-20 ${overlayRoundedClass} border border-amber-200 dark:border-amber-900/40 bg-white/78 dark:bg-slate-900/78 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4`}
      >
        <div className="max-w-sm w-full rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-center">
          <p className="text-xs font-black text-amber-700 dark:text-amber-300">{label}</p>
          {hint ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-200/80">{hint}</p>
          ) : null}
          <div className="mt-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
            <Link
              to="/signup"
              state={authState}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-[11px] font-black transition"
            >
              <Sparkles size={14} aria-hidden />
              無料登録
            </Link>
            <Link
              to="/login"
              state={authState}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-[11px] font-black hover:bg-amber-100 dark:hover:bg-amber-900/20 transition"
            >
              <LogIn size={14} aria-hidden />
              ログイン
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
