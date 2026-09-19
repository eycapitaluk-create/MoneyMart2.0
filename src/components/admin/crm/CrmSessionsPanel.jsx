import { useMemo, useState } from 'react'
import { formatTrafficReferrerLabel } from '../../../lib/referrerBuckets'
import { fmt, labelClass, panelClass, panelPad, tdClass, thClass, titleClass } from './crmUi'

const visitorBadge = (type) => (
  type === 'registered'
    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
)

export default function CrmSessionsPanel({
  sessions = [],
  channelFilter = null,
  channelLabel = null,
  onClearChannel,
  rangeDays = 30,
  userCreatedAtById,
}) {
  const [sessionFilter, setSessionFilter] = useState('all')

  const filtered = useMemo(() => {
    let list = Array.isArray(sessions) ? sessions : []
    if (channelFilter) {
      list = list.filter((s) => formatTrafficReferrerLabel(s).channel.id === channelFilter)
    }
    if (sessionFilter === 'anonymous') list = list.filter((s) => !s.is_logged_in)
    if (sessionFilter === 'registered') list = list.filter((s) => s.is_logged_in)
    if (sessionFilter === 'attributed') {
      list = list.filter((s) => {
        const ref = String(s.referrer_domain || '')
        const utm = [s.utm_source, s.utm_medium, s.utm_campaign].some(Boolean)
        return (ref && ref !== '(direct / unknown)') || utm
      })
    }
    if (sessionFilter === 'direct') {
      list = list.filter((s) =>
        String(s.referrer_domain || '') === '(direct / unknown)'
        && ![s.utm_source, s.utm_medium, s.utm_campaign].some(Boolean),
      )
    }
    return list
  }, [sessions, channelFilter, sessionFilter])

  const isSignupVisit = (s) => {
    if (!s?.signed_up_in_window || !s.first_at || !userCreatedAtById) return false
    const created = userCreatedAtById.get(s.user_id)
    if (!created) return false
    const delta = Math.abs(new Date(s.first_at).getTime() - new Date(created).getTime())
    return delta <= 48 * 3600000
  }

  const chips = [
    { id: 'all', label: 'All' },
    { id: 'anonymous', label: 'Anonymous' },
    { id: 'registered', label: 'Logged in' },
    { id: 'attributed', label: 'Attributed' },
    { id: 'direct', label: 'Direct' },
  ]

  return (
    <div className={`${panelClass} ${panelPad}`}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">
        <div>
          <h3 className={titleClass}>Sessions</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {fmt(filtered.length)} sessions · {rangeDays}d
            {channelLabel ? ` · channel: ${channelLabel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {channelFilter ? (
            <button
              type="button"
              onClick={onClearChannel}
              className="px-2 py-1 rounded-md text-[10px] font-medium border border-gray-300 dark:border-gray-600"
            >
              Clear channel
            </button>
          ) : null}
          {chips.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSessionFilter(id)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium border ${
                sessionFilter === id
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800 max-h-[min(60vh,520px)] overflow-y-auto">
        <table className="min-w-[980px] w-full">
          <thead className="bg-gray-50 dark:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800 sticky top-0">
            <tr>
              <th className={thClass}>Last seen</th>
              <th className={thClass}>Visitor</th>
              <th className={thClass}>Referrer</th>
              <th className={thClass}>UTM</th>
              <th className={thClass}>Landing</th>
              <th className={thClass}>PV</th>
              <th className={thClass}>User</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.session_id} className="border-b border-gray-100 dark:border-gray-800">
                <td className={`${tdClass} whitespace-nowrap`}>
                  {s.last_at ? new Date(s.last_at).toLocaleString('en-US') : '—'}
                </td>
                <td className={tdClass}>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${visitorBadge(s.visitor_type)}`}>
                    {s.visitor_type === 'registered' ? 'Logged in' : 'Anonymous'}
                  </span>
                  {isSignupVisit(s) ? (
                    <span className="ml-1 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
                      Signup visit
                    </span>
                  ) : null}
                </td>
                <td className={`${tdClass} max-w-[140px] truncate`} title={s.referrer_domain || ''}>
                  {s.referrer_domain || '—'}
                </td>
                <td className={`${tdClass} max-w-[160px] truncate`}>
                  {[s.utm_source, s.utm_medium].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className={`${tdClass} font-mono text-[10px] max-w-[160px] truncate`}>{s.landing_path || '—'}</td>
                <td className={`${tdClass} tabular-nums`}>{Number(s.page_views || 0)}</td>
                <td className={`${tdClass} font-mono text-[10px] max-w-[180px] truncate`}>
                  {s.email || s.session_short || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No sessions match this filter.</p>
        ) : null}
      </div>
      <p className={`mt-2 ${labelClass}`}>
        Staff and moneymart.co.jp self-referrals are excluded upstream.
      </p>
    </div>
  )
}
