import { Link } from 'react-router-dom'
import { useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'

export default function ForgotPassword() {
  const { requestPasswordReset, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setMessage(err?.message || '送信に失敗しました。')
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
        <Card className="p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">メールを送信しました</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {email} にパスワード再設定のリンクを送りました。受信トレイに見当たらない場合は迷惑メール・プロモーション欄もご確認ください。それでも届かないときは、登録メールアドレスの表記揺れ（大文字・小文字・別ドメイン）がないかご確認ください。
          </p>
          <Link to="/login" className="text-primary-blue hover:underline text-sm">ログインに戻る</Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans flex items-center justify-center px-4">
      <Card className="p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">パスワードを忘れた</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          登録したメールアドレスを入力してください。再設定用のリンクを送信します。
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              placeholder="email@example.com"
              required
            />
          </div>
          {message && <p className="text-sm text-red-500">{message}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '送信中...' : '送信'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <Link to="/login" className="text-primary-blue hover:underline">ログインに戻る</Link>
        </p>
      </Card>
    </div>
  )
}
