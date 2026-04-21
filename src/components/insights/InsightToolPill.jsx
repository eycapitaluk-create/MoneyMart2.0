import { Link } from 'react-router-dom'
import { getInsightToolLinkMeta } from '../../lib/insightToolLinks'

export default function InsightToolPill({ name, compact = false }) {
  const meta = getInsightToolLinkMeta(name)
  if (!meta) return null

  const baseClass = `inline-flex items-center gap-1.5 rounded-lg border font-bold transition ${
    compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-2 text-xs'
  }`
  const internalClass = `${baseClass} border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30`
  const externalClass = `${baseClass} border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-orange-300 dark:hover:border-orange-700 hover:text-orange-700 dark:hover:text-orange-300`

  if (meta.kind === 'external') {
    return (
      <a
        href={meta.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={externalClass}
      >
        <span>{meta.label}</span>
        <span>↗</span>
      </a>
    )
  }

  return (
    <Link to={meta.to} onClick={(e) => e.stopPropagation()} className={internalClass}>
      <span>{meta.label}</span>
      <span>→</span>
    </Link>
  )
}
