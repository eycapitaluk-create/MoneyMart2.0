import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Clock3, ShieldCheck, Sparkles, X } from 'lucide-react'
import {
  ONBOARDING_ASSET_MIX_OPTIONS,
  ONBOARDING_HORIZON_OPTIONS,
  ONBOARDING_RISK_TOLERANCE_OPTIONS,
} from '../../lib/investorOnboardingOptions'
import {
  buildGuestDiagnosisResult,
  saveGuestDiagnosisDraft,
  saveGuestDiagnosisResult,
} from '../../lib/guestAssetDiagnosis'
import { trackAnalyticsEvent } from '../../lib/analytics'

const STEPS = [
  { key: 'assetMix', label: '資産の中心', options: ONBOARDING_ASSET_MIX_OPTIONS },
  { key: 'riskTolerance', label: 'リスク許容度', options: ONBOARDING_RISK_TOLERANCE_OPTIONS },
  { key: 'horizon', label: '投資期間', options: ONBOARDING_HORIZON_OPTIONS },
]

function ScoreRing({ score = 0, grade = 'C' }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0))
  const color = safe >= 70 ? '#16a34a' : safe >= 55 ? '#f59e0b' : '#ea580c'
  const r = 40
  const c = 2 * Math.PI * r
  const dash = (safe / 100) * c
  return (
    <div className="relative w-[104px] h-[104px] shrink-0">
      <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden>
        <circle cx="52" cy="52" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 52 52)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums" style={{ color }}>{safe}</span>
        <span className="text-xs font-black" style={{ color }}>{grade}</span>
      </div>
    </div>
  )
}

export default function GuestAssetDiagnosisModal({
  isOpen,
  onClose,
  onSignup,
  source = 'guest_diag_modal',
}) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({
    assetMix: '',
    riskTolerance: '',
    horizon: '',
  })

  useEffect(() => {
    if (!isOpen) return
    setStep(0)
    setAnswers({ assetMix: '', riskTolerance: '', horizon: '' })
    trackAnalyticsEvent('guest_diag_open', { source })
  }, [isOpen, source])

  const result = useMemo(() => {
    if (step < STEPS.length) return null
    return buildGuestDiagnosisResult(answers)
  }, [step, answers])

  useEffect(() => {
    if (!result) return
    saveGuestDiagnosisDraft(answers)
    saveGuestDiagnosisResult(result)
    trackAnalyticsEvent('guest_diag_complete', {
      source,
      score: result.score,
      grade: result.grade,
    })
  }, [result, answers, source])

  if (!isOpen) return null

  const current = STEPS[step]
  const currentValue = answers[current?.key] || ''
  const progressPct = step >= STEPS.length
    ? 100
    : Math.round(((step + (currentValue ? 1 : 0)) / STEPS.length) * 100)

  const pick = (value) => {
    if (!current) return
    const next = { ...answers, [current.key]: value }
    setAnswers(next)
    if (step < STEPS.length - 1) {
      window.setTimeout(() => setStep((s) => s + 1), 120)
    } else {
      setStep(STEPS.length)
    }
  }

  const handleSignup = () => {
    saveGuestDiagnosisDraft(answers)
    if (result) saveGuestDiagnosisResult(result)
    trackAnalyticsEvent('guest_diag_signup_click', { source, score: result?.score })
    onSignup?.()
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md max-h-[min(92vh,720px)] overflow-y-auto rounded-t-[1.75rem] sm:rounded-[1.75rem] bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-diag-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="閉じる"
        >
          <X size={22} />
        </button>

        <div className="p-6 pt-7 sm:p-8">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-2">
            <Sparkles size={18} />
            <p className="text-[11px] font-black tracking-[0.16em]">30秒 · かんたん診断</p>
          </div>
          <h2 id="guest-diag-title" className="text-xl font-black text-slate-900 dark:text-white leading-snug pr-8">
            {step >= STEPS.length ? 'あなたの資産プロフィール診断' : '3つの質問で、いまの方向性をチェック'}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            口座・銀行の連携は不要です。この3問は好みの確認で、保有銘柄の重なりは見ていません。回答は参考情報であり、投資助言ではありません。
          </p>

          <div className="mt-4 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {step < STEPS.length ? (
            <div className="mt-6">
              <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-3">
                {step + 1} / {STEPS.length} · {current.label}
              </p>
              <div className="space-y-2">
                {current.options.map((opt) => {
                  const active = currentValue === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => pick(opt.value)}
                      className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-bold transition ${
                        active
                          ? 'border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-100'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200 hover:border-orange-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="mt-4 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  戻る
                </button>
              ) : null}
            </div>
          ) : result ? (
            <div className="mt-6">
              <div className="flex items-center gap-4 rounded-2xl border border-orange-200/80 dark:border-orange-900/50 bg-orange-50/60 dark:bg-orange-950/20 p-4">
                <ScoreRing score={result.score} grade={result.grade} />
                <div className="min-w-0">
                  <p className="text-base font-black text-slate-900 dark:text-white">{result.headline}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{result.summary}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-black text-slate-500 dark:text-slate-400">改善フォーカス（例）</p>
                </div>
                <div className="relative px-4 py-4">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{result.focus}</p>
                  <div className="mt-3 space-y-2 select-none pointer-events-none blur-[5px] opacity-70" aria-hidden>
                    <p className="text-sm text-slate-600 dark:text-slate-400">・株式とファンドの比率バランスを確認</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">・地域・セクター分散の見直しポイント</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">・保有1件登録でAIレポートの精度が向上</p>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-slate-900 to-transparent" />
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2"><Clock3 size={14} className="text-orange-500" /> 無料マイページを30秒で開設</li>
                <li className="flex items-center gap-2"><ShieldCheck size={14} className="text-orange-500" /> 口座連携は不要・メールだけでOK</li>
              </ul>

              <button
                type="button"
                onClick={handleSignup}
                className="mt-5 w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-base shadow-lg shadow-orange-500/30 inline-flex items-center justify-center gap-2"
              >
                無料でマイページを開設する
                <ArrowRight size={18} />
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                登録後、回答を保存して保有登録で本格分析へ
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
