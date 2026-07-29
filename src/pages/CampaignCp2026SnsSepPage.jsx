import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/** Campaign landing placeholder — route must resolve for production builds. */
export default function CampaignCp2026SnsSepPage() {
  useDocumentTitle('キャンペーン')

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">キャンペーンページ</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        このキャンペーンの詳細はまもなく公開されます。
      </p>
      <Link to="/" className="inline-flex text-sm font-semibold text-orange-600 hover:text-orange-700">
        ホームに戻る
      </Link>
    </div>
  )
}
