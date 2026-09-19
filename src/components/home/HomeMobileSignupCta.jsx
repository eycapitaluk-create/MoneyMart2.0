import { useEffect, useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { trackAnalyticsEvent } from '../../lib/analytics'

/**
 * Mobile-only sticky CTA. Desktop users rely on the hero block (same copy / same modal).
 */
export default function HomeMobileSignupCta({
  visible = false,
  isLoggedIn = false,
  onStartDiagnosis,
  onOpenMypage,
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (visible) setMounted(true)
  }, [visible])

  if (!visible && !mounted) return null
  if (isLoggedIn) return null

  const handlePrimary = () => {
    trackAnalyticsEvent('home_mobile_sticky_cta_click', { action: 'diagnosis' })
    onStartDiagnosis?.()
  }

  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-[95] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!visible}
    >
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-orange-200/90 dark:border-orange-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-[0_-8px_32px_rgba(15,23,42,0.12)] px-4 py-3">
        <p className="text-[10px] font-black tracking-wide text-orange-600 dark:text-orange-400 flex items-center gap-1.5 mb-2">
          <ShieldCheck size={12} />
          口座連携不要 · 30秒でかんたん診断
        </p>
        <button
          type="button"
          onClick={handlePrimary}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-black text-sm shadow-md shadow-orange-500/25 inline-flex items-center justify-center gap-2 min-h-[48px]"
        >
          30秒で資産診断をはじめる
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => {
            trackAnalyticsEvent('home_mobile_sticky_cta_click', { action: 'mypage_demo' })
            document.getElementById('home-mypage-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className="mt-2 w-full text-center text-xs font-bold text-slate-500 dark:text-slate-400 py-1"
        >
          まず使い方を見る ↓
        </button>
      </div>
    </div>
  )
}
