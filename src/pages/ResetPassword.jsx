import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { isPasswordLongEnough, MIN_PASSWORD_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE } from '../constants/authPassword'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const hash = window.location.hash || ''
    const hasRecoveryHash = hash.includes('type=recovery') || hash.includes('access_token')

    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (data?.session) {
        setReady(true)
        return
      }
      if (hasRecoveryHash) {
        setReady(true)
        return
      }
      setMessage('無効または期限切れのリンクです。再度パスワード再設定メールを請求してください。')
      setReady(true)
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || (hasRecoveryHash && event === 'INITIAL_SESSION')) {
        setReady(true)
      }
    })

    check()
    return () => sub?.subscription?.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    if (password !== confirm) {
      setMessage('パスワードが一致しません。')
      return
    }
    if (!isPasswordLongEnough(password)) {
      setMessage(PASSWORD_MIN_LENGTH_MESSAGE)
      return
    }
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      setMessage(err?.message || 'パスワードの更新に失敗しました。')
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
        <Card className="p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">パスワードを変更しました</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">ログイン画面に移動します。</p>
        </Card>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
        <Card className="p-8 w-full max-w-md">
          <p className="text-sm text-gray-600 dark:text-gray-400">確認中...</p>
        </Card>
      </div>
    )
  }

  if (message && !password && !confirm && message.includes('無効')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
        <Card className="p-8 w-full max-w-md">
          <p className="text-sm text-red-500 mb-4">{message}</p>
          <Link to="/forgot-password" className="text-primary-blue hover:underline text-sm">再設定メールを送る</Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
      <Card className="p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">新しいパスワードを設定</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {MIN_PASSWORD_LENGTH}文字以上で入力してください。
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">新しいパスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder={`${MIN_PASSWORD_LENGTH}文字以上`}
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード（確認）</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="再入力"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>
          {message && <p className="text-sm text-red-500">{message}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '更新中...' : 'パスワードを更新'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <Link to="/login" className="text-primary-blue hover:underline">ログインに戻る</Link>
        </p>
      </Card>
    </div>
  )
}
