import { panelClass, panelPad, rangeBtn, subTabBtn, titleClass } from '../crm/crmUi'
import AnalyticsInsightStrip from './AnalyticsInsightStrip'
import AnalyticsKpiStrip from './AnalyticsKpiStrip'
import AnalyticsProductPanel from './AnalyticsProductPanel'
import AnalyticsTrafficPanel from './AnalyticsTrafficPanel'
import AnalyticsUsersPanel from './AnalyticsUsersPanel'

const SUB_TABS = [
  { id: 'traffic', label: 'Traffic' },
  { id: 'users', label: 'Users' },
  { id: 'product', label: 'Product' },
]

export default function AnalyticsWorkbench({
  section,
  onSectionChange,
  rangeDays,
  onRangeDaysChange,
  onRefresh,
  loading = false,
  error = '',
  sourceBadge,
  analytics,
  productDashboard,
  trafficChannels,
  topReferrers,
  onDownloadCsv,
  onOpenCrm,
  analysis,
}) {
  return (
    <div className="space-y-4">
      <div className={`${panelClass} ${panelPad} sticky top-[7.25rem] z-[70] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <h2 className={titleClass}>Site analytics</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Page views, acquisition, activity, and product usage. Staff /admin excluded.
              {sourceBadge?.label ? ` · ${sourceBadge.label}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <span className="text-[10px] font-medium text-gray-500">Range</span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onRangeDaysChange?.(d)}
                className={rangeBtn(rangeDays === d)}
              >
                {d}d
              </button>
            ))}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : null}

      {analytics?.dataSource === 'client' ? (
        <p className="text-[11px] text-amber-800 dark:text-amber-200">
          Browser summary (capped rows). Full-range compare needs admin_site_analytics_dashboard RPC.
        </p>
      ) : null}

      <AnalyticsKpiStrip analytics={analytics} rangeDays={rangeDays} />
      <AnalyticsInsightStrip analysis={analysis} />

      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800 pb-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSectionChange?.(tab.id)}
            className={subTabBtn(section === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {section === 'traffic' ? (
        <AnalyticsTrafficPanel
          analytics={analytics}
          trafficChannels={trafficChannels}
          topReferrers={topReferrers}
          rangeDays={rangeDays}
          onDownloadCsv={onDownloadCsv}
          onOpenCrm={onOpenCrm}
        />
      ) : null}

      {section === 'users' ? (
        <AnalyticsUsersPanel
          analytics={analytics}
          rangeDays={rangeDays}
          onDownloadCsv={onDownloadCsv}
        />
      ) : null}

      {section === 'product' ? (
        <AnalyticsProductPanel
          productDashboard={productDashboard}
          analytics={analytics}
          rangeDays={rangeDays}
          onDownloadCsv={onDownloadCsv}
        />
      ) : null}
    </div>
  )
}
