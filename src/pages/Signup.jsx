import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { getPendingReferralCode } from '../lib/referralStorage'
import { sanitizeInternalRedirectPath } from '../lib/navigationGuards'
import {
  ONBOARDING_ASSET_MIX_OPTIONS,
  ONBOARDING_RISK_TOLERANCE_OPTIONS,
  ONBOARDING_HORIZON_OPTIONS,
} from '../lib/investorOnboardingOptions'

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export default function Signup() {
  const location = useLocation()
  const { signUp, loading } = useAuth()
  const redirectTo = sanitizeInternalRedirectPath(location.state?.from, '/')
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [eventCouponOptIn, setEventCouponOptIn] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [referralCodeInput, setReferralCodeInput] = useState('')
  const [onboardingAssetMix, setOnboardingAssetMix] = useState('')
  const [onboardingRiskTolerance, setOnboardingRiskTolerance] = useState('')
  const [onboardingInvestmentHorizon, setOnboardingInvestmentHorizon] = useState('')
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const fullNameInputRef = useRef(null)
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)
  const confirmPasswordInputRef = useRef(null)
  const termsCheckboxRef = useRef(null)
  const onboardingAssetMixRef = useRef(null)

  useEffect(() => {
    const pending = getPendingReferralCode()
    if (pending) setReferralCodeInput(pending)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setIsSuccess(false)
    if (!fullName.trim() || !nickname.trim() || !email.trim() || !password) {
      setMessage('必須項目をすべて入力してください。')
      if (!fullName.trim()) fullNameInputRef.current?.focus()
      else if (!email.trim()) emailInputRef.current?.focus()
      else if (!password) passwordInputRef.current?.focus()
      return
    }
    if (!PASSWORD_RULE.test(password)) {
      setMessage('パスワードは8文字以上で英字と数字を含めてください。')
      passwordInputRef.current?.focus()
      return
    }
    if (password !== confirmPassword) {
      setMessage('確認用パスワードが一致しません。')
      confirmPasswordInputRef.current?.focus()
      return
    }
    if (!agreeTerms || !agreePrivacy || !agreeDisclaimer) {
      setMessage('利用規約・プライバシーポリシー・免責事項への同意が必要です。')
      termsCheckboxRef.current?.focus()
      return
    }
    const refNorm = referralCodeInput
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    if (refNorm.length > 0 && refNorm.length < 4) {
      setMessage('紹介コードは4文字以上の英数字で入力するか、空欄のままにしてください。')
      return
    }
    if (!onboardingAssetMix || !onboardingRiskTolerance || !onboardingInvestmentHorizon) {
      setMessage('投資プロフィール（3問）をすべて選択してください。')
      onboardingAssetMixRef.current?.focus()
      return
    }
    try {
      await signUp({
        email,
        password,
        referralCodeManual: refNorm.length >= 4 ? refNorm : '',
        profile: {
          fullName: fullName.trim(),
          nickname: nickname.trim(),
          phone: phone.trim(),
          marketingOptIn,
          eventCouponOptIn,
          onboardingAssetMix,
          onboardingRiskTolerance,
          onboardingInvestmentHorizon,
        },
      })
      setIsSuccess(true)
      setMessage('')
    } catch (err) {
      setMessage(err?.message || '登録に失敗しました。')
    }
  }

  const validateStep1 = () => {
    if (!fullName.trim() || !nickname.trim() || !email.trim() || !password) {
      setMessage('必須項目をすべて入力してください。')
      if (!fullName.trim()) fullNameInputRef.current?.focus()
      else if (!email.trim()) emailInputRef.current?.focus()
      else if (!password) passwordInputRef.current?.focus()
      return false
    }
    if (!PASSWORD_RULE.test(password)) {
      setMessage('パスワードは8文字以上で英字と数字を含めてください。')
      passwordInputRef.current?.focus()
      return false
    }
    if (password !== confirmPassword) {
      setMessage('確認用パスワードが一致しません。')
      confirmPasswordInputRef.current?.focus()
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!onboardingAssetMix || !onboardingRiskTolerance || !onboardingInvestmentHorizon) {
      setMessage('投資プロフィール（3問）をすべて選択してください。')
      onboardingAssetMixRef.current?.focus()
      return false
    }
    return true
  }

  const handleNextStep = () => {
    setMessage('')
    if (onboardingStep === 1 && !validateStep1()) return
    if (onboardingStep === 2 && !validateStep2()) return
    setOnboardingStep((prev) => Math.min(3, prev + 1))
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
        <Card className="p-8 w-full max-w-lg text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">メール認証をお願いします</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            <strong>{email}</strong> に確認メールを送信しました。<br />
            メール内のリンクをクリックして認証を完了してください。
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-6">
            メールが届かない場合は、迷惑メールフォルダをご確認ください。
          </p>
          <Link
            to="/login"
            state={{ from: redirectTo }}
            className="inline-block px-6 py-2.5 rounded-lg bg-primary-blue hover:bg-primary-blue/90 text-white text-sm font-semibold transition"
          >
            ログインへ
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
      <Card className="p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">会員登録</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          メールアドレスで無料登録できます。登録後、確認メールのリンクを開いて認証を完了してください。
        </p>
        <div className="mb-6">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
            <span>STEP {onboardingStep} / 3</span>
            <span>{onboardingStep === 1 ? 'アカウント作成' : onboardingStep === 2 ? '投資プロフィール' : '同意と完了'}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all"
              style={{ width: `${(onboardingStep / 3) * 100}%` }}
            />
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {onboardingStep === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">お名前 *</label>
              <input
                ref={fullNameInputRef}
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                placeholder="山田 太郎"
                autoComplete="name"
                name="fullName"
                aria-invalid={Boolean(message) && !fullName.trim()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ニックネーム *</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                placeholder="taro"
              />
            </div>
          </div>
          ) : null}
          {onboardingStep === 1 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メールアドレス</label>
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="email@example.com"
              autoComplete="email"
              name="email"
              aria-invalid={Boolean(message) && !email.trim()}
            />
          </div>
          ) : null}
          {onboardingStep === 2 ? (
          <div className="space-y-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-4">
            <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-wider">投資プロフィール（3問・必須）</p>
            <p className="text-xs text-indigo-900/90 dark:text-indigo-100/90 leading-relaxed">
              サービス改善・コンテンツ適合のための自己申告です。投資助言ではありません。回答は会員データベースに保存されます。
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">現在の資産状況 *</label>
              <select
                ref={onboardingAssetMixRef}
                required
                value={onboardingAssetMix}
                onChange={(e) => setOnboardingAssetMix(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                aria-invalid={Boolean(message) && !onboardingAssetMix}
              >
                <option value="">選択してください</option>
                {ONBOARDING_ASSET_MIX_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">リスクの考え方（ご自身の感覚で） *</label>
              <select
                required
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
                required
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
          {onboardingStep === 2 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">紹介コード（任意）</label>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              value={referralCodeInput}
              onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={32}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono tracking-wide"
              placeholder="例: 5811B1BD"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              招待リンク（?ref=）経由で開いた場合は自動入力されます。別端末で登録する場合は、お友だちから受け取ったコードを入力してください。
            </p>
          </div>
          ) : null}
          {onboardingStep === 3 ? (
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
              autoComplete="tel"
              name="phone"
            />
          </div>
          ) : null}
          {onboardingStep === 1 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード</label>
            <input
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="8文字以上、英字+数字"
              autoComplete="new-password"
              name="password"
              aria-invalid={Boolean(message) && (!password || !PASSWORD_RULE.test(password))}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300 hover:underline"
            >
              {showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
            </button>
          </div>
          ) : null}
          {onboardingStep === 1 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード確認</label>
            <input
              ref={confirmPasswordInputRef}
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              autoComplete="new-password"
              name="passwordConfirm"
              aria-invalid={Boolean(message) && password !== confirmPassword}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300 hover:underline"
            >
              {showConfirmPassword ? '確認パスワードを隠す' : '確認パスワードを表示'}
            </button>
          </div>
          ) : null}
          {onboardingStep === 3 ? (
          <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">必須同意</p>
            <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input ref={termsCheckboxRef} type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-1 rounded" />
              <span>
                <Link to="/legal/terms" className="text-primary-blue hover:underline">利用規約</Link>
                {' '}に同意します *
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="mt-1 rounded" />
              <span>
                <Link to="/legal/privacy" className="text-primary-blue hover:underline">プライバシーポリシー</Link>
                （個人情報の処理）に同意します *
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={agreeDisclaimer} onChange={(e) => setAgreeDisclaimer(e.target.checked)} className="mt-1 rounded" />
              <span>
                <Link to="/legal/disclaimer" className="text-primary-blue hover:underline">免責事項</Link>
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
          ) : null}
          {message && <p className={`text-sm ${isSuccess ? 'text-green-600' : 'text-red-500'}`}>{message}</p>}
          <div className="flex items-center gap-2">
            {onboardingStep > 1 ? (
              <Button type="button" className="w-full !bg-slate-200 !text-slate-700" onClick={() => setOnboardingStep((prev) => Math.max(1, prev - 1))}>
                戻る
              </Button>
            ) : null}
            {onboardingStep < 3 ? (
              <Button type="button" className="w-full" onClick={handleNextStep}>
                次へ
              </Button>
            ) : (
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '登録中...' : '登録する'}
              </Button>
            )}
          </div>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          すでにアカウントをお持ちですか？{' '}
          <Link to="/login" state={{ from: redirectTo }} className="text-primary-blue hover:underline">ログイン</Link>
        </p>
      </Card>
    </div>
  )
}
