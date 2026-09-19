import { useMemo } from 'react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarDays, Coins, Crown, Percent, Users } from 'lucide-react'
import { isActivatedSignup } from '../../../lib/crmInternalUsers'

const BLUE = '#3b82f6'
const ORANGE = '#f59e0b'
const GREEN = '#22c55e'
const PIE = ['#2563eb', '#38bdf8', '#f59e0b', '#94a3b8', '#cbd5e1']
const CH_DOT = ['#0f172a', '#38bdf8', '#94a3b8', '#22c55e', '#cbd5e1']
const FUNNEL_BG = ['#0b1f3a', '#16324f', '#1d4ed8', '#fb923c', '#f59e0b']

const fmtInt = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return Math.round(Number(n)).toLocaleString('en-US')
}

const fmtPct = (n, digits = 0) => {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `${Number(n).toFixed(digits)}%`
}

function popDelta(current, prior) {
  const c = Number(current)
  const p = Number(prior)
  if (!Number.isFinite(c) || !Number.isFinite(p) || p <= 0) return null
  const pct = ((c - p) / p) * 100
  return { up: pct >= 0, text: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%` }
}

function relativeTime(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function statusOf(row) {
  if (row?.is_premium) return { label: 'Premium', cls: 'bg-emerald-50 text-emerald-700' }
  if (isActivatedSignup(row)) return { label: 'Activated', cls: 'bg-sky-50 text-sky-700' }
  if (Number(row?.sessions_30d) > 0 || Number(row?.page_views_30d) > 0) {
    return { label: 'Visited', cls: 'bg-slate-100 text-slate-600' }
  }
  return { label: 'Dormant', cls: 'bg-slate-50 text-slate-400' }
}

/** daily_trend.day is 'MM-DD'; rebuild the full ISO date from the selected window. */
function buildIsoByMmdd(rangeDays) {
  const map = new Map()
  const days = Math.max(1, Number(rangeDays || 30)) + 1
  const cursor = new Date()
  for (let i = 0; i < days; i += 1) {
    const iso = cursor.toISOString().slice(0, 10)
    map.set(iso.slice(5), iso)
    cursor.setDate(cursor.getDate() - 1)
  }
  return map
}

function featureLabel(id, raw) {
  const map = {
    fund_compare: 'Fund compare',
    funds_list: 'Fund list',
    fund_detail: 'Fund detail',
    stocks: 'Stocks',
    market: 'Market',
    insights: 'Insights',
    tools: 'Tools hub',
    mypage: 'My page',
    home: 'Home',
    news: 'News',
    community: 'Community',
    premium: 'Premium',
    dividend: 'Dividend calendar',
    auth: 'Login / signup',
    legal: 'Legal / FAQ',
    other: 'Other pages',
  }
  if (map[id]) return map[id]
  return String(raw || id || '—').slice(0, 24)
}

function Card({ children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white p-5 ${className}`}>
      {children}
    </section>
  )
}

const COVERAGE_GOAL_PCT = 80

function CoverageBar({ label, stat }) {
  const pct = stat.taggedPct
  const hitGoal = pct != null && pct >= COVERAGE_GOAL_PCT
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-slate-600">{label}</span>
        <span className="tabular-nums text-[12px] font-medium text-slate-900">
          {pct == null ? '—' : fmtPct(pct, 1)}
          <span className="ml-1 font-normal text-slate-400">attributed</span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${hitGoal ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${pct == null ? 0 : Math.min(100, pct)}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-slate-400"
          style={{ left: `${COVERAGE_GOAL_PCT}%` }}
          title={`Goal: ${COVERAGE_GOAL_PCT}% tagged`}
        />
      </div>
      <p className="mt-1 text-[10px] tabular-nums text-slate-400">
        {stat.total === 0
          ? 'No data in range'
          : `${fmtInt(stat.untagged)} of ${fmtInt(stat.total)} unattributable`}
      </p>
    </div>
  )
}

function SectionTitle({ children, extra }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold text-slate-800">{children}</h2>
      {extra}
    </div>
  )
}

export default function AdminExecutiveDashboard({
  rangeDays,
  onRangeDays,
  dashboard,
  crmRows,
  crmLoading,
  crmError,
  crmSalesSummary,
  crmGrowthKpis,
  crmAdvancedAnalysis,
  crmTrafficChannelSummary,
  crmSignupChannelSummary,
  crmTrafficSummary,
  crmCustomerSignups,
  analytics,
  analyticsLoading,
  analyticsError,
  productDashboard,
}) {
  const rows = Array.isArray(crmRows) ? crmRows : []
  const n = rows.length
  const premium = rows.filter((r) => r.is_premium).length
  const activeFree = rows.filter((r) => !r.is_premium && isActivatedSignup(r)).length
  const dormant = rows.filter((r) => !r.is_premium && !isActivatedSignup(r)).length
  const signups = Number(crmSalesSummary?.signups || 0)
  const activated = Number(crmSalesSummary?.activated || 0)
  const sessions = Number(crmTrafficSummary?.uniqueSessions || analytics?.uniqueSessionsPageView || 0)
  const premiumIntent = Number(crmGrowthKpis?.premiumIntent || 0)
  const premiumInRange = (crmCustomerSignups || []).filter((r) => r.is_premium).length
  const other = Math.max(0, n - premium - activeFree - dormant)
  const prevSessions = Number(analytics?.summaryPrev?.uniqueSessionsPageView || 0)
  const pop = crmAdvancedAnalysis?.pop
  const dauDaily = Array.isArray(analytics?.activity?.dauDaily) ? analytics.activity.dauDaily : []
  const lastDau = dauDaily.length ? dauDaily[dauDaily.length - 1] : null
  const lastTrend = Array.isArray(analytics?.dailyTrend) && analytics.dailyTrend.length
    ? analytics.dailyTrend[analytics.dailyTrend.length - 1]
    : null
  const loggedInDau = Number(dashboard?.dauToday || 0)
  const rpcActiveUsers = Number(lastDau?.activeUsers || 0)
  const latestDaySessions = Number(lastTrend?.uniqueSessions || lastDau?.activeSessions || 0)
  const periodSessions = Number(analytics?.uniqueSessionsPageView || sessions || 0)
  const activeKpi = rpcActiveUsers > 0
    ? { value: rpcActiveUsers, note: 'Logged-in users with a page view (latest day)' }
    : latestDaySessions > 0
      ? { value: latestDaySessions, note: 'Unique sessions (latest day)' }
      : periodSessions > 0
        ? { value: periodSessions, note: 'Unique sessions in selected range' }
        : loggedInDau > 0
          ? { value: loggedInDau, note: 'Logged-in DAU from mypage activity table' }
          : { value: null, note: 'No activity feed yet' }

  const kpis = [
    {
      label: 'Total users',
      value: fmtInt(n),
      icon: Users,
      delta: popDelta(pop?.signups?.current, pop?.signups?.previous),
    },
    {
      label: 'Premium members',
      value: fmtInt(premium),
      icon: Crown,
      delta: null,
      caption: 'Current status, whole cohort',
    },
    {
      label: 'Activated (range)',
      value: fmtInt(activated),
      icon: Percent,
      delta: popDelta(crmAdvancedAnalysis?.current?.activated, crmAdvancedAnalysis?.previous?.activated),
      caption: 'Signed up, then searched / viewed within 7d',
    },
    {
      label: 'Active users',
      value: activeKpi.value == null ? '—' : fmtInt(activeKpi.value),
      icon: Users,
      delta: popDelta(sessions, prevSessions),
      caption: activeKpi.note,
      loading: analyticsLoading,
    },
    {
      label: 'Monthly revenue (MRR)',
      value: '—',
      icon: Coins,
      delta: null,
    },
  ]

  const trend = useMemo(() => {
    const days = Array.isArray(analytics?.dailyTrend) ? analytics.dailyTrend : []
    const isoByMmdd = buildIsoByMmdd(rangeDays)
    const created = rows
      .map((r) => String(r.user_created_at || '').slice(0, 10))
      .filter(Boolean)
    const premiumDays = rows
      .filter((r) => r.is_premium)
      .map((r) => String(r.user_created_at || '').slice(0, 10))
      .filter(Boolean)
    return days.map((d) => {
      const mmdd = String(d.day || '').slice(-5)
      const iso = isoByMmdd.get(mmdd) || ''
      return {
        day: mmdd.replace('-', '/'),
        users: iso ? created.filter((x) => x <= iso).length : null,
        active: Number(d.uniqueSessions || 0),
        premium: iso ? premiumDays.filter((x) => x <= iso).length : null,
      }
    })
  }, [analytics, rows, rangeDays])

  const funnel = useMemo(() => {
    const steps = [
      { label: 'Sessions', value: sessions },
      { label: 'Sign-ups', value: signups },
      { label: 'First use', value: activated },
      { label: 'Premium intent', value: premiumIntent },
      { label: 'Premium (in range)', value: premiumInRange },
    ]
    const top = steps[0].value || 0
    return steps.map((s, i) => ({
      ...s,
      color: FUNNEL_BG[i],
      width: Math.max(42, 100 - i * 13),
      pct: top > 0 ? (s.value / top) * 100 : null,
    }))
  }, [sessions, signups, activated, premiumIntent, premiumInRange])

  const segments = useMemo(() => {
    const items = [
      { name: 'Active (free)', value: Math.max(0, activeFree) },
      { name: 'Premium', value: premium },
      { name: 'Dormant', value: Math.max(0, dormant) },
    ]
    if (other > 0) items.push({ name: 'Unclassified', value: other })
    const total = items.reduce((s, x) => s + x.value, 0)
    return { items, total }
  }, [activeFree, premium, dormant, other])

  const channels = useMemo(() => {
    const useTraffic = (crmTrafficChannelSummary || []).length > 0
    const raw = useTraffic ? crmTrafficChannelSummary : (crmSignupChannelSummary || [])
    const allTotal = raw.reduce((s, r) => s + Number(r.count || r.signups || 0), 0)
    return {
      unit: useTraffic ? 'sessions' : 'sign-ups',
      rows: raw.slice(0, 5).map((r, i) => {
        const value = Number(r.count || r.signups || 0)
        return {
          id: r.id || r.label,
          name: r.label || '—',
          value,
          share: allTotal > 0 ? (value / allTotal) * 100 : 0,
          color: CH_DOT[i % CH_DOT.length],
        }
      }),
    }
  }, [crmTrafficChannelSummary, crmSignupChannelSummary])

  const coverage = useMemo(() => {
    const share = (part, whole) => (whole > 0 ? (part / whole) * 100 : null)
    const build = (total, tagged) => {
      const t = Math.max(0, Number(total || 0))
      const ok = Math.min(t, Math.max(0, Number(tagged || 0)))
      return { total: t, tagged: ok, untagged: t - ok, taggedPct: share(ok, t) }
    }
    return {
      sessions: build(crmTrafficSummary?.uniqueSessions, crmTrafficSummary?.attributedSessions),
      signups: build(crmSalesSummary?.signups, crmSalesSummary?.withAttr),
    }
  }, [crmTrafficSummary, crmSalesSummary])

  const recent = (crmCustomerSignups || []).slice(0, 5)
  const campaign = (analytics?.topCampaigns || [])[0] || null
  const campaignViews = Number(campaign?.page_views || 0)
  const campaignSessions = Number(campaign?.unique_sessions || 0)
  const campaignShare = periodSessions > 0 && campaignSessions > 0
    ? (campaignSessions / periodSessions) * 100
    : null

  const features = useMemo(() => {
    const rollups = Array.isArray(productDashboard?.rollups) ? productDashboard.rollups : []
    const denom = rollups.reduce((s, p) => s + Number(p.views || 0), 0)
    return rollups.slice(0, 6).map((p) => {
      const views = Number(p.views || 0)
      const samples = Array.isArray(p.samplePaths) ? p.samplePaths : []
      return {
        id: p.id,
        name: featureLabel(p.id, p.label),
        views,
        pct: denom > 0 ? (views / denom) * 100 : 0,
        hint: p.id === 'other' && samples.length
          ? samples.join(', ')
          : p.id === 'other'
            ? 'Paths not mapped to a product area'
            : '',
      }
    })
  }, [productDashboard])

  const rangeLabel = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - Math.max(0, Number(rangeDays || 30) - 1))
    const f = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
    return `${f(start)} – ${f(end)}`
  }, [rangeDays])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-[13px] text-slate-400">See user growth and engagement at a glance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
            <CalendarDays size={13} />
            {rangeLabel}
          </span>
          <select
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5"
            value={String(rangeDays)}
            onChange={(e) => onRangeDays(Number(e.target.value))}
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[9px] font-semibold text-white">JN</span>
            <span>
              <span className="block text-[11px] font-medium text-slate-700">Admin</span>
              <span className="block text-[10px] text-slate-400">Staff</span>
            </span>
          </span>
        </div>
      </div>

      {(crmError || analyticsError) && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{crmError || analyticsError}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}>
              <div className="flex items-center gap-2 text-slate-400">
                <Icon size={15} />
                <p className="text-[12px]">{k.label}</p>
              </div>
              <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-slate-900">
                {(k.loading ?? crmLoading) ? '…' : k.value}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                {k.delta ? (
                  <span className={k.delta.up ? 'font-medium text-emerald-500' : 'font-medium text-rose-500'}>
                    {k.delta.up ? '↑' : '↓'} {k.delta.text}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
                <span className="text-slate-400">{k.caption || 'vs prior period'}</span>
              </div>
            </Card>
          )
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Total / Premium / Trial = loaded CRM cohort (max 300, staff excluded).
        Active = site analytics (logged-in users or unique sessions), not the old mypage-only DAU table.
        MRR is not connected. Funnel sessions = CRM traffic RPC; sign-ups / first use / intent = customers created in range.
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <SectionTitle
            extra={(
              <div className="flex gap-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: BLUE }} />Total users</span>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: ORANGE }} />Active</span>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: GREEN }} />Premium</span>
              </div>
            )}
          >
            User trend
          </SectionTitle>
          <div className="h-56">
            {analyticsLoading || !trend.length ? (
              <p className="flex h-full items-center justify-center text-xs text-slate-400">
                {analyticsLoading ? 'Loading…' : 'No trend data'}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip />
                  <Line type="monotone" dataKey="users" stroke={BLUE} strokeWidth={2} dot={false} name="Total users" />
                  <Line type="monotone" dataKey="active" stroke={ORANGE} strokeWidth={2} dot={false} name="Active" />
                  <Line type="monotone" dataKey="premium" stroke={GREEN} strokeWidth={2} dot={false} name="Premium" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-3">
          <SectionTitle>User funnel</SectionTitle>
          <div className="flex items-stretch gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2">
              {funnel.map((s) => (
                <div
                  key={s.label}
                  className="flex h-8 items-center justify-between px-3 text-[10px] text-white"
                  style={{
                    width: `${s.width}%`,
                    background: s.color,
                    clipPath: 'polygon(6% 0, 94% 0, 100% 100%, 0 100%)',
                  }}
                >
                  <span className="truncate">{s.label}</span>
                  <span className="ml-2 tabular-nums">{fmtInt(s.value)}</span>
                </div>
              ))}
            </div>
            <div className="flex w-10 flex-col justify-around py-2 text-right text-[10px] text-slate-400">
              {funnel.map((s) => (
                <div key={`${s.label}-pct`}>{fmtPct(s.pct)}</div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <SectionTitle>User segments</SectionTitle>
          <div className="flex items-center gap-3">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={segments.items} dataKey="value" innerRadius={46} outerRadius={68} paddingAngle={1} stroke="none">
                    {segments.items.map((_, i) => (
                      <Cell key={i} fill={PIE[i % PIE.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[16px] font-semibold tabular-nums text-slate-900">{fmtInt(n)}</p>
                <p className="text-[10px] text-slate-400">Users</p>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-[11px] text-slate-600">
              {segments.items.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <i className="h-2 w-2 rounded-full" style={{ background: PIE[i % PIE.length] }} />
                    {s.name}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {fmtInt(s.value)} · {segments.total ? fmtPct((s.value / segments.total) * 100) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <h3 className="mb-2 mt-4 text-[13px] font-semibold text-slate-800">Acquisition channels</h3>
          <p className="mb-2 text-[10px] text-slate-400">
            {channels.unit === 'sessions' ? 'Landing sessions by first-touch channel' : 'Sign-ups by first-touch channel'}
          </p>
          <div className="space-y-2">
            {channels.rows.length === 0 ? (
              <p className="text-xs text-slate-400">No channel data</p>
            ) : channels.rows.map((c) => (
              <div key={c.id} className="grid grid-cols-[14px_1fr_auto] items-center gap-2 text-[11px] text-slate-600">
                <i className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                <div>
                  <div className="mb-1 truncate">{c.name}</div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${c.share}%`, background: c.color }} />
                  </div>
                </div>
                <span className="whitespace-nowrap text-right tabular-nums text-slate-500">
                  {fmtInt(c.value)} · {fmtPct(c.share)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            <span className="font-medium text-slate-500">Direct / no referrer</span>
            {' '}
            = no document.referrer and no UTM on first touch (typed URL, bookmark, in-app browser, or privacy stripping).
            Not a paid source.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-12">
          <SectionTitle extra={<span className="text-[11px] font-normal text-slate-400">Goal: 80%</span>}>
            Attribution coverage
          </SectionTitle>
          <p className="mb-4 text-[10px] text-slate-400">
            Share of traffic carrying a UTM, a click ID, or a known referrer. The rest cannot be credited
            to any channel, so channel experiments stay unmeasurable until this rises. A referrer alone
            names the site but not the post — only UTM tells campaigns apart.
          </p>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <CoverageBar label="Sessions" stat={coverage.sessions} />
            <CoverageBar label="Sign-ups" stat={coverage.signups} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <SectionTitle>Campaign performance</SectionTitle>
          {campaign ? (
            <div className="flex gap-4">
              <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                <img src="/icon.png" alt="" className="h-10 w-10 rounded-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug text-slate-900">
                  {String(campaign.campaign || campaign.label || '—')}
                </p>
                <dl className="mt-3 space-y-1.5 text-[12px] text-slate-500">
                  <div className="flex justify-between">
                    <dt>Page views</dt>
                    <dd className="tabular-nums text-slate-800">{fmtInt(campaignViews)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Sessions</dt>
                    <dd className="tabular-nums text-slate-800">{fmtInt(campaignSessions)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Share of sessions</dt>
                    <dd className="tabular-nums text-slate-800">{fmtPct(campaignShare, 1)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>CPA</dt>
                    <dd className="text-slate-300">—</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[10px] text-slate-400">
                  {[campaign.utm_source, campaign.utm_medium].filter(Boolean).join(' / ') || 'No utm_source / utm_medium'}
                </p>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-slate-400">No campaign activity in this period</p>
          )}
        </Card>

        <Card className="xl:col-span-5">
          <SectionTitle>Recent users</SectionTitle>
          <table className="w-full text-left text-[12px]">
            <thead className="text-[11px] text-slate-400">
              <tr>
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Signed up</th>
                <th className="pb-2 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">No sign-ups in this period</td></tr>
              ) : recent.map((u) => {
                const st = statusOf(u)
                return (
                  <tr key={u.user_id} className="border-t border-slate-100">
                    <td className="py-2.5 text-slate-700">{u.email || String(u.user_id || '').slice(0, 8)}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="py-2.5 tabular-nums text-slate-400">{String(u.user_created_at || '').slice(5, 10).replace('-', '/')}</td>
                    <td className="py-2.5 text-slate-400">{relativeTime(u.last_seen_at || u.last_sign_in_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        <Card className="xl:col-span-3">
          <SectionTitle>Popular features</SectionTitle>
          <p className="mb-2 text-[10px] text-slate-400">Page views · share of the 15 most-viewed tracked paths</p>
          <ol className="space-y-3">
            {features.length === 0 ? (
              <li className="text-xs text-slate-400">No page usage data</li>
            ) : features.map((f, i) => (
              <li key={`${f.id}-${i}`} className="grid grid-cols-[18px_1fr_auto] items-center gap-2 text-[12px] text-slate-700">
                <span className="tabular-nums text-slate-400">{i + 1}</span>
                <div>
                  <div className="mb-0.5 truncate">{f.name}</div>
                  {f.hint ? <div className="mb-1 truncate text-[10px] text-slate-400">{f.hint}</div> : null}
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
                <span className="whitespace-nowrap text-right tabular-nums text-slate-500">
                  {fmtInt(f.views)} · {fmtPct(f.pct)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}
