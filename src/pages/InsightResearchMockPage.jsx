import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/** Admin insight mock preview — route must exist for /admin/insights-mock builds. */
export default function InsightResearchMockPage() {
  useDocumentTitle('Insights Mock')

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Insight research mock</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Mock preview is not available in this build. Use the insights admin tools instead.
      </p>
      <Link to="/insights" className="inline-flex text-sm font-semibold text-orange-600 hover:text-orange-700">
        Insightsへ
      </Link>
    </div>
  )
}
