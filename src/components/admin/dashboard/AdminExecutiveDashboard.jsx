import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarDays, Crown, Percent, Users } from 'lucide-react'
import CampaignLaunchCohortCard from './CampaignLaunchCohortCard'
import CampaignEntriesAdminCard from './CampaignEntriesAdminCard'
import { formatCrmJst, isCrmInternalUser, signupSourceText } from '../../../lib/crmInternalUsers'
import {
  activityStatus,
  buildActiveUsersKpi,
  buildCohortDimensions,
  buildRangeRates,
  buildUserTrend,
  channelDisplayName,
  CRM_COHORT_CAP,
  firstHoldingMeasurement,
  formatSharePct,
  paymentStatus,
  totalUsersCaption,
} from './executiveMetrics'

const BLUE = '#3b82f6'
const ORANGE = '#f59e0b'
const SLATE = '#64748b'
const PAYMENT_DOT = ['#22c55e', '#94a3b8']
const ACTIVITY_DOT = ['#2563eb', '#38bdf8', '#f59e0b']
const CH_DOT = ['#0f172a', '#38bdf8', '#94a3b8', '#22c55e', '#cbd5e1']

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

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const lines = [
    ['Loaded cohort', row.loadedCohort, 'Cumulative signups in the fetched list (max 300)'],
    ['Logged-in users', row.activeUsers, 'Distinct user_id with a page view that day'],
    ['Unique sessions', row.sessions, 'Distinct session_id with a page view that day'],
  ]
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-sm">
      <p className="mb-1 font-medium text-slate-900">{row.day}</p>
      {lines.map(([label, value, hint]) => (
        <p key={label} className="mt-1">
          <span className="font-medium">{label}: </span>
          <span className="tabular-nums">{value == null ? '—' : fmtInt(value)}</span>
          <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span>
        </p>
      ))}
    </div>
  )
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
  crmRows,
  crmLoading,
  crmError,
  crmSalesSummary,
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
  const rows = useMemo(
    () => (Array.isArray(crmRows) ? crmRows : []).filter((row) => !isCrmInternalUser(row)),
    [crmRows],
  )
  const n = rows.length
  const dimensions = useMemo(() => buildCohortDimensions(rows), [rows])
  const premium = dimensions.payment.find((item) => item.name === 'Premium')?.value || 0
  const activated = Number(crmSalesSummary?.activated || 0)
  const sessions = Number(crmTrafficSummary?.uniqueSessions || analytics?.uniqueSessionsPageView || 0)
  const signupRows = Array.isArray(crmCustomerSignups) ? crmCustomerSignups : []
  const rangeRates = useMemo(
    () => buildRangeRates({ sessions, signupRows, cohortAtCap: n >= CRM_COHORT_CAP }),
    [sessions, signupRows, n],
  )
  const firstHolding = firstHoldingMeasurement()
  const dauDaily = Array.isArray(analytics?.activity?.dauDaily) ? analytics.activity.dauDaily : []
  const periodSessions = Number(analytics?.uniqueSessionsPageView || sessions || 0)
  const activeKpi = analyticsLoading
    ? { value: null, delta: null, caption: 'Loading logged-in user counts' }
    : buildActiveUsersKpi(dauDaily)

  const kpis = [
    {
      label: 'Total users',
      value: fmtInt(n),
      icon: Users,
      delta: null,
      hideDelta: true,
      caption: totalUsersCaption(n),
    },
    {
      label: 'Premium members',
      value: fmtInt(premium),
      icon: Crown,
      delta: null,
      hideDelta: true,
      caption: 'Payment status in the loaded cohort. Not an activity count.',
    },
    {
      label: 'Activated (range)',
      value: fmtInt(activated),
      icon: Percent,
      delta: popDelta(crmAdvancedAnalysis?.current?.activated, crmAdvancedAnalysis?.previous?.activated),
      caption: 'Signed up in range, then searched / viewed within 7d',
    },
    {
      label: 'Active users',
      value: activeKpi.value == null ? '—' : fmtInt(activeKpi.value),
      icon: Users,
      delta: activeKpi.delta,
      hideDelta: true,
      caption: activeKpi.caption,
      loading: analyticsLoading,
    },
  ]

  const trendModel = useMemo(
    () => buildUserTrend({
      dailyTrend: analytics?.dailyTrend,
      dauDaily,
      rows,
      rangeDays,
    }),
    [analytics, dauDaily, rows, rangeDays],
  )
  const trend = trendModel.points

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                ) : k.hideDelta ? null : (
                  <span className="text-slate-300">—</span>
                )}
                <span className="text-slate-400">{k.caption || 'vs prior period'}</span>
              </div>
            </Card>
          )
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Total users is the loaded CRM cohort (max 300, staff excluded), not the count of new signups.
        Premium is current payment status in that cohort. Activated compares signups in this range with the previous range of the same length.
        Active users is the latest day’s distinct logged-in user_id with a page view. If that series is missing, the card stays blank instead of showing sessions.
        Unique sessions stay on the chart’s right axis. Rates below are separate ratios, not a sequence.
        MRR is not connected to billing, so it is not shown. Staff work sessions and local dev traffic are excluded from session counts.
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <SectionTitle
            extra={(
              <div className="flex flex-wrap justify-end gap-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: BLUE }} />Loaded cohort</span>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: ORANGE }} />Logged-in users</span>
                <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: SLATE }} />Unique sessions</span>
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
                  <YAxis yAxisId="users" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                  <YAxis yAxisId="sessions" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<TrendTooltip />} />
                  <Line yAxisId="users" type="monotone" dataKey="loadedCohort" stroke={BLUE} strokeWidth={2} dot={false} name="Loaded cohort" connectNulls={false} />
                  <Line yAxisId="users" type="monotone" dataKey="activeUsers" stroke={ORANGE} strokeWidth={2} dot={false} name="Logged-in users" connectNulls={false} />
                  <Line yAxisId="sessions" type="monotone" dataKey="sessions" stroke={SLATE} strokeWidth={1.5} dot={false} name="Unique sessions" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
            Left axis: people (loaded cohort and logged-in users). Right axis: unique sessions. Premium is current payment status only, so it is not drawn on this chart.
            {trendModel.hasUserSeries
              ? ' Logged-in users are distinct user_id values, not sessions.'
              : ' Logged-in users are not drawn because that series was not returned.'}
          </p>
        </Card>

        <Card className="xl:col-span-3">
          <SectionTitle>Range rates</SectionTitle>
          <p className="mb-2 text-[10px] leading-relaxed text-slate-400">
            Not a funnel. Sessions are not the same people as sign-ups, and premium intent is not limited to first use
            {rangeRates.intent > 0
              ? ` (${fmtInt(rangeRates.intentAlsoFirstUse)} of ${fmtInt(rangeRates.intent)} intent sign-ups also count as first use).`
              : '.'}
            {rangeRates.cohortAtCap
              ? ` Sign-up counts use the loaded list, which is at the ${CRM_COHORT_CAP}-row cap, so this range can be incomplete.`
              : ''}
          </p>
          <ul className="space-y-2">
            {rangeRates.cards.map((card) => (
              <li key={card.label} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-2 text-[12px] text-slate-800">
                  <span>{card.label}</span>
                  <span className="tabular-nums font-medium">
                    {fmtInt(card.value)}
                    {card.rate != null ? ` · ${formatSharePct(card.rate)}` : ''}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {card.rate == null ? card.denominator : `Denominator: ${card.denominator}`}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            First holding within 7 days: —
            {' '}
            {firstHolding.caption}
          </p>
        </Card>

        <Card className="xl:col-span-4">
          <SectionTitle>Cohort status</SectionTitle>
          <p className="mb-3 text-[10px] leading-relaxed text-slate-400">
            Payment and activity are separate. A premium member can also be dormant. Both use the loaded cohort ({fmtInt(n)}).
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[12px] font-semibold text-slate-800">Payment</p>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                {dimensions.payment.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full" style={{ background: PAYMENT_DOT[i] }} />
                      {s.name}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {fmtInt(s.value)} · {dimensions.total ? formatSharePct((s.value / dimensions.total) * 100) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-semibold text-slate-800">Activity</p>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                {dimensions.activity.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full" style={{ background: ACTIVITY_DOT[i] }} />
                      {s.name}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {fmtInt(s.value)} · {dimensions.total ? formatSharePct((s.value / dimensions.total) * 100) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
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
                  <div className="mb-1 truncate">{channelDisplayName(c.id, c.name)}</div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${c.share}%`, background: c.color }} />
                  </div>
                </div>
                <span className="whitespace-nowrap text-right tabular-nums text-slate-500">
                  {fmtInt(c.value)} · {formatSharePct(c.share)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            <span className="font-medium text-slate-500">No referrer or UTM captured</span>
            {' '}
            means the first touch stored no document.referrer and no UTM. That includes typed URLs, bookmarks, in-app browsers, and privacy stripping. It is not a confirmed direct channel.
            {Number.isFinite(Number(crmTrafficSummary?.uniqueSessions))
              ? ` In this range, ${fmtInt(crmTrafficSummary?.directUnknownSessions)} of ${fmtInt(crmTrafficSummary?.uniqueSessions)} sessions are in that uncaptured bucket (${fmtInt(crmTrafficSummary?.attributedSessions)} have a referrer or UTM).`
              : ''}
            {' '}
            Staff logins and /admin paths are excluded. The latest customer-view SQL in this repo does not apply the earlier bot registry, so this remainder is not treated as bot-free direct traffic.
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
        <CampaignLaunchCohortCard rangeDays={rangeDays} />
        <CampaignEntriesAdminCard />
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
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                  Share of sessions compares this UTM row with all sessions in the selected range. It is not the SNS campaign conversion rate.
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
                <th className="pb-2 font-medium">Payment / activity</th>
                <th className="pb-2 font-medium">Signed up (JST)</th>
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">No sign-ups in this period</td></tr>
              ) : recent.map((u) => {
                const pay = paymentStatus(u)
                const act = activityStatus(u)
                return (
                  <tr key={u.user_id} className="border-t border-slate-100">
                    <td className="py-2.5 text-slate-700">{u.email || String(u.user_id || '').slice(0, 8)}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${pay.cls}`}>{pay.label}</span>
                      <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] ${act.cls}`}>{act.label}</span>
                    </td>
                    <td className="py-2.5 tabular-nums text-slate-400">{u.user_created_at ? formatCrmJst(u.user_created_at) : '—'}</td>
                    <td className="py-2.5 text-slate-500">{signupSourceText(u)}</td>
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
