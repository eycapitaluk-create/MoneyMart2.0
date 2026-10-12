import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { SITE_ORIGIN } from '../lib/seoConfig'
import { getAuthCallbackUrl } from '../lib/authCallbackUrl'
import { peekAuthRedirectPath, storeAuthRedirectPath } from '../lib/authRedirectStorage'
import { authNextMetadata } from '../lib/authReturnPath'
import { clearPendingReferralCode, getPendingReferralCode } from '../lib/referralStorage'
import {
  getSignupAttributionForProfile,
  getSignupAttributionForUserMetadata,
  refreshSignupAttributionFromBrowser,
} from '../lib/analytics'
import { PASSWORD_MIN_LENGTH_MESSAGE } from '../constants/authPassword'

/** @deprecated use getAuthCallbackUrl() — kept for docs/imports */
export const AUTH_CALLBACK_PATH = '/signup-complete'

const mapAuthErrorMessage = (message = '') => {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) return 'メールアドレスまたはパスワードが正しくありません。'
  if (lower.includes('email not confirmed')) return 'メール認証が完了していません。受信メールをご確認ください。'
  if (lower.includes('already registered')) return 'このメールアドレスは既に登録されています。'
  if (lower.includes('password should be at least')) return PASSWORD_MIN_LENGTH_MESSAGE
  if (lower.includes('database error saving new user')) {
    return '登録処理でサーバーエラーが発生しました。しばらくしてから再度お試しください。'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return '送信が集中しています。数分後にもう一度お試しください。'
  }
  if (lower.includes('redirect') && lower.includes('not allowed')) {
    return 'ログイン設定（Redirect URLs）に不整合があります。サポートまでお問い合わせください。'
  }
  if (lower.includes('provider is not enabled')) {
    return 'ソーシャルログインは現在準備中です。メールアドレスで登録してください。'
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
      const safeEmail = String(email || '').trim()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: safeEmail,
        password,
      })
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

  const signInWithOAuthProvider = async (provider, { redirectAfterAuth = '/', queryParams } = {}) => {
    setLoading(true)
    setError(null)
    try {
      storeAuthRedirectPath(redirectAfterAuth)
      if (typeof window !== 'undefined') refreshSignupAttributionFromBrowser()
      const signupAttrMeta = typeof window !== 'undefined' ? getSignupAttributionForUserMetadata() : {}
      const referralCode = typeof window !== 'undefined' ? getPendingReferralCode() : ''
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthCallbackUrl(),
          ...(queryParams ? { queryParams } : {}),
          data: {
            ...signupAttrMeta,
            ...authNextMetadata(redirectAfterAuth),
            ...(referralCode ? { referral_code: referralCode } : {}),
          },
        },
      })
      if (authError) throw authError
    } catch (err) {
      const mapped = mapAuthErrorMessage(err.message)
      setError(mapped)
      throw new Error(mapped)
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = (opts) => signInWithOAuthProvider('google', {
    ...opts,
    queryParams: { access_type: 'online', prompt: 'select_account' },
  })

  const signInWithApple = (opts) => signInWithOAuthProvider('apple', opts)

  const signUp = async ({ email, password, profile = {}, referralCodeManual = '' }) => {
    setLoading(true)
    setError(null)
    const fromUrl = typeof window !== 'undefined' ? getPendingReferralCode() : ''
    const manual = String(referralCodeManual || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    const referralCode = manual.length >= 4 ? manual : fromUrl
    if (typeof window !== 'undefined') refreshSignupAttributionFromBrowser()
    const signupAttrMeta = typeof window !== 'undefined' ? getSignupAttributionForUserMetadata() : {}
    const nickname = String(profile.nickname || '').trim()
    const consentAcknowledged = Boolean(profile.consentAcknowledged)
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: String(email || '').trim(),
        password,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
          data: {
            nickname,
            consent_acknowledged: consentAcknowledged,
            marketing_opt_in: Boolean(profile.marketingOptIn),
            ...signupAttrMeta,
            ...authNextMetadata(typeof window !== 'undefined' ? peekAuthRedirectPath('/') : '/'),
            ...(referralCode ? { referral_code: referralCode } : {}),
          },
        },
      })
      if (authError) throw authError

      if (referralCode) clearPendingReferralCode()

      if (data?.session && data?.user?.id) {
        const signupAttrProfile = typeof window !== 'undefined' ? getSignupAttributionForProfile() : {}
        const nowIso = new Date().toISOString()
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: data.user.id,
            nickname,
            marketing_opt_in: Boolean(profile.marketingOptIn),
            consent_acknowledged_at: consentAcknowledged ? nowIso : null,
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
      const { error: authError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: getAuthCallbackUrl() },
      })
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
    signInWithGoogle,
    signInWithApple,
    signUp,
    signOut,
    resendVerificationEmail,
    requestPasswordReset,
    updatePassword,
    loading,
    error,
  }
}
