import { hasPremiumIntent, isActivatedSignup } from '../../../lib/crmInternalUsers'

/** Matches admin_crm_users p_limit in AdminPage. */
export const CRM_COHORT_CAP = 300

const fmtSharePct = (pct) => {
  if (pct == null || !Number.isFinite(Number(pct))) return '—'
  const n = Number(pct)
  if (n === 0) return '0%'
  const abs = Math.abs(n)
  const digits = abs < 10 ? 2 : abs < 100 ? 1 : 0
  return `${n.toFixed(digits)}%`
}

/** daily_trend.day is 'MM-DD'; rebuild the full ISO date from the selected window. */
export function buildIsoByMmdd(rangeDays) {
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

function mmddKey(value) {
  const raw = String(value || '')
  if (raw.length >= 10 && raw[4] === '-') return raw.slice(5, 10)
  return raw.slice(-5)
}

/**
 * User trend points.
 * loadedCohort is the cumulative signup count inside the loaded CRM list.
 * activeUsers is distinct logged-in user_id with a page view that day.
 * sessions is distinct session_id with a page view that day.
 * Current premium status is not plotted: there is no paid-conversion timestamp.
 * Missing user rows stay null — they are never filled with session counts.
 */
export function buildUserTrend({ dailyTrend, dauDaily, rows, rangeDays }) {
  const days = Array.isArray(dailyTrend) ? dailyTrend : []
  const activity = Array.isArray(dauDaily) ? dauDaily : []
  const hasUserSeries = activity.length > 0
  const usersByMmdd = new Map()
  for (const row of activity) {
    const key = mmddKey(row?.day || row?.dayShort)
    if (!key) continue
    const activeUsers = Number(row?.activeUsers)
    usersByMmdd.set(key, Number.isFinite(activeUsers) ? activeUsers : null)
  }
  const isoByMmdd = buildIsoByMmdd(rangeDays)
  const created = (rows || [])
    .map((r) => String(r.user_created_at || '').slice(0, 10))
    .filter(Boolean)
  const points = days.map((d) => {
    const mmdd = mmddKey(d?.day)
    const iso = isoByMmdd.get(mmdd) || ''
    const sessions = Number(d?.uniqueSessions)
    return {
      day: mmdd.replace('-', '/'),
      loadedCohort: iso ? created.filter((x) => x <= iso).length : null,
      activeUsers: hasUserSeries ? (usersByMmdd.has(mmdd) ? usersByMmdd.get(mmdd) : null) : null,
      sessions: Number.isFinite(sessions) ? sessions : null,
    }
  })
  return { points, hasUserSeries }
}

/**
 * Latest-day logged-in users. Session totals are never substituted.
 * Prior-period delta stays hidden: the analytics payload has no previous-window active_users.
 */
export function buildActiveUsersKpi(dauDaily) {
  const series = Array.isArray(dauDaily) ? dauDaily : []
  if (!series.length) {
    return {
      collected: false,
      value: null,
      delta: null,
      caption: 'Logged-in user counts were not returned. Session counts are not used here.',
    }
  }
  const last = series[series.length - 1]
  const count = Number(last?.activeUsers)
  const day = String(last?.day || last?.dayShort || '').slice(0, 10) || 'the latest day'
  if (!Number.isFinite(count)) {
    return {
      collected: false,
      value: null,
      delta: null,
      caption: 'Logged-in user counts were not returned. Session counts are not used here.',
    }
  }
  return {
    collected: true,
    value: count,
    delta: null,
    caption: `Logged-in users with a page view on ${day}. Prior-period change is hidden because that user count is not in this response.`,
  }
}

export function totalUsersCaption(cohortSize, cap = CRM_COHORT_CAP) {
  const n = Math.max(0, Number(cohortSize) || 0)
  const atCap = n >= cap
  return atCap
    ? `Loaded cohort at the ${cap}-row cap. Signup change vs the prior period is not shown on this count.`
    : `Loaded cohort, max ${cap} (staff excluded). Signup change vs the prior period is not shown on this count.`
}

export function formatSharePct(pct) {
  return fmtSharePct(pct)
}

/**
 * Independent rates. Not a funnel: sessions are not the signup cohort, and
 * premium intent is stored separately from first use.
 */
export function buildRangeRates({ sessions, signupRows, cohortAtCap = false }) {
  const list = Array.isArray(signupRows) ? signupRows : []
  const signups = list.length
  const firstUse = list.filter((row) => isActivatedSignup(row)).length
  const intentRows = list.filter((row) => hasPremiumIntent(row))
  const intent = intentRows.length
  const intentAlsoFirstUse = intentRows.filter((row) => isActivatedSignup(row)).length
  const premiumNow = list.filter((row) => row?.is_premium).length
  const sessionCount = Number(sessions)
  const hasSessions = Number.isFinite(sessionCount) && sessionCount > 0
  const rate = (num, den) => (den > 0 ? (num / den) * 100 : null)
  return {
    cohortFunnel: false,
    cohortAtCap: Boolean(cohortAtCap),
    intent,
    intentAlsoFirstUse,
    cards: [
      {
        label: 'Sessions',
        value: hasSessions ? sessionCount : 0,
        rate: null,
        denominator: 'Unique sessions in the selected range',
      },
      {
        label: 'Sign-ups',
        value: signups,
        rate: hasSessions ? rate(signups, sessionCount) : null,
        denominator: 'Unique sessions in the selected range',
      },
      {
        label: 'First use',
        value: firstUse,
        rate: rate(firstUse, signups),
        denominator: 'Sign-ups in the selected range',
      },
      {
        label: 'Premium intent',
        value: intent,
        rate: rate(intent, signups),
        denominator: 'Sign-ups in the selected range',
      },
      {
        label: 'Premium now',
        value: premiumNow,
        rate: rate(premiumNow, signups),
        denominator: 'Sign-ups in the selected range',
      },
    ],
  }
}

export function firstHoldingMeasurement() {
  return {
    available: false,
    value: null,
    caption: 'Not measured. admin_crm_users returns no first-holding count. user_owned_stocks and user_owned_funds store created_at, but no admin aggregate exposes it. A watchlist add within 7 days is a different event and is not used as this rate.',
  }
}

export function channelDisplayName(id, label) {
  if (id === 'direct' || label === 'Direct / no referrer') return 'No referrer or UTM captured'
  return label || '—'
}

function visitedNotActivated(row) {
  if (isActivatedSignup(row)) return false
  return Number(row?.sessions_30d) > 0 || Number(row?.page_views_30d) > 0
}

/** Payment status and activity are separate partitions of the same loaded cohort. */
export function buildCohortDimensions(rows) {
  const list = Array.isArray(rows) ? rows : []
  const premium = list.filter((r) => r.is_premium).length
  const free = list.length - premium
  const activated = list.filter((r) => isActivatedSignup(r)).length
  const visited = list.filter((r) => visitedNotActivated(r)).length
  const dormant = Math.max(0, list.length - activated - visited)
  return {
    payment: [
      { name: 'Premium', value: premium },
      { name: 'Free', value: free },
    ],
    activity: [
      { name: 'Activated', value: activated },
      { name: 'Visited', value: visited },
      { name: 'Dormant', value: dormant },
    ],
    total: list.length,
  }
}

export function paymentStatus(row) {
  if (row?.is_premium) return { label: 'Premium', cls: 'bg-emerald-50 text-emerald-700' }
  return { label: 'Free', cls: 'bg-slate-100 text-slate-600' }
}

export function activityStatus(row) {
  if (isActivatedSignup(row)) return { label: 'Activated', cls: 'bg-sky-50 text-sky-700' }
  if (visitedNotActivated(row)) return { label: 'Visited', cls: 'bg-slate-100 text-slate-600' }
  return { label: 'Dormant', cls: 'bg-slate-50 text-slate-400' }
}
