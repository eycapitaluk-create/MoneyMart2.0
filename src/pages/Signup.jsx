import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export default function Signup() {
  const navigate = useNavigate()
  const { signUp, signInWithGoogle, loading } = useAuth()
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setIsSuccess(false)
    if (!fullName.trim() || !nickname.trim() || !email.trim() || !password) {
      setMessage('必須項目をすべて入力してください。')
      return
    }
    if (!PASSWORD_RULE.test(password)) {
      setMessage('パスワードは8文字以上で英字と数字を含めてください。')
      return
    }
    if (password !== confirmPassword) {
      setMessage('確認用パスワードが一致しません。')
      return
    }
    if (!agreeTerms || !agreePrivacy) {
      setMessage('利用規約とプライバシーポリシーへの同意が必要です。')
      return
    }
    try {
      await signUp({
        email,
        password,
        profile: {
          fullName: fullName.trim(),
          nickname: nickname.trim(),
          phone: phone.trim(),
          marketingOptIn,
        },
      })
      setIsSuccess(true)
      setMessage('登録が完了しました。確認メールをチェックしてください。')
      navigate('/login')
    } catch (err) {
      setMessage(err?.message || '登録に失敗しました。')
    }
  }

  const handleGoogleSignup = async () => {
    setMessage('')
    setIsSuccess(false)
    try {
      await signInWithGoogle()
    } catch (err) {
      setMessage(err?.message || 'Googleログインに失敗しました。')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
      <Card className="p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">会員登録</h1>
        <button
          type="button"
          onClick={handleGoogleSignup}
          className="w-full mb-4 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          disabled={loading}
        >
          Googleで続行
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
          <span className="text-xs text-gray-400">またはメールで登録</span>
          <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">お名前 *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                placeholder="山田 太郎"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">電話番号 (任意)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="090-1234-5678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="8文字以上、英字+数字"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード確認</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-1" />
              <span>
                <Link to="/legal/terms" className="text-primary-blue hover:underline">利用規約</Link>
                {' '}に同意します。*
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="mt-1" />
              <span>
                <Link to="/legal/privacy" className="text-primary-blue hover:underline">プライバシーポリシー</Link>
                {' '}に同意します。*
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-1" />
              <span>キャンペーン・お得情報の受信を希望します。(任意)</span>
            </label>
          </div>
          {message && <p className={`text-sm ${isSuccess ? 'text-green-600' : 'text-red-500'}`}>{message}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登録中...' : '登録する'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          すでにアカウントをお持ちですか？{' '}
          <Link to="/login" className="text-primary-blue hover:underline">ログイン</Link>
        </p>
      </Card>
    </div>
  )
}
