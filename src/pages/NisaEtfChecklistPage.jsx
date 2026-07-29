import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/** NISA ETF checklist tool page — keeps /tools/nisa-etf-checklist routable. */
export default function NisaEtfChecklistPage() {
  useDocumentTitle('NISA ETFチェックリスト')

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NISA ETFチェックリスト</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        チェックリスト機能は準備中です。ファンド一覧から銘柄を確認できます。
      </p>
      <Link to="/funds" className="inline-flex text-sm font-semibold text-orange-600 hover:text-orange-700">
        ファンド一覧へ
      </Link>
    </div>
  )
}
