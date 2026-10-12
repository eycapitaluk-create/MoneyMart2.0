import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { panelClass, panelPad, titleClass, labelClass, fmt } from '../crm/crmUi'
import AnalyticsRankRows from './AnalyticsRankRows'

export default function AnalyticsUsersPanel({ analytics, rangeDays, onDownloadCsv }) {
  const act = analytics?.activity || {}
  const dau = Array.isArray(act.dauDaily) ? act.dauDaily : []
  const avgDau = dau.length
    ? (dau.reduce((s, r) => s + Number(r.activeSessions || 0), 0) / dau.length).toFixed(1)
    : '—'

  const kpis = [
    { label: 'WAU (7d sessions)', value: fmt(act.rolling?.wauSessions) },
    { label: 'MAU (range sessions)', value: fmt(act.rolling?.mauSessionsWindow) },
    { label: 'Avg DAU (sessions)', value: avgDau },
    { label: 'Premium sessions', value: fmt(act.attributionSignups?.premiumSessionsPageview) },
  ]

  return (
    <div className="space-y-4">
      <div className={`${panelClass} ${panelPad}`}>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h3 className={titleClass}>Activity</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">DAU = unique sessions with page_view per calendar day</p>
          </div>
          <button
            type="button"
            className="text-[11px] font-medium text-gray-500 hover:text-gray-800"
            onClick={() => onDownloadCsv?.(`analytics-dau-daily-${rangeDays}d.csv`, dau, [
              { header: 'day', key: 'day' },
              { header: 'active_sessions', key: 'activeSessions' },
              { header: 'active_users', key: 'activeUsers' },
            ])}
          >
            CSV
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <p className={labelClass}>{k.label}</p>
              <p className="text-xl font-semibold tabular-nums mt-1">{k.value}</p>
            </div>
          ))}
        </div>
        {dau.length > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dau} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="dayShort" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="activeSessions" name="DAU sessions" stroke="#111827" strokeWidth={1.6} dot={false} />
                <Line type="monotone" dataKey="activeUsers" name="DAU logged-in" stroke="#64748b" strokeWidth={1.4} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No DAU series. Extended analytics RPC may be missing.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Logged-in vs anonymous</h3>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              ['Logged-in sessions', act.cohortSessions?.loggedInSessions],
              ['New (first PV in window)', act.cohortSessions?.newUserSessions],
              ['Returning', act.cohortSessions?.returningUserSessions],
              ['Anonymous', act.cohortSessions?.anonymousSessions],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-gray-200 dark:border-gray-800 p-2.5">
                <p className={labelClass}>{label}</p>
                <p className="text-lg font-semibold tabular-nums mt-1">{fmt(value)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Watchlist adds</h3>
          <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
            Fund +{fmt(act.watchlist?.fundAdds)} / −{fmt(act.watchlist?.fundRemoves)}
            {' · '}
            Stock +{fmt(act.watchlist?.stockAdds)} / −{fmt(act.watchlist?.stockRemoves)}
          </p>
          <AnalyticsRankRows
            rows={act.watchlist?.topAddSymbols || []}
            valueKey="adds"
            getLabel={(r) => r.symbol}
            emptyLabel="No add events."
          />
        </div>
      </div>

      <div className={`${panelClass} ${panelPad}`}>
        <h3 className={titleClass}>Signup landing (first-touch path)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          {[
            ['Signups in range', act.attributionSignups?.signupsInWindow],
            ['Landing: funds / tools / stocks', act.attributionSignups?.signupsLandingFundsOrTools],
            ['Landing: compare', act.attributionSignups?.signupsLandingCompare],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <p className={labelClass}>{label}</p>
              <p className="text-lg font-semibold tabular-nums mt-1">{fmt(value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
