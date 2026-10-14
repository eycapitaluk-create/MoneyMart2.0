import { classifyReferrerChannel } from './referrerBuckets'
import { hasPremiumIntent, hasSignupSource, isActivatedSignup, isCrmInternalUser, jstDateKey } from './crmInternalUsers'

const DAY_MS = 86400000
const MIN_N = 8

const pct1 = (num, den) => {
  if (!den || !Number.isFinite(num)) return null
  return Math.round((num / den) * 1000) / 10
}

const deltaPct = (cur, prev) => {
  if (cur == null || prev == null) return null
  if (prev === 0) return cur > 0 ? null : 0
  return Math.round(((cur - prev) / prev) * 1000) / 10
}

/** Wilson score interval for a binomial rate. Returns % points. */
export function wilsonInterval(successes, n, z = 1.96) {
  if (!n || n <= 0) return null
  const p = successes / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = p + z2 / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)
  return {
    ratePct: Math.round(p * 1000) / 10,
    lowPct: Math.round(Math.max(0, (center - margin) / denom) * 1000) / 10,
    highPct: Math.round(Math.min(1, (center + margin) / denom) * 1000) / 10,
    unreliable: n < MIN_N,
  }
}

const hasAttribution = (row) => hasSignupSource(row)

const channelOf = (row) => classifyReferrerChannel({
  referrerDomain: row?.signup_referrer_domain,
  utmSource: row?.signup_utm_source,
  utmMedium: row?.signup_utm_medium,
  utmCampaign: row?.signup_utm_campaign,
  signupRef: row?.signup_ref,
})

const createdMs = (row) => (row?.user_created_at ? new Date(row.user_created_at).getTime() : 0)

const isoWeekStart = (ms) => {
  const key = jstDateKey(ms)
  if (!key) return ''
  const [year, month, dayOfMonth] = key.split('-').map(Number)
  const utc = Date.UTC(year, month - 1, dayOfMonth)
  const day = new Date(utc).getUTCDay() || 7
  const monday = utc - (day - 1) * DAY_MS
  return new Date(monday).toISOString().slice(0, 10)
}

const summarizeCohort = (rows) => {
  const n = rows.length
  const activated = rows.filter((r) => isActivatedSignup(r)).length
  const intent = rows.filter((r) => hasPremiumIntent(r)).length
  const attributed = rows.filter((r) => hasAttribution(r)).length
  return {
    n,
    activated,
    intent,
    attributed,
    activationPct: pct1(activated, n),
    intentPct: pct1(intent, n),
    attributionPct: pct1(attributed, n),
    activationWilson: wilsonInterval(activated, n),
  }
}

const herfindahl = (shares) => {
  if (!shares.length) return 0
  return Math.round(shares.reduce((acc, s) => acc + s * s, 0) * 10) / 10
}

export function buildCrmAdvancedAnalysis({
  allRows = [],
  rangeDays = 30,
  trafficByChannel = [],
  sessions = 0,
} = {}) {
  const now = Date.now()
  const curStart = now - rangeDays * DAY_MS
  const prevStart = now - rangeDays * 2 * DAY_MS
  const customers = (allRows || []).filter((r) => !isCrmInternalUser(r))
  const current = customers.filter((r) => {
    const t = createdMs(r)
    return t >= curStart && t <= now
  })
  const previous = customers.filter((r) => {
    const t = createdMs(r)
    return t >= prevStart && t < curStart
  })

  const cur = summarizeCohort(current)
  const prev = summarizeCohort(previous)
  const pop = {
    signups: { current: cur.n, previous: prev.n, deltaPct: deltaPct(cur.n, prev.n) },
    activationPct: { current: cur.activationPct, previous: prev.activationPct, deltaPct: deltaPct(cur.activationPct, prev.activationPct) },
    intentPct: { current: cur.intentPct, previous: prev.intentPct, deltaPct: deltaPct(cur.intentPct, prev.intentPct) },
    attributionPct: { current: cur.attributionPct, previous: prev.attributionPct, deltaPct: deltaPct(cur.attributionPct, prev.attributionPct) },
    truncated: customers.length >= 280,
  }

  const trafficMap = new Map((trafficByChannel || []).map((r) => [r.id || r.label, Number(r.count || 0)]))
  const byChannel = new Map()
  for (const row of current) {
    const ch = channelOf(row)
    const prevRow = byChannel.get(ch.id) || {
      id: ch.id,
      label: ch.label,
      rows: [],
    }
    prevRow.rows.push(row)
    byChannel.set(ch.id, prevRow)
  }

  const channelQuality = [...byChannel.values()].map((bucket) => {
    const s = summarizeCohort(bucket.rows)
    const traffic = trafficMap.get(bucket.id) || 0
    const conversionPct = traffic > 0 ? pct1(s.n, traffic) : null
    const quality = Math.round(
      (Number(s.activationPct || 0) * 0.5)
      + (Number(s.intentPct || 0) * 0.2)
      + (Number(s.attributionPct || 0) * 0.2)
      + (Math.min(Number(conversionPct || 0), 20) * 0.5),
    )
    return {
      id: bucket.id,
      label: bucket.label,
      traffic,
      signups: s.n,
      conversionPct,
      activationPct: s.activationPct,
      activationWilson: s.activationWilson,
      intentPct: s.intentPct,
      attributionPct: s.attributionPct,
      quality,
      unreliable: s.n < MIN_N,
    }
  }).sort((a, b) => (b.quality - a.quality) || (b.signups - a.signups))

  const signupTotal = current.length || 1
  const shares = channelQuality.map((c) => (c.signups / signupTotal) * 100)
  const sortedShare = [...channelQuality].sort((a, b) => b.signups - a.signups)
  const concentration = {
    hhi: herfindahl(shares),
    top1Share: sortedShare[0] ? pct1(sortedShare[0].signups, current.length) : 0,
    top3Share: pct1(sortedShare.slice(0, 3).reduce((s, r) => s + r.signups, 0), current.length),
    topChannel: sortedShare[0]?.label || null,
  }

  const weeks = new Map()
  for (const row of current) {
    const key = isoWeekStart(createdMs(row) || now)
    const list = weeks.get(key) || []
    list.push(row)
    weeks.set(key, list)
  }
  const weeklyCohorts = [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, rows]) => {
      const s = summarizeCohort(rows)
      return { week, ...s }
    })

  const conv = sessions > 0 ? (cur.n / sessions) : 0
  let constraint = 'volume'
  let constraintNote = 'Not enough signups to diagnose a binding constraint.'
  if (sessions >= 40 && conv < 0.01) {
    constraint = 'conversion'
    constraintNote = 'Traffic is arriving but visit→signup is the bottleneck.'
  } else if (cur.n >= MIN_N && (cur.activationPct ?? 0) < 25) {
    constraint = 'activation'
    constraintNote = 'Signups exist; post-signup activation is the bottleneck.'
  } else if (cur.n >= MIN_N && (cur.attributionPct ?? 100) < 50) {
    constraint = 'measurement'
    constraintNote = 'Outcomes cannot be trusted — first-touch coverage is too low.'
  } else if (concentration.top1Share >= 55) {
    constraint = 'concentration'
    constraintNote = `Acquisition is concentrated in ${concentration.topChannel}.`
  } else if (cur.n >= MIN_N) {
    constraint = 'scale'
    constraintNote = 'Funnel ratios are stable enough to scale the best-quality channel.'
  }

  const bestReliable = channelQuality.find((c) => !c.unreliable)
  const worstReliable = [...channelQuality].reverse().find((c) => !c.unreliable && c.signups > 0)

  return {
    current: cur,
    previous: prev,
    pop,
    channelQuality,
    concentration,
    weeklyCohorts,
    constraint,
    constraintNote,
    bestReliable,
    worstReliable,
    minN: MIN_N,
  }
}
