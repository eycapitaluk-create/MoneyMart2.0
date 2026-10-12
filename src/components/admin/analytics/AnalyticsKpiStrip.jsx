import { panelClass, panelPad, labelClass, monoNum } from '../crm/crmUi'
import { deltaClass, formatAnalyticsDeltaPct, formatAnalyticsDuration, fmt } from './analyticsFormat'

export default function AnalyticsKpiStrip({ analytics, rangeDays }) {
  const prev = analytics?.summaryPrev
  const items = [
    {
      label: 'Page views',
      value: fmt(analytics?.pageViews),
      note: `${fmt(analytics?.uniqueSessionsPageView)} sessions`,
      delta: prev ? formatAnalyticsDeltaPct(analytics.pageViews, prev.pageViews) : null,
    },
    {
      label: 'Product clicks',
      value: fmt(analytics?.productClicks),
      note: `${fmt(analytics?.uniqueProductClickSessions)} sessions`,
      delta: prev ? formatAnalyticsDeltaPct(analytics.productClicks, prev.productClicks) : null,
    },
    {
      label: 'Searches',
      value: fmt(analytics?.searches),
      note: `${fmt(analytics?.uniqueSearchSessions)} sessions`,
      delta: prev ? formatAnalyticsDeltaPct(analytics.searches, prev.searches) : null,
    },
    {
      label: 'Referrer landings',
      value: fmt(analytics?.landingViews),
      note: `${fmt(analytics?.uniqueLandingSessions)} sessions`,
      delta: prev ? formatAnalyticsDeltaPct(analytics.landingViews, prev.landingViews) : null,
    },
    {
      label: 'Typical dwell',
      value: formatAnalyticsDuration(analytics?.medianDwellMs || analytics?.avgDwellMs),
      note: `avg ${formatAnalyticsDuration(analytics?.avgDwellMs)}`,
      delta: prev
        ? formatAnalyticsDeltaPct(
          analytics?.medianDwellMs || analytics?.avgDwellMs,
          prev.medianDwellMs || prev.avgDwellMs,
        )
        : null,
    },
  ]

  return (
    <div className={`${panelClass} ${panelPad}`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className={labelClass}>{item.label}</p>
            <p className={`text-xl sm:text-2xl mt-1 ${monoNum}`}>{item.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{item.note}</p>
            {item.delta ? (
              <p className={`text-[10px] font-medium mt-0.5 ${deltaClass(item.delta)}`}>
                vs prior {rangeDays}d {item.delta}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
