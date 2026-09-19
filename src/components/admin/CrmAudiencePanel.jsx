import { HOUR_BLOCK_LABELS, DOW_LABELS } from '../../lib/crmAudienceAggregate'

const heatColor = (count, max) => {
  if (!count || !max) return 'bg-gray-100 dark:bg-gray-800'
  const t = count / max
  if (t >= 0.85) return 'bg-gray-800 dark:bg-gray-200'
  if (t >= 0.65) return 'bg-gray-600 dark:bg-gray-400'
  if (t >= 0.45) return 'bg-gray-400 dark:bg-gray-500'
  if (t >= 0.25) return 'bg-gray-300 dark:bg-gray-600'
  if (t >= 0.1) return 'bg-gray-200 dark:bg-gray-700'
  return 'bg-gray-100 dark:bg-gray-800'
}

function BreakdownBars({ title, subtitle, rows, emptyLabel = 'No data yet' }) {
  const list = Array.isArray(rows) ? rows : []
  const max = Math.max(1, ...list.map((r) => Number(r.count) || 0))
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 h-full">
      <p className="text-xs font-semibold text-gray-900 dark:text-white">{title}</p>
      {subtitle ? (
        <p className="text-[10px] text-gray-500 mt-0.5 mb-3">{subtitle}</p>
      ) : (
        <div className="mb-3" />
      )}
      {list.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">{emptyLabel}</p>
      ) : (
        <div className="space-y-2.5">
          {list.slice(0, 6).map((row) => (
            <div key={row.key || row.label}>
              <div className="flex justify-between gap-2 text-[11px] mb-1">
                <span className="truncate text-gray-700 dark:text-gray-200 font-medium">{row.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-white">
                  {Number(row.pct || 0).toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gray-500 dark:bg-gray-400"
                  style={{ width: `${Math.max(4, ((Number(row.count) || 0) / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActiveTimesHeatmap({ heatmap, heatmapMax, peakLabel, days }) {
  const grid = Array.from({ length: 6 }, (_, block) => (
    Array.from({ length: 7 }, (_, mon) => {
      const cell = (heatmap || []).find((c) => c.block === block && c.monIndex === mon)
      return cell || { block, monIndex: mon, count: 0 }
    })
  ))

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active times</h3>
          <p className="text-[10px] text-gray-500 mt-1">
            Page views by weekday and four-hour block · JST · last {days} days
          </p>
        </div>
        {peakLabel ? (
          <span className="inline-flex self-start text-[10px] font-medium px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200">
            Peak: {peakLabel}
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[280px]">
          <div className="grid grid-cols-[2.5rem_repeat(7,1fr)] gap-1 items-center mb-1">
            <div />
            {DOW_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-500">{d}</div>
            ))}
          </div>
          {grid.map((row, blockIdx) => (
            <div key={HOUR_BLOCK_LABELS[blockIdx]} className="grid grid-cols-[2.5rem_repeat(7,1fr)] gap-1 items-center mb-1">
              <div className="text-[10px] font-medium text-gray-400 pr-1 text-right">
                {HOUR_BLOCK_LABELS[blockIdx]}
              </div>
              {row.map((cell) => (
                <div
                  key={`${cell.monIndex}-${cell.block}`}
                  title={`${DOW_LABELS[cell.monIndex]} ${HOUR_BLOCK_LABELS[cell.block]} · ${cell.count} views`}
                  className={`aspect-square rounded ${heatColor(cell.count, heatmapMax)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 text-[10px] text-gray-500">
        <span>Lower</span>
        <div className="flex-1 h-1.5 rounded-full bg-gradient-to-r from-gray-100 via-gray-400 to-gray-800 dark:from-gray-800 dark:via-gray-500 dark:to-gray-200 max-w-xs mx-auto" />
        <span>Higher</span>
      </div>
    </div>
  )
}

export default function CrmAudiencePanel({
  audience,
  loading = false,
  error = '',
  rangeDays = 28,
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-500 animate-pulse">
        Aggregating customer and visitor data…
      </div>
    )
  }

  const onboard = audience?.onboarding || {}
  const profilePct = onboard.totalCustomers
    ? Math.round((onboard.withProfile / onboard.totalCustomers) * 1000) / 10
    : 0

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Audience</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Active times, device/locale mix, and self-reported investor profile.
          </p>
        </div>
        <p className="text-[10px] text-gray-400">
          {audience?.source === 'rpc' ? 'Server aggregate' : audience?.source === 'client' ? 'Live query' : '—'}
          {audience?.meta?.pageViews ? ` · ${Number(audience.meta.pageViews).toLocaleString('en-US')} page views` : ''}
        </p>
      </div>

      {error ? (
        <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ActiveTimesHeatmap
            heatmap={audience?.heatmap}
            heatmapMax={audience?.heatmapMax}
            peakLabel={audience?.peakLabel}
            days={rangeDays}
          />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <BreakdownBars
            title="Device mix"
            subtitle="From browser hints on page views"
            rows={audience?.deviceBreakdown}
            emptyLabel="Device data will populate from new visits"
          />
          <BreakdownBars
            title="Locale mix"
            subtitle="Browser language (directional)"
            rows={audience?.localeBreakdown}
            emptyLabel="Locale data will populate from new visits"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Self-reported investor profile</h3>
          <span className="text-[10px] font-medium text-gray-500 ml-auto tabular-nums">
            {onboard.withProfile || 0} / {onboard.totalCustomers || 0} ({profilePct}%)
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BreakdownBars title="Risk tolerance" rows={onboard.riskTolerance} emptyLabel="No responses yet" />
          <BreakdownBars title="Current asset mix" rows={onboard.assetMix} emptyLabel="No responses yet" />
          <BreakdownBars title="Investment horizon" rows={onboard.horizon} emptyLabel="No responses yet" />
        </div>
      </div>

      <p className="text-[10px] text-gray-400">
        Age and gender are never inferred; only self-reported answers are shown. Time blocks use JST.
      </p>
    </section>
  )
}
