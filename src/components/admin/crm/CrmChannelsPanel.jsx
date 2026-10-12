import { useMemo } from 'react'
import { fmt, labelClass, panelClass, panelPad, pctOrDash, thClass, tdClass, titleClass } from './crmUi'

export default function CrmChannelsPanel({
  trafficChannels = [],
  signupChannels = [],
  channelQuality = [],
  channelFilter = null,
  onSelectChannel,
  minN = 8,
}) {
  const rows = useMemo(() => {
    const qualityMap = new Map((channelQuality || []).map((r) => [r.id, r]))
    const byId = new Map()
    for (const row of trafficChannels || []) {
      const id = row.id || row.label
      byId.set(id, {
        id,
        label: row.label || id,
        traffic: Number(row.count || 0),
        signups: 0,
      })
    }
    for (const row of signupChannels || []) {
      const id = row.id || row.label
      const prev = byId.get(id) || { id, label: row.label || id, traffic: 0, signups: 0 }
      prev.signups = Number(row.count || 0)
      if (!prev.label) prev.label = row.label || id
      byId.set(id, prev)
    }
    const signupTotal = [...byId.values()].reduce((s, r) => s + r.signups, 0) || 1
    return [...byId.values()]
      .map((row) => {
        const q = qualityMap.get(row.id) || {}
        return {
          ...row,
          conversionPct: row.traffic > 0 ? Math.round((row.signups / row.traffic) * 1000) / 10 : q.conversionPct ?? null,
          activationPct: q.activationPct ?? null,
          wilson: q.activationWilson,
          quality: q.quality ?? null,
          unreliable: q.unreliable ?? row.signups < minN,
          signupShare: Math.round((row.signups / signupTotal) * 1000) / 10,
        }
      })
      .sort((a, b) => (Number(b.quality || 0) - Number(a.quality || 0)) || (b.signups - a.signups))
  }, [trafficChannels, signupChannels, channelQuality, minN])

  return (
    <div className={`${panelClass} ${panelPad}`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
        <div>
          <h3 className={titleClass}>Channel quality</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Ranked by quality score, not volume. Conversion is directional (sessions ≠ first-touch). n &lt; {minN} is unreliable.
          </p>
        </div>
        <p className={labelClass}>{rows.length} channels</p>
      </div>
      <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
        <table className="min-w-[860px] w-full">
          <thead className="bg-gray-50 dark:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className={thClass}>Channel</th>
              <th className={`${thClass} text-right`}>Sessions</th>
              <th className={`${thClass} text-right`}>Signups</th>
              <th className={`${thClass} text-right`}>Conv</th>
              <th className={`${thClass} text-right`}>Activated</th>
              <th className={`${thClass} text-right`}>Wilson 95%</th>
              <th className={`${thClass} text-right`}>Quality</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = channelFilter === row.id
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectChannel?.(active ? null : row.id)}
                  className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer ${
                    active ? 'bg-gray-100 dark:bg-gray-800/80' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                  }`}
                >
                  <td className={`${tdClass} font-medium`}>
                    {row.label}
                    {row.unreliable ? <span className="ml-1 text-[10px] text-amber-700">small n</span> : null}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{fmt(row.traffic)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{fmt(row.signups)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{pctOrDash(row.conversionPct)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{pctOrDash(row.activationPct)}</td>
                  <td className={`${tdClass} text-right tabular-nums text-gray-500`}>
                    {row.wilson ? `${row.wilson.lowPct}–${row.wilson.highPct}` : '—'}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums font-semibold`}>{row.quality ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-4 text-sm text-gray-500">No channel data in this range.</p> : null}
      </div>
    </div>
  )
}
