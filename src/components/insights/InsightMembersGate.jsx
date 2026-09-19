import { Link } from 'react-router-dom'
import { Lock, LogIn, Sparkles } from 'lucide-react'

export default function InsightMembersGate({
  pageTitle = '投資インサイト',
  categoryLabel = 'インサイト',
  publishedAtLabel = '',
  previewText = '',
  coverImageUrl = '',
  returnPath = '/insights',
}) {
  const authState = { from: returnPath }
  const teaser = String(previewText || '').trim()

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f6f4ef] dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <Link
          to="/insights"
          className="inline-flex items-center gap-2 text-sm font-bold text-stone-600 dark:text-slate-400 hover:text-amber-800 dark:hover:text-amber-400 mb-6"
        >
          ← インサイト一覧
        </Link>

        <article className="overflow-hidden rounded-3xl border border-stone-200/90 dark:border-slate-700/90 bg-white/90 dark:bg-slate-900/90 shadow-[0_24px_60px_-28px_rgba(28,25,23,0.2)]">
          {coverImageUrl ? (
            <div className="aspect-[21/9] w-full overflow-hidden bg-stone-100 dark:bg-slate-800">
              <img
                src={coverImageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}

          <div className="p-6 sm:p-8 lg:p-10">
            <p className="text-[11px] font-black tracking-[0.14em] text-amber-700 dark:text-amber-400">
              {categoryLabel}
              {publishedAtLabel ? ` · ${publishedAtLabel}` : ''}
            </p>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black leading-tight text-stone-900 dark:text-white">
              {pageTitle}
            </h1>

            {teaser ? (
              <p className="mt-4 text-base leading-relaxed text-stone-700 dark:text-slate-300">
                {teaser}
              </p>
            ) : null}

            <div className="relative mt-8 overflow-hidden rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 p-6 sm:p-7">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/90 dark:from-slate-900/90 to-transparent" aria-hidden />
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                  <Lock size={18} aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-black text-amber-900 dark:text-amber-200">
                    無料会員登録で全文・図表を読めます
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-slate-400">
                    MoneyMart の編集インサイトは会員向けです。チャート・データ・続きの分析はログイン後にご覧いただけます（登録無料・約1分）。
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to="/signup"
                  state={authState}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-5 py-3 text-sm font-black text-white transition"
                >
                  <Sparkles size={16} aria-hidden />
                  無料で登録して読む
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
        </article>
      </div>
    </div>
  )
}
