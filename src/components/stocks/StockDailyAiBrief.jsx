import { useEffect, useState } from 'react'
import { Loader2, LogIn, Sparkles } from 'lucide-react'
import { fetchStockDailyBrief } from '../../lib/stockDailyBriefClient'
import { LEGAL_NOTICE_TEMPLATES } from '../../constants/legalNoticeTemplates'
import { signedReturnTextClassStrong } from '../../lib/marketDirectionColors'

export default function StockDailyAiBrief({
  symbol = '',
  region = 'US',
  isLoggedIn = false,
  onLogin,
  dayChangePct = null,
}) {
  const [state, setState] = useState({ kind: 'idle' })

  useEffect(() => {
    const sym = String(symbol || '').trim()
    if (!sym || !isLoggedIn) {
      setState({ kind: 'idle' })
      return undefined
    }

    let cancelled = false
    setState({ kind: 'loading' })

    const load = async () => {
      try {
        const brief = await fetchStockDailyBrief(sym)
        if (cancelled) return
        if (brief?.status === 'empty') {
          setState({ kind: 'empty', brief })
        } else {
          setState({ kind: 'ready', brief })
        }
      } catch (err) {
        if (cancelled) return
        if (err?.code === 'auth_required') {
          setState({ kind: 'idle' })
          return
        }
        setState({
          kind: 'error',
          message: err?.message || 'AI解説の取得に失敗しました。',
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [symbol, isLoggedIn])

  const displayPct = state.kind === 'ready' && state.brief?.changePct != null && Number.isFinite(Number(state.brief.changePct))
    ? Number(state.brief.changePct)
    : dayChangePct != null && Number.isFinite(Number(dayChangePct))
      ? Number(dayChangePct)
      : null

  return (
    <div className="bg-gradient-to-br from-violet-50 via-white to-orange-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 p-4 md:p-6 rounded-3xl border border-violet-200/70 dark:border-violet-900/40 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-violet-600 dark:text-violet-400 shrink-0" />
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">本日のAI分析</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
              会員無料
            </span>
          </div>
          <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            MoneyMart AIが終値・公開情報をもとに1日1回整理（他社メディアの転載・引用ではありません）
          </p>
        </div>
        {displayPct != null ? (
          <span className={`text-sm font-black font-mono shrink-0 ${signedReturnTextClassStrong(displayPct)}`}>
            {displayPct > 0 ? '+' : ''}{displayPct.toFixed(2)}%
          </span>
        ) : null}
      </div>

      {!isLoggedIn ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            ログインすると、選択中の銘柄について本日の株価動向をAIが整理して表示します。
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition"
          >
            <LogIn size={14} />
            ログインして見る
          </button>
        </div>
      ) : null}

      {isLoggedIn && state.kind === 'loading' ? (
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 py-6 justify-center">
          <Loader2 size={18} className="animate-spin text-violet-500" />
          AI分析を読み込み中…
        </div>
      ) : null}

      {isLoggedIn && state.kind === 'error' ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/80 dark:bg-red-950/20 p-4 text-sm font-bold text-red-700 dark:text-red-300">
          {state.message}
        </div>
      ) : null}

      {isLoggedIn && state.kind === 'empty' ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-4 text-sm font-bold text-slate-600 dark:text-slate-300">
          {state.brief?.summary || '本日の解説を生成できませんでした。終値データの更新後に再度お試しください。'}
        </div>
      ) : null}

      {isLoggedIn && state.kind === 'ready' ? (
        <div className="space-y-3">
          <p className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100 leading-snug">
            {state.brief?.headline}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            {state.brief?.summary}
          </p>
          {Array.isArray(state.brief?.drivers) && state.brief.drivers.length > 0 ? (
            <ul className="space-y-2">
              {state.brief.drivers.map((driver) => (
                <li
                  key={`${driver.label}-${driver.detail}`}
                  className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700 px-3 py-2"
                >
                  <span className="text-[11px] font-black text-violet-600 dark:text-violet-400">{driver.label}</span>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{driver.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {state.brief?.briefDateJst ? (
            <p className="text-[10px] font-bold text-slate-400">
              更新日（JST）: {String(state.brief.briefDateJst).replace(/-/g, '/')}
              {state.brief?.tradeDate ? ` · 参照終値日: ${String(state.brief.tradeDate).replace(/-/g, '/')}` : ''}
              {region === 'JP' ? ' · 円建て' : ' · USD'}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
        {LEGAL_NOTICE_TEMPLATES.newsNotSolicitation}
        {' '}
        本欄はMoneyMart AIによる参考分析です。第三者メディアの記事転載・引用ではなく、売買の勧誘を意図するものでもありません。
      </p>
    </div>
  )
}
