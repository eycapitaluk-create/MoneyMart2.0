import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { sanitizeInternalRedirectPath } from '../lib/navigationGuards'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, resendVerificationEmail, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [resendSuccess, setResendSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)
  const redirectTo = sanitizeInternalRedirectPath(location.state?.from, '/')
  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      await signIn(email, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setMessage(err?.message || 'ログインに失敗しました。')
      setResendSuccess(false)
      const msg = String(err?.message || '')
      if (msg.includes('パスワード') || msg.includes('ログイン')) {
        passwordInputRef.current?.focus()
      } else {
        emailInputRef.current?.focus()
      }
    }
  }

  const handleResendVerification = async () => {
    if (!email?.trim()) return
    setMessage('')
    setResendSuccess(false)
    try {
      await resendVerificationEmail(email.trim())
      setResendSuccess(true)
      setMessage('')
    } catch (err) {
      setMessage(err?.message || '再送に失敗しました。')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
      <Card className="p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">ログイン</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          登録したメールアドレスとパスワードでログインしてください。
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メールアドレス</label>
            <input
              id="login-email"
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="email@example.com"
              autoComplete="email"
              name="email"
              aria-invalid={Boolean(message)}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード</label>
            <input
              id="login-password"
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              autoComplete="current-password"
              name="password"
              aria-invalid={Boolean(message)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300 hover:underline"
            >
              {showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
            </button>
            <p className="mt-1 text-right">
              <Link to="/forgot-password" className="text-xs text-primary-blue hover:underline">パスワードを忘れた</Link>
            </p>
          </div>
          {message && <p className="text-sm text-red-500">{message}</p>}
          {resendSuccess && <p className="text-sm text-green-600 dark:text-green-400">確認メールを再送しました。受信トレイをご確認ください。</p>}
          {message?.includes('メール認証が完了していません') && email?.trim() && (
            <button
              type="button"
              onClick={handleResendVerification}
              className="text-sm text-primary-blue hover:underline"
              disabled={loading}
            >
              確認メールを再送
            </button>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          アカウントをお持ちでないですか？{' '}
          <Link to="/signup" state={{ from: redirectTo }} className="text-primary-blue hover:underline">会員登録</Link>
        </p>
      </Card>
    </div>
  )
}
