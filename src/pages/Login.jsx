import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signInWithGoogle, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      await signIn(email, password)
      navigate('/mypage')
    } catch (err) {
      setMessage(err?.message || 'ログインに失敗しました。')
    }
  }

  const handleGoogleSignIn = async () => {
    setMessage('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setMessage(err?.message || 'Googleログインに失敗しました。')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
      <Card className="p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">ログイン</h1>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full mb-4 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          disabled={loading}
        >
          Googleでログイン
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
          <span className="text-xs text-gray-400">またはメールでログイン</span>
          <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1" />
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
          {message && <p className="text-sm text-red-500">{message}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          アカウントをお持ちでないですか？{' '}
          <Link to="/signup" className="text-primary-blue hover:underline">会員登録</Link>
        </p>
      </Card>
    </div>
  )
}
