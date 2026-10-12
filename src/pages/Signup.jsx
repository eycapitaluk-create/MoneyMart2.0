import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import AppleSignInButton from '../components/auth/AppleSignInButton'
import GoogleSignInButton, { AuthDivider } from '../components/auth/GoogleSignInButton'
import { useAuth } from '../hooks/useAuth'
import { sanitizeInternalRedirectPath } from '../lib/navigationGuards'
import { storeAuthRedirectPath } from '../lib/authRedirectStorage'
import { supabase } from '../lib/supabase'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { isPasswordLongEnough, MIN_PASSWORD_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE } from '../constants/authPassword'

export default function Signup() {
  useDocumentTitle('新規登録 | MoneyMart')
  const navigate = useNavigate()
  const location = useLocation()
  const { signUp, loading, resendVerificationEmail } = useAuth()
  const redirectTo = sanitizeInternalRedirectPath(location.state?.from, '/')
  const diagnosisIntent = location.state?.intent === 'diagnosis'

  useEffect(() => {
    if (redirectTo && redirectTo !== '/') storeAuthRedirectPath(redirectTo)
  }, [redirectTo])
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreeLegal, setAgreeLegal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingEmailVerify, setPendingEmailVerify] = useState(false)
  const [resendNotice, setResendNotice] = useState('')
  const [resendBusy, setResendBusy] = useState(false)
  const nicknameInputRef = useRef(null)
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)
  const legalCheckboxRef = useRef(null)

  const finishSignupNavigation = async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    navigate(redirectTo, { replace: true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setPendingEmailVerify(false)

    const safeNickname = nickname.trim()
    const safeEmail = email.trim()

    if (!safeNickname || !safeEmail || !password) {
      setMessage('ニックネーム・メール・パスワードを入力してください。')
      if (!safeNickname) nicknameInputRef.current?.focus()
      else if (!safeEmail) emailInputRef.current?.focus()
      else passwordInputRef.current?.focus()
      return
    }
    if (!isPasswordLongEnough(password)) {
      setMessage(PASSWORD_MIN_LENGTH_MESSAGE)
      passwordInputRef.current?.focus()
      return
    }
    if (!agreeLegal) {
      setMessage('利用規約・プライバシーポリシー・免責事項への同意が必要です。')
      legalCheckboxRef.current?.focus()
      return
    }

    try {
      const data = await signUp({
        email: safeEmail,
        password,
        profile: {
          nickname: safeNickname,
          consentAcknowledged: true,
        },
      })

      if (data?.session) {
        await finishSignupNavigation()
        return
      }

      setPendingEmailVerify(true)
    } catch (err) {
      setMessage(err?.message || '登録に失敗しました。')
    }
  }

  const handleResendVerification = async () => {
    const addr = email.trim()
    if (!addr) return
    setResendNotice('')
    setResendBusy(true)
    try {
      await resendVerificationEmail(addr)
      setResendNotice('確認メールを再送信しました。')
    } catch (err) {
      setResendNotice(err?.message || '再送信に失敗しました。')
    } finally {
      setResendBusy(false)
    }
  }

  if (pendingEmailVerify) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
        <Card className="p-8 w-full max-w-lg text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">あと少しで完了です</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
            <strong>{email.trim()}</strong>
            {' '}
            に確認メールを送りました。リンクを開くとログインできます（届かなくても、後から画面上部のバナーで再送できます）。
          </p>
          {resendNotice ? (
            <p className={`text-xs mb-4 ${resendNotice.includes('失敗') ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {resendNotice}
            </p>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendBusy}
              className="inline-block px-6 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold disabled:opacity-50"
            >
              {resendBusy ? '送信中…' : '確認メールを再送'}
            </button>
            <Link
              to="/login"
              state={{ from: redirectTo }}
              className="inline-block px-6 py-2.5 rounded-lg bg-primary-blue text-white text-sm font-semibold"
            >
              ログインへ
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4 py-8">
      <Card className="p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {diagnosisIntent ? '無料で診断結果を保存' : '無料会員登録'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {diagnosisIntent
            ? '30秒の診断回答をマイページに保存します。口座・銀行の連携は不要です。'
            : '1分で登録。ニックネームとメールだけで始められます。'}
        </p>

        <div className="space-y-3 mb-6">
          <GoogleSignInButton redirectAfterAuth={redirectTo} label="Googleで登録（1タップ）" />
          <AppleSignInButton redirectAfterAuth={redirectTo} label="Appleで登録（1タップ）" />
          <AuthDivider />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="signup-nickname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ニックネーム *
            </label>
            <input
              id="signup-nickname"
              ref={nicknameInputRef}
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="表示名（例: taro_invest）"
              autoComplete="nickname"
              maxLength={32}
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              メールアドレス *
            </label>
            <input
              id="signup-email"
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="email@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              パスワード *
            </label>
            <input
              id="signup-password"
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder={`${MIN_PASSWORD_LENGTH}文字以上`}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300 hover:underline"
            >
              {showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
            </button>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              ref={legalCheckboxRef}
              type="checkbox"
              checked={agreeLegal}
              onChange={(e) => setAgreeLegal(e.target.checked)}
              className="mt-1 rounded"
            />
            <span>
              <Link to="/legal/terms" className="text-primary-blue hover:underline">利用規約</Link>
              ・
              <Link to="/legal/privacy" className="text-primary-blue hover:underline">プライバシーポリシー</Link>
              ・
              <Link to="/legal/disclaimer" className="text-primary-blue hover:underline">免責事項</Link>
              {' '}
              に同意します *
            </span>
          </label>

          {message ? <p className="text-sm text-red-500">{message}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登録中…' : 'メールアドレスで登録'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          すでにアカウントをお持ちですか？{' '}
          <Link to="/login" state={{ from: redirectTo }} className="text-primary-blue hover:underline">ログイン</Link>
        </p>
      </Card>
    </div>
  )
}
