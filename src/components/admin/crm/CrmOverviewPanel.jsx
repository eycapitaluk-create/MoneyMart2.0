import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt, labelClass, panelClass, panelPad, pctOrDash, titleClass, thClass, tdClass } from './crmUi'

const deltaText = (d) => {
  if (d == null) return '—'
  const sign = d > 0 ? '+' : ''
  return `${sign}${d}pp`
}

const deltaClass = (d) => {
  if (d == null) return 'text-gray-400'
  if (d > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (d < 0) return 'text-rose-600 dark:text-rose-400'
  return 'text-gray-400'
}

export default function CrmOverviewPanel({
  decisionMetrics,
  acquisitionSummary,
  analysis,
  rangeDays = 30,
  onSelectChannel,
}) {
  const funnel = [
    { label: 'Sessions', value: decisionMetrics?.sessions || 0, note: '100%' },
    { label: 'Signups', value: decisionMetrics?.signups || 0, note: `${pctOrDash(decisionMetrics?.visitToSignupPct)} of sessions` },
    { label: 'Activated', value: decisionMetrics?.activated || 0, note: `${pctOrDash(decisionMetrics?.signupToActivationPct)} of signups` },
    { label: 'Premium intent', value: decisionMetrics?.premiumIntent || 0, note: `${pctOrDash(decisionMetrics?.activationToIntentPct)} of activated` },
  ]
  const pop = analysis?.pop
  const chartData = Array.isArray(acquisitionSummary?.signupsByDayLast14)
    ? acquisitionSummary.signupsByDayLast14
    : []
  const cohorts = analysis?.weeklyCohorts || []
  const quality = analysis?.channelQuality || []

  return (
    <div className="space-y-4">
      <div className={`${panelClass} ${panelPad}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
          <div>
            <h3 className={titleClass}>Binding constraint</h3>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{analysis?.constraint || '—'}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{analysis?.constraintNote}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={labelClass}>Signup concentration</p>
            <p className="text-lg font-semibold tabular-nums">{pctOrDash(analysis?.concentration?.top1Share)} top-1</p>
            <p className="text-[10px] text-gray-400">HHI {analysis?.concentration?.hhi ?? '—'} · top-3 {pctOrDash(analysis?.concentration?.top3Share)}</p>
          </div>
        </div>
        {pop?.truncated ? (
          <p className="text-[11px] text-amber-800 dark:text-amber-200 mb-3">
            Prior {rangeDays}d compare may be incomplete (loaded CRM batch is recent users only).
          </p>
        ) : null}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Signups', pop?.signups?.current, pop?.signups?.deltaPct, 'vs prior window', true],
            ['Activation', pop?.activationPct?.current, pop?.activationPct?.deltaPct, 'pp vs prior', false],
            ['Intent', pop?.intentPct?.current, pop?.intentPct?.deltaPct, 'pp vs prior', false],
            ['Attributed', pop?.attributionPct?.current, pop?.attributionPct?.deltaPct, 'pp vs prior', false],
          ].map(([label, value, delta, note, count]) => (
            <div key={label} className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <p className={labelClass}>{label}</p>
              <p className="text-xl font-semibold tabular-nums mt-1">
                {count ? fmt(value) : pctOrDash(value)}
              </p>
              <p className={`text-[11px] font-medium mt-1 ${deltaClass(delta)}`}>
                {count && delta != null ? `${delta > 0 ? '+' : ''}${delta}%` : deltaText(delta)} {note}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className={`${panelClass} ${panelPad}`}>
        <h3 className={titleClass}>Funnel</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          {funnel.map((step) => (
            <div key={step.label} className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
              <p className={labelClass}>{step.label}</p>
              <p className="text-xl font-semibold tabular-nums mt-1">{fmt(step.value)}</p>
              <p className="text-[10px] text-gray-400 mt-1">{step.note}</p>
            </div>
          ))}
        </div>
        {analysis?.current?.activationWilson ? (
          <p className="text-[11px] text-gray-500 mt-3">
            Activation 95% Wilson interval: {analysis.current.activationWilson.lowPct}–{analysis.current.activationWilson.highPct}%
            {analysis.current.activationWilson.unreliable ? ` · n < ${analysis.minN}, do not rank channels on this alone` : ''}.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Weekly signup cohorts</h3>
          <p className="text-[11px] text-gray-500 mt-0.5 mb-2">Activation rate by signup week (same 7-day definition).</p>
          <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
            <table className="min-w-[420px] w-full">
              <thead className="bg-gray-50 dark:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className={thClass}>Week</th>
                  <th className={`${thClass} text-right`}>n</th>
                  <th className={`${thClass} text-right`}>Activated</th>
                  <th className={`${thClass} text-right`}>Wilson 95%</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((row) => (
                  <tr key={row.week} className="border-b border-gray-100 dark:border-gray-800">
                    <td className={tdClass}>{row.week}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{fmt(row.n)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{pctOrDash(row.activationPct)}</td>
                    <td className={`${tdClass} text-right tabular-nums text-gray-500`}>
                      {row.activationWilson
                        ? `${row.activationWilson.lowPct}–${row.activationWilson.highPct}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cohorts.length === 0 ? <p className="p-3 text-sm text-gray-500">No weekly cohorts.</p> : null}
          </div>
        </div>

        <div className={`${panelClass} ${panelPad}`}>
          <h3 className={titleClass}>Signup trend · 14d</h3>
          <div className="h-48 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(v) => (String(v).length >= 10 ? String(v).slice(5, 10) : v)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Signups']} />
                <Bar dataKey="count" name="Signups" fill="#64748b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={`${panelClass} ${panelPad}`}>
        <h3 className={titleClass}>Channel quality (not volume)</h3>
        <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
          Score = activation 50% + intent 20% + attribution 20% + capped conversion. n &lt; {analysis?.minN || 8} is marked unreliable.
        </p>
        <div className="space-y-1.5">
          {(quality.length ? quality : []).map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelectChannel?.(row.id)}
              className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-xs rounded-md px-2.5 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <span className="font-medium truncate">
                {row.label}
                {row.unreliable ? <span className="ml-1 text-[10px] text-amber-700">n={row.signups}</span> : null}
              </span>
              <span className="tabular-nums text-gray-500">{pctOrDash(row.activationPct)} act</span>
              <span className="tabular-nums text-gray-500">{pctOrDash(row.conversionPct)} conv</span>
              <span className="tabular-nums font-semibold">{row.quality}</span>
            </button>
          ))}
          {quality.length === 0 ? <p className="text-sm text-gray-500">No channel quality yet.</p> : null}
        </div>
      </div>
    </div>
  )
}
