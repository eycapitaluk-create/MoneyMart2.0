import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  CAMPAIGN_COHORT_STAGES,
  CAMPAIGN_LAUNCH_ID,
  CAMPAIGN_LAUNCH_PATH,
  buildCampaignLaunchCohort,
} from '../../../lib/campaignLaunchCohort'

function Card({ children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  )
}

export default function CampaignLaunchCohortCard({ rangeDays = 30 }) {
  const [state, setState] = useState({ status: 'loading', cohort: null, note: '' })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase.rpc('admin_campaign_launch_events', {
        p_days: Math.max(1, Math.min(Number(rangeDays || 30), 90)),
      })
      if (cancelled) return
      if (error) {
        setState({ status: 'error', cohort: null, note: 'Campaign cohort query failed. Existing dashboard totals are unchanged.' })
        return
      }
      const filtered = (Array.isArray(data) ? data : []).filter((row) => {
        if (String(row.page_path || '') === CAMPAIGN_LAUNCH_PATH) return true
        if (!String(row.event_name || '').startsWith('campaign_')) return false
        return !row.campaign_id || row.campaign_id === CAMPAIGN_LAUNCH_ID
      })
      setState({
        status: 'ready',
        cohort: buildCampaignLaunchCohort(filtered),
        note: filtered.length >= 8000 ? 'Showing the latest 8,000 matching events in this range.' : '',
      })
    }
    load().catch(() => {
      if (!cancelled) {
        setState({ status: 'error', cohort: null, note: 'Campaign cohort query failed. Existing dashboard totals are unchanged.' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [rangeDays])

  const cohort = state.cohort
  const observed = Number(cohort?.viewSessions || 0) > 0

  return (
    <Card className="xl:col-span-12">
      <h2 className="text-[13px] font-semibold text-slate-800">SNS campaign cohort</h2>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
        {CAMPAIGN_LAUNCH_ID} · sessions that opened {CAMPAIGN_LAUNCH_PATH} in the selected range, then reached a later step in that same session.
        Each percent uses that channel&apos;s view sessions as the denominator. Staff accounts and local dev referrers use the existing exclusion.
        Survey answers and posted URLs are not included.
      </p>
      {state.status === 'loading' ? <p className="py-6 text-xs text-slate-400">Loading campaign sessions…</p> : null}
      {state.status === 'error' ? <p className="py-6 text-xs text-slate-400">{state.note}</p> : null}
      {state.status === 'ready' && !observed ? (
        <p className="py-6 text-xs text-slate-400">
          Implemented. No campaign sessions observed in this range yet, so there is no conversion rate to show.
        </p>
      ) : null}
      {state.status === 'ready' && observed ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead className="text-[11px] text-slate-400">
              <tr>
                <th className="pb-2 font-medium">Channel</th>
                {CAMPAIGN_COHORT_STAGES.map((stage) => (
                  <th key={stage.id} className="pb-2 font-medium">{stage.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohort.channels.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="py-2 text-slate-700">{row.key}</td>
                  {CAMPAIGN_COHORT_STAGES.map((stage) => {
                    const count = Number(row[stage.id] || 0)
                    const pct = stage.id === 'view' || row.view <= 0 ? null : (count / row.view) * 100
                    return (
                      <td key={stage.id} className="py-2 tabular-nums text-slate-600">
                        {count.toLocaleString('en-US')}
                        {pct == null ? '' : ` · ${pct.toFixed(0)}%`}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {state.note ? <p className="mt-2 text-[10px] text-slate-400">{state.note}</p> : null}
        </div>
      ) : null}
    </Card>
  )
}
