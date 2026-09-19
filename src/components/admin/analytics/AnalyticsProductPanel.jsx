import { panelClass, panelPad, titleClass, labelClass, fmt } from '../crm/crmUi'
import { formatAnalyticsDuration } from './analyticsFormat'
import AnalyticsRankRows from './AnalyticsRankRows'

const PAGE_BUCKET_HINTS = {
  funds_list: '/funds',
  fund_detail: '/funds/:id',
  fund_compare: '/funds/compare',
  stocks: '/stocks',
  mypage: '/mypage',
  tools: '/tools',
  market: '/market',
  insights: '/insights',
  products: '/products',
  home: '/',
  other: '',
}

export default function AnalyticsProductPanel({
  productDashboard,
  analytics,
  rangeDays,
  onDownloadCsv,
}) {
  const s = productDashboard?.summary || {}

  return (
    <div className="space-y-4">
      <div className={`${panelClass} ${panelPad}`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Page views (areas)', fmt(s.totalAreaViews)],
            ['Unique sessions', fmt(s.uniqueSessions)],
            ['Typical dwell', formatAnalyticsDuration(s.medianDwellMs || s.avgDwellMs)],
            ['Product clicks', fmt(s.productClicks)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className={labelClass}>{label}</p>
              <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Page areas</h3>
          <AnalyticsRankRows
            rows={productDashboard?.rollups}
            valueKey="views"
            maxValue={productDashboard?.maxAreaViews}
            getLabel={(r) => r.label}
            getSublabel={(r) => [
              PAGE_BUCKET_HINTS[r.id],
              `Sessions ${fmt(r.unique_sessions_sum)}`,
              `Dwell ${formatAnalyticsDuration(r.avg_dwell_ms)}`,
            ].filter(Boolean).join(' · ')}
            emptyLabel="No page data."
            onCsv={() => onDownloadCsv?.(`analytics-page-areas-${rangeDays}d.csv`, productDashboard.rollups, [
              { header: 'area_id', key: 'id' },
              { header: 'label', key: 'label' },
              { header: 'views', key: 'views' },
              { header: 'unique_sessions_sum_non_deduped', key: 'unique_sessions_sum' },
              { header: 'avg_dwell_ms', key: 'avg_dwell_ms' },
            ])}
          />
        </div>
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Fund / ETF clicks</h3>
          <AnalyticsRankRows
            rows={productDashboard?.fundClicks}
            valueKey="clicks"
            maxValue={productDashboard?.maxFundClicks}
            getLabel={(r) => r.product_name || r.product_id}
            getSublabel={(r) => `${r.product_id} · Sessions ${fmt(r.unique_sessions)}`}
            emptyLabel="No fund-like clicks."
            onCsv={() => onDownloadCsv?.(`analytics-fund-clicks-${rangeDays}d.csv`, productDashboard.fundClicks, [
              { header: 'product_type', key: 'product_type' },
              { header: 'product_id', key: 'product_id' },
              { header: 'product_name', key: 'product_name' },
              { header: 'clicks', key: 'clicks' },
              { header: 'unique_sessions', key: 'unique_sessions' },
            ])}
          />
        </div>
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Top products</h3>
          <AnalyticsRankRows
            rows={analytics?.topProducts}
            valueKey="clicks"
            getLabel={(r) => r.product_name || r.product_id}
            getSublabel={(r) => `${r.product_type} · Sessions ${fmt(r.unique_sessions)}`}
            emptyLabel="No click data."
            onCsv={() => onDownloadCsv?.(`analytics-top-products-${rangeDays}d.csv`, analytics.topProducts, [
              { header: 'product_type', key: 'product_type' },
              { header: 'product_id', key: 'product_id' },
              { header: 'product_name', key: 'product_name' },
              { header: 'clicks', key: 'clicks' },
              { header: 'unique_sessions', key: 'unique_sessions' },
            ])}
          />
        </div>
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Event breakdown</h3>
          <AnalyticsRankRows
            rows={analytics?.eventBreakdown}
            valueKey="events"
            getLabel={(r) => r.event_name}
            getSublabel={(r) => `Sessions ${fmt(r.unique_sessions)}`}
            emptyLabel="No events."
            onCsv={() => onDownloadCsv?.(`analytics-events-${rangeDays}d.csv`, analytics.eventBreakdown, [
              { header: 'event_name', key: 'event_name' },
              { header: 'events', key: 'events' },
              { header: 'unique_sessions', key: 'unique_sessions' },
            ])}
          />
        </div>
      </div>
    </div>
  )
}
