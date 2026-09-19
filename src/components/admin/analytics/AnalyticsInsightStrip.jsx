import { panelClass, panelPad, labelClass, titleClass, pctOrDash } from '../crm/crmUi'

export default function AnalyticsInsightStrip({ analysis }) {
  if (!analysis) return null
  const r = analysis.rates || {}
  const s = analysis.stickiness || {}
  return (
    <div className={`${panelClass} ${panelPad}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0">
          <p className={labelClass}>Binding constraint</p>
          <p className={`${titleClass} mt-1`}>{analysis.constraint}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{analysis.constraintNote}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {[
            ['DAU/MAU', pctOrDash(s.dauMauPct)],
            ['WAU/MAU', pctOrDash(s.wauMauPct)],
            ['Click / session', pctOrDash(r.clickPerSessionPct)],
            ['Search / session', pctOrDash(r.searchPerSessionPct)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className={labelClass}>{label}</p>
              <p className="text-lg font-semibold tabular-nums mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[11px] text-gray-500">
        <p>Pages / session {r.pagesPerSession ?? '—'}</p>
        <p>Logged-in share {pctOrDash(s.loggedInSharePct)}</p>
        <p>Returning (logged-in) {pctOrDash(s.returningSharePct)}</p>
        <p>Top-3 page share {pctOrDash(analysis.concentration?.top3PageSharePct)} · HHI {analysis.concentration?.pageHhi ?? '—'}</p>
      </div>
      {analysis.worstDrop ? (
        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2">
          Largest funnel drop-off: {analysis.worstDrop.step} ({analysis.worstDrop.dropoffPct}% lost from previous step).
        </p>
      ) : null}
    </div>
  )
}
