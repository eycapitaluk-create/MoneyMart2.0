import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { SITE_ORIGIN } from '../lib/seoConfig'
import { clearPendingReferralCode, getPendingReferralCode } from '../lib/referralStorage'
import { getSignupAttributionForProfile, getSignupAttributionForUserMetadata } from '../lib/analytics'

const mapAuthErrorMessage = (message = '') => {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) return 'メールアドレスまたはパスワードが正しくありません。'
  if (lower.includes('email not confirmed')) return 'メール認証が完了していません。受信メールをご確認ください。'
  if (lower.includes('already registered')) return 'このメールアドレスは既に登録されています。'
  if (lower.includes('password should be at least')) return 'パスワードは8文字以上で入力してください。'
  if (lower.includes('database error saving new user')) {
    return '登録処理でサーバーエラーが発生しました。しばらくしてから再度お試しください。'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return '送信が集中しています。数分後にもう一度お試しください。'
  }
  if (lower.includes('redirect') && lower.includes('not allowed')) {
    return '再設定リンクの送付設定に不整合があります。サポートまでお問い合わせください。'
  }
  return message || '認証処理に失敗しました。'
}

export function useAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const signIn = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      return data
    } catch (err) {
      const mapped = mapAuthErrorMessage(err.message)
      setError(mapped)
      throw new Error(mapped)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async ({ email, password, profile = {}, referralCodeManual = '' }) => {
    setLoading(true)
    setError(null)
    const fromUrl = typeof window !== 'undefined' ? getPendingReferralCode() : ''
    const manual = String(referralCodeManual || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    const referralCode = manual.length >= 4 ? manual : fromUrl
    const signupAttrMeta = typeof window !== 'undefined' ? getSignupAttributionForUserMetadata() : {}
    try {
      const oAsset = String(profile.onboardingAssetMix || '').trim()
      const oRisk = String(profile.onboardingRiskTolerance || '').trim()
      const oHorizon = String(profile.onboardingInvestmentHorizon || '').trim()
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: profile.fullName || '',
            nickname: profile.nickname || '',
            phone: profile.phone || '',
            marketing_opt_in: Boolean(profile.marketingOptIn),
            event_coupon_opt_in: Boolean(profile.eventCouponOptIn),
            ...(oAsset ? { onboarding_asset_mix: oAsset } : {}),
            ...(oRisk ? { onboarding_risk_tolerance: oRisk } : {}),
            ...(oHorizon ? { onboarding_investment_horizon: oHorizon } : {}),
            ...signupAttrMeta,
            ...(referralCode ? { referral_code: referralCode } : {}),
          },
        },
      })
      if (authError) throw authError

      if (referralCode) clearPendingReferralCode()

      if (data?.session && data?.user?.id) {
        const signupAttrProfile = typeof window !== 'undefined' ? getSignupAttributionForProfile() : {}
        const onboardingAt = oAsset && oRisk && oHorizon ? new Date().toISOString() : null
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: data.user.id,
            full_name: profile.fullName || '',
            nickname: profile.nickname || '',
            phone: profile.phone || null,
            marketing_opt_in: Boolean(profile.marketingOptIn),
            event_coupon_opt_in: Boolean(profile.eventCouponOptIn),
            consent_acknowledged_at: new Date().toISOString(),
            onboarding_asset_mix: oAsset || null,
            onboarding_risk_tolerance: oRisk || null,
            onboarding_investment_horizon: oHorizon || null,
            onboarding_answers_at: onboardingAt,
            ...signupAttrProfile,
          }, { onConflict: 'user_id' })
        if (profileError) throw profileError
      }

      return data
    } catch (err) {
      const mapped = mapAuthErrorMessage(err.message)
      setError(mapped)
      throw new Error(mapped)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    setError(null)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      const mapped = mapAuthErrorMessage(err.message)
      setError(mapped)
      throw new Error(mapped)
    } finally {
      setLoading(false)
    }
  }

  const resendVerificationEmail = async (email) => {
    setLoading(true)
    setError(null)
    try {
      const { error: authError } = await supabase.auth.resend({ type: 'signup', email })
      if (authError) throw authError
    } catch (err) {
      const mapped = mapAuthErrorMessage(err.message)
      setError(mapped)
      throw new Error(mapped)
    } finally {
      setLoading(false)
    }
  }

  const requestPasswordReset = async (email) => {
    setLoading(true)
    setError(null)
    try {
      // Supabase の「Redirect URLs」に載せる本番URLと一致させる（www 有無のブレを避ける）
      const redirectTo = `${SITE_ORIGIN.replace(/\/$/, '')}/reset-password`
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (authError) throw authError
    } catch (err) {
      const mapped = mapAuthErrorMessage(err.message)
      setError(mapped)
      throw new Error(mapped)
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async (newPassword) => {
    setLoading(true)
    setError(null)
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword })
      if (authError) throw authError
    } catch (err) {
      const mapped = mapAuthErrorMessage(err.message)
      setError(mapped)
      throw new Error(mapped)
    } finally {
      setLoading(false)
    }
  }

  return {
    signIn,
    signUp,
    signOut,
    resendVerificationEmail,
    requestPasswordReset,
    updatePassword,
    loading,
    error,
  }
}
