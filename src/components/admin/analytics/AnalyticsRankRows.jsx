import { fmt } from './analyticsFormat'

export default function AnalyticsRankRows({
  rows = [],
  labelKey,
  valueKey,
  maxValue,
  emptyLabel = 'No data',
  getLabel,
  getSublabel,
  onCsv,
}) {
  const max = Number(maxValue || 0) || Math.max(1, ...rows.map((r) => Number(r[valueKey] || 0)))
  return (
    <div>
      {onCsv ? (
        <div className="flex justify-end mb-2">
          <button type="button" onClick={onCsv} className="text-[11px] font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            CSV
          </button>
        </div>
      ) : null}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {rows.map((row, idx) => {
          const label = getLabel ? getLabel(row) : row[labelKey]
          const value = Number(row[valueKey] || 0)
          const pct = max > 0 ? Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100)) : 0
          return (
            <div key={`${label}-${idx}`}>
              <div className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{label || '—'}</p>
                  {getSublabel ? (
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">{getSublabel(row)}</p>
                  ) : null}
                </div>
                <p className="tabular-nums font-semibold text-gray-900 dark:text-white shrink-0">{fmt(value)}</p>
              </div>
              <div className="mt-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-gray-500 dark:bg-gray-400" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
        {rows.length === 0 ? <p className="text-sm text-gray-500 py-4">{emptyLabel}</p> : null}
      </div>
    </div>
  )
}
