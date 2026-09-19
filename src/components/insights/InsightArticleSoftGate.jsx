import { Link } from 'react-router-dom'
import { LogIn, Sparkles } from 'lucide-react'

/**
 * インサイト本文：未ログインはタイトル・サムネのみ表示し、登録CTAを案内。
 * compact=true のとき本文ぼかしクリップは使わない（リード非表示プレビュー向け）。
 */
export default function InsightArticleSoftGate({
  isLoggedIn = false,
  returnPath = '/insights',
  compact = false,
  children,
}) {
  if (isLoggedIn) {
    return children
  }

  const authState = { from: returnPath }

  const cta = (
    <div className={`relative z-10 mx-auto max-w-lg px-4 pb-10 ${compact ? 'pt-8' : 'pt-6 -mt-28 sm:-mt-32'}`}>
      <div className="rounded-2xl border border-amber-200/90 dark:border-amber-900/50 bg-white/95 dark:bg-slate-900/95 shadow-xl shadow-amber-900/10 px-5 py-6 text-center backdrop-blur-sm">
        <p className="text-[11px] font-black tracking-[0.14em] text-amber-700 dark:text-amber-400">続きは無料会員限定</p>
        <p className="mt-2 text-base font-black text-stone-900 dark:text-white leading-snug">
          無料登録で全文・図表をお読みいただけます
        </p>
        <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-slate-400">
          登録約1分・口座連携不要。マイページで資産・配当もまとめて管理できます。
        </p>
        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          <Link
            to="/signup"
            state={authState}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-5 py-3 text-sm font-black text-white transition"
          >
            <Sparkles size={16} aria-hidden />
            無料で登録して続きを読む
          </Link>
          <Link
            to="/login"
            state={authState}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-slate-600 px-5 py-3 text-sm font-black text-stone-800 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-800 transition"
          >
            <LogIn size={16} aria-hidden />
            ログイン
          </Link>
        </div>
      </div>
    </div>
  )

  if (compact) {
    return (
      <div className="relative">
        {children}
        {cta}
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        className="relative max-h-[min(72vh,920px)] overflow-hidden pointer-events-none select-none"
        aria-hidden={false}
      >
        {children}
        <div
          className="absolute inset-x-0 bottom-0 h-[min(52%,420px)] bg-gradient-to-t from-[#f6f4ef] via-[#f6f4ef]/92 to-transparent dark:from-slate-950 dark:via-slate-950/92 backdrop-blur-[7px]"
          aria-hidden
        />
      </div>
      {cta}
    </div>
  )
}
