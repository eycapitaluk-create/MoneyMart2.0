import { CalendarDays, ChevronRight } from 'lucide-react'
import { C } from './theme'

export const CHART = {
  equity: C.accent, // #b8933a
  bond: '#2a3e60', // AdvisorTheme.info
  cash: '#94a3b8',
  other: '#8b6f2a',
  healthy: '#16a34a',
  watch: '#2563eb',
  caution: '#f59e0b',
  danger: '#dc2626',
  track: '#e2e8f0',
  trackSoft: '#f1f5f9',
  radarTarget: '#3b82f6',
  radarCurrent: '#f97316',
  positive: C.positive, // JP red gains
  negative: C.negative, // navy losses
}

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** Donut slice path — matches iOS DonutSlice (innerRatio 0.62). */
function donutSlicePath(cx, cy, outer, inner, startFrac, endFrac) {
  const start = startFrac * 360
  const end = endFrac * 360
  const large = end - start > 180 ? 1 : 0
  const [x0, y0] = polar(cx, cy, inner, start)
  const [x1, y1] = polar(cx, cy, inner, end)
  const [x2, y2] = polar(cx, cy, outer, end)
  const [x3, y3] = polar(cx, cy, outer, start)
  return [
    `M ${x0} ${y0}`,
    `A ${inner} ${inner} 0 ${large} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${outer} ${outer} 0 ${large} 0 ${x3} ${y3}`,
    'Z',
  ].join(' ')
}

/** Multi-segment donut — iOS DonutChart. */
export function DonutChart({
  segments,
  size = 88,
  centerValue,
  centerLabel,
  showLegend = true,
  hideZero = true,
  legendCompact = false,
}) {
  const parts = (segments || []).filter((s) => (hideZero ? s.value > 0 : true))
  const total = Math.max(
    parts.reduce((a, s) => a + Number(s.value || 0), 0),
    1,
  )
  const cx = size / 2
  const cy = size / 2
  const outer = size / 2
  const inner = outer * 0.62
  let cursor = 0
  const slices = parts.map((s) => {
    const start = cursor / total
    cursor += Number(s.value || 0)
    const end = cursor / total
    return { ...s, start, end }
  })

  return (
    <div className={`flex items-center ${legendCompact ? 'gap-3' : 'gap-3'}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.length === 0 ? (
            <circle cx={cx} cy={cy} r={(outer + inner) / 2} fill="none" stroke={CHART.track} strokeWidth={outer - inner} />
          ) : (
            slices.map((s) => (
              <path
                key={s.label}
                d={donutSlicePath(cx, cy, outer - 0.5, inner, s.start, s.end)}
                fill={s.color}
              />
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[12px] font-extrabold leading-none tabular-nums" style={{ color: C.navy }}>
              {centerValue ?? `${Math.round(total)}%`}
            </div>
            {centerLabel ? (
              <div className="mt-0.5 text-[8px] font-semibold" style={{ color: C.textMuted }}>
                {centerLabel}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {showLegend ? (
        <div className="min-w-0 flex-1 space-y-1">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-[10px]">
              <i className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate" style={{ color: '#1c1917' }}>{s.label}</span>
              <span className="ml-auto font-extrabold tabular-nums" style={{ color: '#1c1917' }}>
                {Math.round(s.value)}%
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Portfolio health donut — path slices + legend with chevrons (AdvisorViews.healthDonut). */
export function HealthDonut({ healthy = 0, watch = 0, caution = 0, danger = 0, size = 110 }) {
  const rows = [
    { label: '良好', count: healthy, color: CHART.healthy },
    { label: '注視', count: watch, color: CHART.watch },
    { label: '注意', count: caution, color: CHART.caution },
    { label: '要対応', count: danger, color: CHART.danger },
  ]
  const total = Math.max(1, healthy + watch + caution + danger)
  const cx = size / 2
  const cy = size / 2
  const outer = size / 2 - 1
  const inner = outer - 14
  let cursor = 0
  const slices = rows
    .filter((r) => r.count > 0)
    .map((r) => {
      const start = cursor / total
      cursor += r.count
      const end = cursor / total
      return { ...r, start, end }
    })

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.length === 0 ? (
            <circle cx={cx} cy={cy} r={(outer + inner) / 2} fill="none" stroke={CHART.trackSoft} strokeWidth={outer - inner} />
          ) : (
            slices.map((s) => (
              <path
                key={s.label}
                d={donutSlicePath(cx, cy, outer, inner, s.start, s.end)}
                fill={s.color}
              />
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[20px] font-extrabold leading-none" style={{ color: '#0f172a' }}>{total}</div>
            <div className="mt-0.5 text-[9px] font-medium" style={{ color: '#78716c' }}>名</div>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {rows.map((row) => {
          const pct = Math.round((row.count / total) * 100)
          return (
            <div
              key={row.label}
              className="flex items-center gap-1.5 rounded-md border px-2 py-1.5"
              style={{ background: `${row.color}0f`, borderColor: `${row.color}24` }}
            >
              <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
              <span className="text-[10px] font-semibold" style={{ color: '#57534e' }}>{row.label}</span>
              <span className="ml-auto text-[11px] font-bold tabular-nums" style={{ color: '#1c1917' }}>{row.count}</span>
              <span className="text-[9px] tabular-nums" style={{ color: '#94a3b8' }}>({pct}%)</span>
              <ChevronRight className="h-3 w-3 shrink-0" style={{ color: row.color, opacity: 0.6 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Priority score ring — progress arc matching iPad summary card. */
export function PriorityRing({ score = 0, size = 96, label }) {
  const pct = Math.min(100, Math.max(0, score)) / 100
  const stroke = 8
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const color = score < 40 ? CHART.healthy : score < 60 ? CHART.watch : score < 80 ? CHART.caution : CHART.danger
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CHART.track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[22px] font-extrabold leading-none" style={{ color }}>{score}</div>
          <div className="text-[9px] font-semibold" style={{ color: C.textMuted }}>{label || '/ 100'}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Risk score semicircle gauge — iOS RiskScoreGauge
 * trim from 0.1→0.9 (80% of circle), rotated 90°.
 */
export function RiskScoreGauge({ score = 0, size = 140 }) {
  const stroke = 8
  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  // Visible arc = 80% of circle (0.1..0.9)
  const arcLen = circ * 0.8
  const trackOffset = circ * 0.1
  const fill = Math.min(100, Math.max(0, score)) / 100
  const color = score < 35 ? '#10b981' : score < 70 ? '#f97316' : '#dc2626'

  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.72 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <g transform={`rotate(90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={CHART.track}
            strokeWidth={stroke}
            strokeDasharray={`${arcLen} ${circ - arcLen}`}
            strokeDashoffset={-trackOffset}
            strokeLinecap="butt"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${arcLen * fill} ${circ - arcLen * fill}`}
            strokeDashoffset={-trackOffset}
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ paddingBottom: size * 0.12 }}>
        <div className="text-center">
          <div className="text-[22px] font-extrabold leading-none" style={{ color }}>{score}</div>
          <div className="mt-0.5 text-[9px]" style={{ color: '#94a3b8' }}>スコア</div>
        </div>
      </div>
    </div>
  )
}

/** Concentration donut — thick ring, Top 3 %. */
export function ConcentrationDonut({ percent = 0, size = 90 }) {
  const stroke = 12
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, percent)) / 100
  const color = percent >= 50 ? '#dc2626' : percent >= 30 ? '#f97316' : '#10b981'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CHART.track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[20px] font-extrabold leading-none" style={{ color: '#0f172a' }}>{percent}%</div>
          <div className="text-[8px]" style={{ color: '#94a3b8' }}>上位 3</div>
        </div>
      </div>
    </div>
  )
}

/** Build jagged demo series (cost → aum) matching iOS snapshot zigzags. */
export function buildDemoValueSeries({ start, end, n = 48 }) {
  const out = []
  const delta = end - start
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1)
    const wave =
      Math.sin(i * 0.55) * delta * 0.09 +
      Math.cos(i * 0.31) * delta * 0.055 -
      Math.sin(i * 1.1) * delta * 0.03
    out.push(start + delta * t + wave)
  }
  if (out.length) {
    out[0] = start
    out[out.length - 1] = end
  }
  return out
}

/** Pure area+line sparkline — iOS portfolioSparkline (no axes, JP red when up). */
export function AreaChart({ values, height = 72, strokeWidth = 1.8, fillOpacity = 0.28 }) {
  if (!values?.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, Math.abs(max) * 0.02 || 1)
  const yLower = Math.max(0, min - span * 0.3)
  const yUpper = max + span * 0.3
  const up = values[values.length - 1] >= values[0]
  const tint = up ? CHART.positive : CHART.negative
  const w = 100
  const h = height
  const gradId = `mmArea-${height}-${values.length}-${Math.round(values[0])}`
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w
    const y = h - ((v - yLower) / (yUpper - yLower || 1)) * (h - 4) - 2
    return [x, y]
  })
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `M 0,${h} L ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} L ${w},${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tint} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={tint} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={tint}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** MTD / YTD / 1Y period stats under summary sparkline — iOS periodStat. */
export function PeriodReturnStats({ mtd, ytd, y1 }) {
  const rows = [
    { label: 'MTD', value: mtd },
    { label: 'YTD', value: ytd },
    { label: '1Y', value: y1 },
  ]
  return (
    <div className="flex items-stretch">
      {rows.map((r, i) => {
        const pos = r.value >= 0
        return (
          <div key={r.label} className="flex flex-1 items-center">
            {i > 0 ? <div className="mx-0 h-8 w-px self-center opacity-40" style={{ background: C.border }} /> : null}
            <div className="flex-1 py-1 text-center">
              <div className="text-[9px] font-extrabold tracking-wide" style={{ color: C.textMuted }}>{r.label}</div>
              <div
                className="mt-1 text-[14px] font-extrabold tabular-nums"
                style={{ color: pos ? CHART.positive : CHART.negative }}
              >
                {pos ? '+' : ''}{Number(r.value).toFixed(1)}%
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const VALUE_PERIODS = [
  { id: 'm1', label: '1ヶ月', n: 22 },
  { id: 'm3', label: '3ヶ月', n: 48 },
  { id: 'm6', label: '6ヶ月', n: 72 },
  { id: 'all', label: '全期間', n: 90 },
]

/** Portfolio value card chart — iOS SimpleLineChart + period pills + start/gain/end footer. */
export function PortfolioValueChart({ start, end, period = 'all', onPeriod, height = 130, dateLabels }) {
  const meta = VALUE_PERIODS.find((p) => p.id === period) || VALUE_PERIODS[3]
  const values = buildDemoValueSeries({ start, end, n: meta.n })
  const first = values[0]
  const last = values[values.length - 1]
  const gainPct = first > 0 ? ((last - first) / first) * 100 : 0
  const labels = dateLabels || (() => {
    const now = new Date(2026, 8, 18)
    const startD = new Date(2025, 7, 20)
    const mid = new Date((startD.getTime() + now.getTime()) / 2)
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`
    return [fmt(startD), fmt(mid), fmt(now)]
  })()

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {VALUE_PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPeriod?.(p.id)}
            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold"
            style={{
              background: period === p.id ? C.accent : '#fff',
              color: period === p.id ? '#fff' : C.textMuted,
              border: `1px solid ${period === p.id ? C.accent : C.border}`,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <AreaChart values={values} height={height} strokeWidth={2} fillOpacity={0.12} />
      <div className="mt-1 flex justify-between px-0.5 text-[8px]" style={{ color: C.textMuted }}>
        {labels.map((l) => <span key={l}>{l}</span>)}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <div>
          <div className="font-bold tabular-nums" style={{ color: C.navy }}>¥{Math.round(first).toLocaleString()}</div>
          <div className="text-[9px]" style={{ color: C.textMuted }}>{labels[0]}</div>
        </div>
        <div className="text-center font-extrabold tabular-nums" style={{ color: gainPct >= 0 ? CHART.positive : CHART.negative }}>
          {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
        </div>
        <div className="text-right">
          <div className="font-bold tabular-nums" style={{ color: C.navy }}>¥{Math.round(last).toLocaleString()}</div>
          <div className="text-[9px]" style={{ color: C.textMuted }}>{labels[labels.length - 1]}</div>
        </div>
      </div>
    </div>
  )
}

const BM_COLORS = {
  portfolio: C.accent,
  nikkei: '#ef4444',
  sp: '#3b82f6',
  world: '#22c55e',
}

function buildPctSeries(endPct, n = 52, volatility = 1) {
  const out = []
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1)
    const wave = Math.sin(i * 0.42 * volatility) * endPct * 0.12 + Math.cos(i * 0.19) * endPct * 0.06
    out.push(Math.max(-5, endPct * t + wave))
  }
  out[0] = 0
  out[out.length - 1] = endPct
  return out
}

/** Multi-line benchmark comparison — iOS PortfolioBenchmarkChart. */
export function BenchmarkCompareChart({
  portfolioPct = 8.7,
  nikkeiPct = 43.3,
  spPct = 15.2,
  worldPct = 23.6,
  height = 160,
}) {
  const series = [
    { key: 'portfolio', label: 'あなたのポートフォリオ', subtitle: '保有合算', pct: portfolioPct, color: BM_COLORS.portfolio, thick: true },
    { key: 'nikkei', label: '日経225', subtitle: 'iFreeETF 日経225', pct: nikkeiPct, color: BM_COLORS.nikkei },
    { key: 'sp', label: 'S&P500', subtitle: 'MAXIS 米国株式', pct: spPct, color: BM_COLORS.sp },
    { key: 'world', label: '全世界株', subtitle: 'MAXIS 全世界株式', pct: worldPct, color: BM_COLORS.world },
  ]
  const n = 52
  const paths = series.map((s) => ({ ...s, values: buildPctSeries(s.pct, n, s.key === 'nikkei' ? 1.4 : 1) }))
  const all = paths.flatMap((p) => p.values)
  const minV = Math.min(0, ...all)
  const maxV = Math.max(...all)
  const range = Math.max(maxV - minV, 5)
  const margin = range * 0.15
  const yLower = minV - margin
  const yUpper = maxV + margin
  const w = 320
  const h = height
  const padL = 34
  const padR = 18
  const padT = 10
  const padB = 22
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const yTicks = [0, 20, 40, 60].filter((t) => t >= yLower - 5 && t <= yUpper + 5)
  const xLabels = ['8月', '12月', '4月', '8月']
  const toXY = (i, v) => {
    const x = padL + (i / (n - 1)) * plotW
    const y = padT + (1 - (v - yLower) / (yUpper - yLower || 1)) * plotH
    return [x, y]
  }
  const beaten = series.slice(1).filter((b) => portfolioPct > b.pct).length

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.textMuted }}>
        <CalendarDays className="h-3.5 w-3.5" /> 過去1年間
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
        {yTicks.map((t) => {
          const y = padT + (1 - (t - yLower) / (yUpper - yLower || 1)) * plotH
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#94a3b8" strokeOpacity="0.25" strokeWidth="0.5" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{`${t >= 0 ? '+' : ''}${t}%`}</text>
            </g>
          )
        })}
        {xLabels.map((lab, i) => {
          const x = padL + (i / (xLabels.length - 1)) * plotW
          return (
            <text key={lab} x={x} y={h - 4} textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'} fontSize="8" fill="#94a3b8">
              {lab}
            </text>
          )
        })}
        {paths.map((p) => {
          const d = p.values.map((v, i) => {
            const [x, y] = toXY(i, v)
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
          }).join(' ')
          return (
            <path
              key={p.key}
              d={d}
              fill="none"
              stroke={p.color}
              strokeWidth={p.thick ? 2.5 : 1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        })}
        <g>
          <rect x={w - padR - 28} y={padT} width={26} height={12} rx="6" fill={`${C.accent}1f`} />
          <circle cx={w - padR - 20} cy={padT + 6} r={2} fill={C.accent} />
          <text x={w - padR - 14} y={padT + 9} fontSize="7" fontWeight="800" fill={C.accent}>今</text>
        </g>
      </svg>

      <div className="mt-2 space-y-1.5">
        {series.map((s) => (
          <div
            key={s.key}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
            style={{ background: s.key === 'portfolio' ? `${C.accent}0f` : `${C.surfaceSub}80` }}
          >
            <div
              className="grid h-7 w-7 place-items-center rounded-md text-[10px] font-bold"
              style={{ background: `${s.color}1f`, color: s.color }}
            >
              {s.key === 'portfolio' ? 'P' : s.key === 'nikkei' ? '日' : s.key === 'sp' ? 'S' : 'W'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold" style={{ color: C.navy }}>{s.label}</div>
              {s.subtitle ? <div className="text-[9px]" style={{ color: C.textMuted }}>{s.subtitle}</div> : null}
            </div>
            <div className="text-[13px] font-bold tabular-nums" style={{ color: s.pct >= 0 ? CHART.positive : CHART.negative }}>
              {s.pct >= 0 ? '+' : ''}{s.pct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
      <div
        className="mt-2 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold"
        style={{ background: C.surfaceSub, color: C.textSecondary }}
      >
        全{series.length - 1}ベンチマーク中{beaten}つを上回る
      </div>
    </div>
  )
}

/** Horizontal stacked allocation bar — iOS AllocationChart. */
export function AllocationBar({ equity = 0, bond = 0, cash = 0, other = 0 }) {
  const parts = [
    { label: '株式', value: equity, color: CHART.equity },
    { label: '債券', value: bond, color: CHART.bond },
    { label: '現金', value: cash, color: CHART.cash },
    { label: 'その他', value: other, color: CHART.other },
  ].filter((p) => p.value > 0)
  return (
    <div>
      <div className="flex h-5 overflow-hidden rounded-md">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${p.value}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-3.5">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-1 text-[10px]">
            <i className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span style={{ color: C.textMuted }}>{p.label}</span>
            <b className="tabular-nums" style={{ color: C.navy }}>{Math.round(p.value)}%</b>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Target vs current allocation bars — iOS allocBar with target marker. */
export function TargetAllocBars({ rows }) {
  // rows: [{ label, current, target, color }]
  return (
    <div className="space-y-2.5">
      {(rows || []).map((row) => {
        const diff = row.current - row.target
        const color = row.color || CHART.equity
        return (
          <div key={row.label}>
            <div className="mb-1 flex items-center gap-1.5 text-[10px]">
              <i className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />
              <span className="font-semibold" style={{ color: '#0f172a' }}>{row.label}</span>
              <span className="ml-auto tabular-nums" style={{ color: '#94a3b8' }}>
                {row.current}% / {row.target}%
              </span>
              <span
                className="w-8 text-right text-[10px] font-extrabold tabular-nums"
                style={{ color: Math.abs(diff) > 10 ? '#dc2626' : '#94a3b8' }}
              >
                {diff === 0 ? '±0' : diff > 0 ? `+${diff}` : `${diff}`}
              </span>
            </div>
            <div className="relative h-2.5">
              <div className="absolute inset-x-0 top-1 h-1.5 rounded-full" style={{ background: `${color}26` }} />
              <div
                className="absolute top-1 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, row.current)}%`, background: color }}
              />
              <div
                className="absolute top-0 h-2.5 w-0.5"
                style={{ left: `calc(${Math.min(100, row.target)}% - 1px)`, background: '#0f172a' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 5-axis radar — iOS RadarChart. */
export function RadarChart({ dims, size = 200 }) {
  const items = dims || []
  const n = items.length || 5
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 28
  const angleFor = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n
  const point = (i, value) => {
    const a = angleFor(i)
    const s = Math.min(100, Math.max(0, value)) / 100
    return [cx + Math.cos(a) * radius * s, cy + Math.sin(a) * radius * s]
  }
  const ringPath = (level) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const a = angleFor(i)
      const s = level / 4
      return [cx + Math.cos(a) * radius * s, cy + Math.sin(a) * radius * s]
    })
    return `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`
  }
  const poly = (key, color) => {
    const pts = items.map((d, i) => point(i, d[key]))
    const d = `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`
    return (
      <g key={key}>
        <path d={d} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      </g>
    )
  }

  return (
    <div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
        {[1, 2, 3, 4].map((lv) => (
          <path key={lv} d={ringPath(lv)} fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
        ))}
        {items.map((_, i) => {
          const a = angleFor(i)
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(a) * radius}
              y2={cy + Math.sin(a) * radius}
              stroke="#e2e8f0"
              strokeWidth="0.5"
            />
          )
        })}
        {poly('target', CHART.radarTarget)}
        {poly('current', CHART.radarCurrent)}
        {items.map((d, i) => {
          const a = angleFor(i)
          const x = cx + Math.cos(a) * (radius + 16)
          const y = cy + Math.sin(a) * (radius + 16)
          return (
            <text
              key={d.label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fontWeight="600"
              fill="#0f172a"
            >
              {d.label}
            </text>
          )
        })}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-4 text-[10px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3" style={{ background: CHART.radarTarget }} />
          目標
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHART.radarCurrent }} />
          現状
        </span>
      </div>
    </div>
  )
}

/** 5-band risk arc gauge — iOS RiskArcGauge. */
export function RiskArcGauge({ score }) {
  const labels = ['保守', '安定', 'バランス', '成長', '積極']
  const colors = ['#2a3e60', '#16a34a', '#8b6f2a', '#f97316', '#c72c2c']
  const active = score == null ? null : Math.min(4, Math.max(0, Math.floor(score / 20)))
  const pointerPct = score == null ? null : Math.min(100, Math.max(0, score))

  return (
    <div>
      <div className="relative pt-4">
        {pointerPct != null ? (
          <div
            className="absolute top-1.5 h-0 w-0 -translate-x-1/2"
            style={{
              left: `${pointerPct}%`,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '8px solid #0f172a',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
            }}
          />
        ) : null}
        <div className="flex gap-[3px]">
          {colors.map((c, i) => (
            <div
              key={labels[i]}
              className="h-3 flex-1 rounded-sm"
              style={{ background: active === i ? c : `${c}33` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2.5 flex gap-[3px]">
        {labels.map((l, i) => (
          <div
            key={l}
            className="flex-1 text-center text-[9px]"
            style={{
              color: active === i ? colors[i] : C.textMuted,
              fontWeight: active === i ? 800 : 600,
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Fear & Greed semicircle — AdvisorFearGreedRichView. */
export function FearGreedGauge({ score = 62, size = 70 }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const arcLen = circ * 0.8
  const trackOffset = circ * 0.1
  const fill = Math.min(100, Math.max(0, score)) / 100
  const color =
    score <= 20 ? '#dc2626' : score <= 40 ? '#f97316' : score <= 60 ? '#eab308' : score <= 80 ? '#22c55e' : '#16a34a'
  const label =
    score <= 20 ? '極度の恐怖' : score <= 40 ? '恐怖' : score <= 60 ? '中立' : score <= 80 ? '貪欲' : '極度の貪欲'

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={CHART.track}
              strokeWidth={stroke}
              strokeDasharray={`${arcLen} ${circ - arcLen}`}
              strokeDashoffset={-trackOffset}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arcLen * fill} ${circ - arcLen * fill}`}
              strokeDashoffset={-trackOffset}
            />
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="text-[20px] font-extrabold" style={{ color }}>{score}</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-bold" style={{ color: '#0f172a' }}>恐怖と貪欲指数</div>
        <div className="text-[16px] font-extrabold" style={{ color }}>{label}</div>
        <div className="mt-0.5 text-[10px]" style={{ color: '#64748b' }}>
          市場心理: VIX·プット/コール·モメンタム等から算出
        </div>
      </div>
    </div>
  )
}

function heatmapColor(ret) {
  if (ret >= 1.5) return '#166534'
  if (ret >= 0.5) return '#22c55e'
  if (ret >= 0.1) return '#86efac'
  if (ret > -0.1) return '#94a3b8'
  if (ret > -0.5) return '#fca5a5'
  if (ret > -1.5) return '#ef4444'
  return '#991b1b'
}

/** Sector treemap-style heatmap — AdvisorHeatmapTreemap. */
export function SectorHeatmap({ sectors }) {
  const items = [...(sectors || [])].sort((a, b) => b.marketCap - a.marketCap)
  return (
    <div className="grid grid-cols-4 gap-1 sm:grid-cols-6" style={{ gridAutoRows: 'minmax(56px, auto)' }}>
      {items.map((s, i) => {
        const span = s.marketCap >= 20 ? 'col-span-2 row-span-2' : s.marketCap >= 10 ? 'col-span-2' : ''
        const bg = heatmapColor(s.ret1d)
        const light = Math.abs(s.ret1d) < 0.1 || (s.ret1d > 0 && s.ret1d < 0.5)
        return (
          <div
            key={s.name}
            className={`flex flex-col justify-between rounded-md p-2 ${span} ${i === 0 ? 'sm:col-span-2 sm:row-span-2' : ''}`}
            style={{ background: bg, minHeight: s.marketCap >= 20 ? 112 : 56 }}
          >
            <div className={`text-[10px] font-bold leading-tight ${light ? 'text-slate-800' : 'text-white'}`}>
              {s.name}
            </div>
            <div className={`text-[12px] font-extrabold tabular-nums ${light ? 'text-slate-900' : 'text-white'}`}>
              {s.ret1d > 0 ? '+' : ''}
              {s.ret1d.toFixed(1)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Tiny sparkline kept for compact rows. */
export function Sparkline({ values, color = CHART.positive, height = 40 }) {
  if (!values?.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * 100
      const y = height - 4 - ((v - min) / (max - min || 1)) * (height - 8)
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function healthBucketsFromClients(clients) {
  let healthy = 0
  let watch = 0
  let caution = 0
  let danger = 0
  for (const c of clients || []) {
    const s = c.priority?.total ?? 0
    if (s < 40) healthy += 1
    else if (s < 60) watch += 1
    else if (s < 80) caution += 1
    else danger += 1
  }
  return { healthy, watch, caution, danger }
}
