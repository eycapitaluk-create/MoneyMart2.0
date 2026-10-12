import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatTrafficReferrerLabel } from '../../../lib/referrerBuckets'
import { panelClass, panelPad, titleClass, labelClass, fmt } from '../crm/crmUi'
import AnalyticsRankRows from './AnalyticsRankRows'

export default function AnalyticsTrafficPanel({
  analytics,
  trafficChannels = [],
  topReferrers = [],
  rangeDays,
  onDownloadCsv,
  onOpenCrm,
}) {
  const funnel = Array.isArray(analytics?.funnel) ? analytics.funnel : []
  const maxFunnel = Math.max(1, ...funnel.map((r) => Number(r.sessions || 0)))

  return (
    <div className="space-y-4">
      <div className={`${panelClass} ${panelPad}`}>
        <h3 className={titleClass}>Acquisition channels</h3>
        <p className="text-[11px] text-gray-500 mt-0.5 mb-3">Grouped referrer sessions · last {rangeDays}d</p>
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
          <table className="min-w-[480px] w-full">
            <thead className="bg-gray-50 dark:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-gray-500">Channel</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-gray-500">Sessions</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-gray-500 w-[40%]">Share</th>
              </tr>
            </thead>
            <tbody>
              {(trafficChannels.length ? trafficChannels : []).map((row) => {
                const total = trafficChannels.reduce((s, r) => s + Number(r.count || 0), 0) || 1
                const share = Math.round((Number(row.count || 0) / total) * 1000) / 10
                return (
                  <tr key={row.id || row.label} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 text-xs font-medium text-gray-900 dark:text-white">{row.label}</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{fmt(row.count)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div className="h-full bg-gray-500" style={{ width: `${Math.max(share, share > 0 ? 3 : 0)}%` }} />
                        </div>
                        <span className="text-[11px] tabular-nums text-gray-500 w-10 text-right">{share}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {trafficChannels.length === 0 ? <p className="p-4 text-sm text-gray-500">No channel data.</p> : null}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Signup first-touch lives in{' '}
          <button type="button" className="font-medium underline underline-offset-2" onClick={onOpenCrm}>CRM</button>.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Conversion funnel</h3>
          <div className="space-y-2.5 mt-3">
            {funnel.map((row, idx) => {
              const width = maxFunnel > 0 ? (Number(row.sessions || 0) / maxFunnel) * 100 : 0
              return (
                <div key={row.step}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{idx + 1}. {row.step}</span>
                    <span className="tabular-nums font-semibold">{fmt(row.sessions)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gray-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
            {funnel.length === 0 ? <p className="text-sm text-gray-500">No funnel data.</p> : null}
          </div>
        </div>

        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Daily trend</h3>
          <p className={`${labelClass} mt-0.5 mb-2`}>Views / searches / clicks · line = unique sessions</p>
          {analytics?.dailyTrend?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analytics.dailyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={32} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="pageViews" name="Page views" fill="#64748b" radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="left" dataKey="searches" name="Searches" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="left" dataKey="productClicks" name="Clicks" fill="#cbd5e1" radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="uniqueSessions" name="Sessions" stroke="#111827" strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-8">No trend data.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Top pages</h3>
          <AnalyticsRankRows
            rows={analytics?.topPages}
            valueKey="views"
            getLabel={(r) => r.page_path}
            getSublabel={(r) => `Sessions ${fmt(r.unique_sessions)}`}
            emptyLabel="No page data."
            onCsv={() => onDownloadCsv?.(`analytics-top-pages-${rangeDays}d.csv`, analytics.topPages, [
              { header: 'page_path', key: 'page_path' },
              { header: 'views', key: 'views' },
              { header: 'unique_sessions', key: 'unique_sessions' },
              { header: 'avg_dwell_ms', key: 'avg_dwell_ms' },
            ])}
          />
        </div>
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Top referrers</h3>
          <AnalyticsRankRows
            rows={topReferrers}
            valueKey="landing_views"
            getLabel={(r) => {
              const { channel } = formatTrafficReferrerLabel(r)
              return `${channel.label} · ${r.referrer_domain || r.utm_source || 'direct / none'}`
            }}
            getSublabel={(r) => `${r.utm_medium || '—'} · Sessions ${fmt(r.unique_sessions)}`}
            emptyLabel="No referrer data."
            onCsv={() => onDownloadCsv?.(`analytics-top-referrers-${rangeDays}d.csv`, topReferrers, [
              { header: 'referrer_domain', key: 'referrer_domain' },
              { header: 'utm_source', key: 'utm_source' },
              { header: 'utm_medium', key: 'utm_medium' },
              { header: 'landing_views', key: 'landing_views' },
              { header: 'unique_sessions', key: 'unique_sessions' },
            ])}
          />
        </div>
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Top searches</h3>
          <AnalyticsRankRows
            rows={analytics?.topSearches}
            valueKey="searches"
            getLabel={(r) => r.query}
            getSublabel={(r) => r.page_path}
            emptyLabel="No search data."
            onCsv={() => onDownloadCsv?.(`analytics-top-searches-${rangeDays}d.csv`, analytics.topSearches, [
              { header: 'page_path', key: 'page_path' },
              { header: 'query', key: 'query' },
              { header: 'searches', key: 'searches' },
              { header: 'avg_result_count', key: 'avg_result_count' },
            ])}
          />
        </div>
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>UTM campaigns</h3>
          <AnalyticsRankRows
            rows={analytics?.topCampaigns}
            valueKey="page_views"
            getLabel={(r) => r.campaign || '—'}
            getSublabel={(r) => `${r.utm_source || '—'} / ${r.utm_medium || '—'}`}
            emptyLabel="No campaign-tagged views."
            onCsv={() => onDownloadCsv?.(`analytics-top-campaigns-${rangeDays}d.csv`, analytics.topCampaigns, [
              { header: 'campaign', key: 'campaign' },
              { header: 'utm_source', key: 'utm_source' },
              { header: 'utm_medium', key: 'utm_medium' },
              { header: 'page_views', key: 'page_views' },
              { header: 'unique_sessions', key: 'unique_sessions' },
            ])}
          />
        </div>
      </div>
    </div>
  )
}
