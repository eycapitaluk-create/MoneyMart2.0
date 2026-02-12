import { useState } from 'react'
import { supabase } from '../lib/supabase'

const mapAuthErrorMessage = (message = '') => {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) return 'メールアドレスまたはパスワードが正しくありません。'
  if (lower.includes('email not confirmed')) return 'メール認証が完了していません。受信メールをご確認ください。'
  if (lower.includes('already registered')) return 'このメールアドレスは既に登録されています。'
  if (lower.includes('password should be at least')) return 'パスワードは8文字以上で入力してください。'
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

  const signUp = async ({ email, password, profile = {} }) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: profile.fullName || '',
            nickname: profile.nickname || '',
            phone: profile.phone || '',
            marketing_opt_in: Boolean(profile.marketingOptIn),
          },
        },
      })
      if (authError) throw authError

      if (data?.session && data?.user?.id) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: data.user.id,
            full_name: profile.fullName || '',
            nickname: profile.nickname || '',
            phone: profile.phone || null,
            marketing_opt_in: Boolean(profile.marketingOptIn),
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

  const signInWithGoogle = async () => {
    setLoading(true)
    setError(null)
    try {
      const redirectTo = `${window.location.origin}/mypage`
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
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

  return { signIn, signUp, signInWithGoogle, signOut, loading, error }
}
