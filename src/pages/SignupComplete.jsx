import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/** Post-signup landing — keeps /signup-complete from 404ing after auth flows. */
export default function SignupComplete() {
  useDocumentTitle('登録完了')

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">登録ありがとうございます</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          アカウントの準備ができました。マイページで家計・保有資産の管理を始められます。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/mypage"
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            マイページへ
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ホームへ
          </Link>
        </div>
      </Card>
    </div>
  )
}
