import { useMemo, useState } from 'react'
import {
  CRM_SEGMENT_LABELS,
  crmUserSegment,
  hasPremiumIntent,
  isActivatedSignup,
} from '../../../lib/crmInternalUsers'
import { classifyReferrerChannel } from '../../../lib/referrerBuckets'
import { fmt, labelClass, panelClass, panelPad, tdClass, thClass, titleClass } from './crmUi'

const signupChannelId = (row) => classifyReferrerChannel({
  referrerDomain: row?.signup_referrer_domain,
  utmSource: row?.signup_utm_source,
  utmMedium: row?.signup_utm_medium,
  utmCampaign: row?.signup_utm_campaign,
}).id

export default function CrmCustomersPanel({
  signups = [],
  channelFilter = null,
  channelLabel = null,
  onClearChannel,
}) {
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (signups || [])
      .filter((r) => {
        if (channelFilter && signupChannelId(r) !== channelFilter) return false
        if (segment !== 'all' && crmUserSegment(r) !== segment) return false
        if (!q) return true
        const hay = [
          r.email,
          r.nickname,
          r.full_name,
          r.signup_referrer_domain,
          r.signup_utm_source,
          r.signup_utm_medium,
          r.signup_utm_campaign,
          r.signup_landing_path,
          crmUserSegment(r),
        ].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => new Date(b.user_created_at || 0) - new Date(a.user_created_at || 0))
  }, [signups, channelFilter, segment, query])

  return (
    <div className={`${panelClass} ${panelPad}`}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">
        <div>
          <h3 className={titleClass}>Customers</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {fmt(filtered.length)} of {fmt(signups.length)} signups
            {channelLabel ? ` · channel: ${channelLabel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {channelFilter ? (
            <button
              type="button"
              onClick={onClearChannel}
              className="px-2 py-1 rounded-md text-[10px] font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
            >
              Clear channel
            </button>
          ) : null}
          <div>
            <label className={`block ${labelClass} mb-1`} htmlFor="crm-cust-seg">Segment</label>
            <select
              id="crm-cust-seg"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-xs"
            >
              <option value="all">All</option>
              {Object.entries(CRM_SEGMENT_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className={`block ${labelClass} mb-1`} htmlFor="crm-cust-q">Search</label>
            <input
              id="crm-cust-q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Email, UTM, landing…"
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800 max-h-[min(60vh,520px)] overflow-y-auto">
        <table className="min-w-[960px] w-full">
          <thead className="bg-gray-50 dark:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800 sticky top-0">
            <tr>
              <th className={thClass}>Signed up</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>Referrer</th>
              <th className={thClass}>UTM</th>
              <th className={thClass}>Landing</th>
              <th className={thClass}>Segment</th>
              <th className={thClass}>Activation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.user_id} className="border-b border-gray-100 dark:border-gray-800">
                <td className={`${tdClass} whitespace-nowrap`}>
                  {r.user_created_at ? new Date(r.user_created_at).toLocaleString('en-GB') : '—'}
                </td>
                <td className={`${tdClass} font-mono text-[11px] max-w-[200px] truncate`} title={r.email || ''}>
                  {r.email || '—'}
                </td>
                <td className={`${tdClass} max-w-[140px] truncate`}>{r.signup_referrer_domain || '—'}</td>
                <td className={`${tdClass} max-w-[160px] truncate`}>
                  {[r.signup_utm_source, r.signup_utm_medium].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className={`${tdClass} font-mono text-[10px] max-w-[140px] truncate`}>{r.signup_landing_path || '—'}</td>
                <td className={tdClass}>
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {CRM_SEGMENT_LABELS[crmUserSegment(r)] || crmUserSegment(r)}
                  </span>
                </td>
                <td className={`${tdClass} text-[10px]`}>
                  {isActivatedSignup(r) ? 'Activated' : 'Dormant'}
                  {hasPremiumIntent(r) ? ' · Premium' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No customers match this filter.</p>
        ) : null}
      </div>
    </div>
  )
}
