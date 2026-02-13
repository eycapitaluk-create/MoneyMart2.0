import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-5xl font-black text-slate-900 dark:text-white">404</p>
        <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
          ページが見つかりませんでした。
        </p>
        <Link
          to="/"
          className="inline-flex mt-5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold"
        >
          ホームへ戻る
        </Link>
      </div>
    </div>
  )
}
