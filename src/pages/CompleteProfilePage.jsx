import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { sanitizeInternalRedirectPath } from '../lib/navigationGuards'
import {
  ONBOARDING_ASSET_MIX_OPTIONS,
  ONBOARDING_RISK_TOLERANCE_OPTIONS,
  ONBOARDING_HORIZON_OPTIONS,
  isCompleteOnboardingRow,
} from '../lib/investorOnboardingOptions'

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [eventCouponOptIn, setEventCouponOptIn] = useState(false)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [onboardingAssetMix, setOnboardingAssetMix] = useState('')
  const [onboardingRiskTolerance, setOnboardingRiskTolerance] = useState('')
  const [onboardingInvestmentHorizon, setOnboardingInvestmentHorizon] = useState('')
  const [onboardingNeeded, setOnboardingNeeded] = useState(false)
  const redirectTo = sanitizeInternalRedirectPath(location.state?.from, '/')

  useEffect(() => {
    let alive = true
    let finished = false
    let authSub = null
    const timeoutId = window.setTimeout(() => {
      if (!alive || finished) return
      finished = true
      authSub?.unsubscribe()
      window.clearTimeout(timeoutId)
      setLoadError('ログイン情報の確認が完了しませんでした。ページを更新するか、ログインからやり直してください。')
      setProfileLoading(false)
    }, 15000)

    const endLoad = () => {
      if (finished || !alive) return
      finished = true
      window.clearTimeout(timeoutId)
      setProfileLoading(false)
    }

    const applyProfile = async (userId) => {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select(
          'phone, marketing_opt_in, event_coupon_opt_in, onboarding_asset_mix, onboarding_risk_tolerance, onboarding_investment_horizon',
        )
        .eq('user_id', userId)
        .maybeSingle()
      if (!alive) return
      if (error) {
        setLoadError(error.message || 'プロフィールの読み込みに失敗しました。')
        endLoad()
        return
      }
      if (profile) {
        setPhone(profile.phone || '')
        setMarketingOptIn(Boolean(profile.marketing_opt_in))
        setEventCouponOptIn(Boolean(profile.event_coupon_opt_in))
        setOnboardingAssetMix(String(profile.onboarding_asset_mix || ''))
        setOnboardingRiskTolerance(String(profile.onboarding_risk_tolerance || ''))
        setOnboardingInvestmentHorizon(String(profile.onboarding_investment_horizon || ''))
        setOnboardingNeeded(!isCompleteOnboardingRow(profile))
      } else {
        setOnboardingNeeded(true)
      }
      endLoad()
    }

    const tryExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) return session.user.id
      const { data: { user } } = await supabase.auth.getUser()
      return user?.id || null
    }

    ;(async () => {
      const userId = await tryExistingSession()
      if (!alive || finished) return
      if (userId) {
        await applyProfile(userId)
        return
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user?.id
        if (!uid || !alive || finished) return
        subscription.unsubscribe()
        void applyProfile(uid)
      })
      authSub = subscription
    })()

    return () => {
      alive = false
      window.clearTimeout(timeoutId)
      authSub?.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    if (!agreeTerms || !agreePrivacy || !agreeDisclaimer) {
      setMessage('利用規約・プライバシーポリシー・免責事項への同意が必要です。')
      return
    }
    if (eventCouponOptIn && !phone.trim()) {
      setMessage('イベント当選・クーポン通知を受け取るには電話番号の入力が必要です。')
      return
    }
    if (
      onboardingNeeded
      && (!onboardingAssetMix.trim() || !onboardingRiskTolerance.trim() || !onboardingInvestmentHorizon.trim())
    ) {
      setMessage('投資プロフィール（3問）をすべて選択してください。')
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('ログインが必要です')
      const displayName = user.user_metadata?.full_name || user.user_metadata?.nickname || (user.email ? user.email.split('@')[0] : '') || 'Member'
      const oA = onboardingAssetMix.trim()
      const oR = onboardingRiskTolerance.trim()
      const oH = onboardingInvestmentHorizon.trim()
      const onboardingAt = oA && oR && oH ? new Date().toISOString() : null
      const upsertRow = {
        user_id: user.id,
        full_name: user.user_metadata?.full_name || displayName,
        nickname: user.user_metadata?.nickname || displayName,
        phone: phone.trim() || null,
        marketing_opt_in: marketingOptIn,
        event_coupon_opt_in: eventCouponOptIn,
        consent_acknowledged_at: new Date().toISOString(),
      }
      if (onboardingNeeded) {
        upsertRow.onboarding_asset_mix = oA || null
        upsertRow.onboarding_risk_tolerance = oR || null
        upsertRow.onboarding_investment_horizon = oH || null
        upsertRow.onboarding_answers_at = onboardingAt
      }
      const { error } = await supabase
        .from('user_profiles')
        .upsert(upsertRow, { onConflict: 'user_id' })
      if (error) throw error
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setMessage(err?.message || '保存に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
      <Card className="p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">プロフィール設定</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          続行のため、利用規約への同意とプロフィール確認が必要です。
        </p>
        {profileLoading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : loadError ? (
          <div className="space-y-4">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <Button type="button" className="w-full" onClick={() => window.location.reload()}>
              ページを更新
            </Button>
            <Link to="/login" className="block text-center text-sm text-primary-blue hover:underline">
              ログインへ
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {onboardingNeeded ? (
              <div className="space-y-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-4">
                <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-wider">投資プロフィール</p>
                <p className="text-xs text-indigo-900/90 dark:text-indigo-100/90 leading-relaxed">
                  サービス改善のための自己申告です（投資助言ではありません）。3問すべて選択してください。
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">現在の資産状況 *</label>
                  <select
                    value={onboardingAssetMix}
                    onChange={(e) => setOnboardingAssetMix(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="">選択してください</option>
                    {ONBOARDING_ASSET_MIX_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">リスクの考え方 *</label>
                  <select
                    value={onboardingRiskTolerance}
                    onChange={(e) => setOnboardingRiskTolerance(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="">選択してください</option>
                    {ONBOARDING_RISK_TOLERANCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">投資・運用の目安となる期間 *</label>
                  <select
                    value={onboardingInvestmentHorizon}
                    onChange={(e) => setOnboardingInvestmentHorizon(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="">選択してください</option>
                    {ONBOARDING_HORIZON_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                電話番号 {eventCouponOptIn ? '(イベント・クーポン通知希望の場合は必須)' : '(任意)'}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 ${eventCouponOptIn && !phone.trim() ? 'border-amber-500 dark:border-amber-600' : 'border-gray-300 dark:border-gray-600'}`}
                placeholder="090-1234-5678"
              />
            </div>
            <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">必須同意</p>
              <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-1 rounded" />
                <span>
                  <Link to="/legal/terms" target="_blank" className="text-primary-blue hover:underline">利用規約</Link>
                  {' '}に同意します *
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="mt-1 rounded" />
                <span>
                  <Link to="/legal/privacy" target="_blank" className="text-primary-blue hover:underline">プライバシーポリシー</Link>
                  （個人情報の処理）に同意します *
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={agreeDisclaimer} onChange={(e) => setAgreeDisclaimer(e.target.checked)} className="mt-1 rounded" />
                <span>
                  <Link to="/legal/disclaimer" target="_blank" className="text-primary-blue hover:underline">免責事項</Link>
                  {' '}に同意します *
                </span>
              </label>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-2">任意</p>
              <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-1 rounded" />
                <span>キャンペーン・お得情報のメール受信を希望します</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={eventCouponOptIn} onChange={(e) => setEventCouponOptIn(e.target.checked)} className="mt-1 rounded" />
                <span>イベント当選・クーポン付与の通知を受けます（希望する場合は上記で電話番号を入力してください）</span>
              </label>
            </div>
            {message && <p className="text-sm text-red-500">{message}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '保存中...' : '同意して続行'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
