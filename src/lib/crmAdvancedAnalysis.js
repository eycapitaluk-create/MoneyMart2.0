import { classifyReferrerChannel } from './referrerBuckets'
import { hasPremiumIntent, hasSignupSource, isActivatedSignup, isCrmInternalUser, jstDateKey } from './crmInternalUsers'

const DAY_MS = 86400000
const MIN_N = 8
const pct1 = (n, d) => d > 0 && Number.isFinite(n) ? Math.round(n / d * 1000) / 10 : null
const finiteCount = (v) => v == null || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v)
const deltaPct = (a, b) => a == null || b == null || b === 0 ? null : Math.round((a - b) / b * 1000) / 10
const deltaPp = (a, b) => a == null || b == null ? null : Math.round((a - b) * 10) / 10

export function wilsonInterval(successes, n, z = 1.96) {
  if (!Number.isFinite(successes) || !Number.isFinite(n) || n <= 0 || successes < 0 || successes > n) return null
  const p = successes / n, z2 = z * z, denom = 1 + z2 / n
  const center = p + z2 / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)
  return { ratePct: pct1(successes, n), lowPct: Math.round(Math.max(0, (center - margin) / denom) * 1000) / 10,
    highPct: Math.round(Math.min(1, (center + margin) / denom) * 1000) / 10, unreliable: n < MIN_N }
}
const createdMs = r => r?.user_created_at ? new Date(r.user_created_at).getTime() : NaN
const channelOf = r => classifyReferrerChannel({ referrerDomain: r?.signup_referrer_domain, utmSource: r?.signup_utm_source,
  utmMedium: r?.signup_utm_medium, utmCampaign: r?.signup_utm_campaign, signupRef: r?.signup_ref })
const isoWeekStart = ms => {
  const [y, m, d] = jstDateKey(ms).split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d), weekday = new Date(utc).getUTCDay() || 7
  return new Date(utc - (weekday - 1) * DAY_MS).toISOString().slice(0, 10)
}
const summarize = (rows, now) => {
  const mature = rows.filter(r => now - createdMs(r) >= 7 * DAY_MS)
  const n = rows.length, activated = rows.filter(isActivatedSignup).length
  const intent = rows.filter(hasPremiumIntent).length, attributed = rows.filter(hasSignupSource).length
  const matureActivated = mature.filter(isActivatedSignup).length
  return { n, activated, intent, attributed, activationPct: pct1(activated, n), intentPct: pct1(intent, n), attributionPct: pct1(attributed, n),
    matured: { n: mature.length, activated: matureActivated, activationPct: pct1(matureActivated, mature.length),
      intentPct: pct1(mature.filter(hasPremiumIntent).length, mature.length), attributionPct: pct1(mature.filter(hasSignupSource).length, mature.length),
      activationWilson: wilsonInterval(matureActivated, mature.length) }, pending: n - mature.length,
    activationWilson: wilsonInterval(matureActivated, mature.length) }
}

/** Analysis of the existing bounded CRM response. Never fetches additional customer data. */
export function buildCrmAdvancedAnalysis({ allRows = [], rangeDays = 30, trafficByChannel = [], sessions = null,
  now = Date.now(), loadLimit = 300, dataStatus = { customers: 'ready', traffic: 'ready' }, loadedAt = {} } = {}) {
  rangeDays = Math.max(1, Math.min(366, Number(rangeDays) || 30))
  const curStart = now - rangeDays * DAY_MS, prevStart = now - rangeDays * 2 * DAY_MS
  const raw = Array.isArray(allRows) ? allRows : []
  const valid = raw.filter(r => Number.isFinite(createdMs(r)) && createdMs(r) <= now)
  const customerReady = dataStatus.customers === 'ready', trafficReady = dataStatus.traffic === 'ready'
  const customers = valid.filter(r => !isCrmInternalUser(r))
  const current = customers.filter(r => createdMs(r) >= curStart), previous = customers.filter(r => createdMs(r) >= prevStart && createdMs(r) < curStart)
  const oldestMs = valid.length ? Math.min(...valid.map(createdMs)) : null
  const limitHit = raw.length >= loadLimit, invalidDates = raw.length - valid.length
  const currentComplete = customerReady && !invalidDates && (!limitHit || (oldestMs != null && oldestMs <= curStart))
  const previousComplete = customerReady && !invalidDates && (!limitHit || (oldestMs != null && oldestMs <= prevStart))
  const trafficCount = trafficReady ? finiteCount(sessions) : null
  const cur = summarize(current, now), prev = summarize(previous, now)
  const comparable = currentComplete && previousComplete
  const pop = {
    signups: { current: customerReady ? cur.n : null, previous: previousComplete ? prev.n : null, deltaPct: comparable ? deltaPct(cur.n, prev.n) : null },
    activationPct: { current: customerReady ? cur.matured.activationPct : null, previous: previousComplete ? prev.matured.activationPct : null,
      deltaPp: comparable ? deltaPp(cur.matured.activationPct, prev.matured.activationPct) : null },
    intentPct: { current: customerReady ? cur.intentPct : null, previous: previousComplete ? prev.intentPct : null, deltaPp: comparable ? deltaPp(cur.intentPct, prev.intentPct) : null },
    attributionPct: { current: customerReady ? cur.attributionPct : null, previous: previousComplete ? prev.attributionPct : null, deltaPp: comparable ? deltaPp(cur.attributionPct, prev.attributionPct) : null },
    truncated: !previousComplete, comparable,
  }
  const trafficMap = new Map(trafficByChannel.map(r => [r.id || r.label, finiteCount(r.count)]))
  const byChannel = new Map()
  for (const r of current) { const ch = channelOf(r), bucket = byChannel.get(ch.id) || { ...ch, rows: [] }; bucket.rows.push(r); byChannel.set(ch.id, bucket) }
  const channelQuality = [...byChannel.values()].map(b => {
    const s = summarize(b.rows, now), m = s.matured
    const traffic = trafficReady ? trafficMap.get(b.id) ?? null : null
    const ratio = currentComplete && traffic > 0 ? pct1(s.n, traffic) : null
    const unreliable = !currentComplete || m.n < MIN_N
    // Exploratory, not an ROI estimate. No mismatched-session ratio in the score.
    const quality = unreliable ? null : Math.round(m.activationPct * .6 + m.intentPct * .25 + m.attributionPct * .15)
    return { id: b.id, label: b.label, traffic, signups: s.n, maturedSignups: m.n, pendingSignups: s.pending,
      conversionPct: ratio, activationPct: m.activationPct, activationWilson: m.activationWilson, intentPct: m.intentPct,
      attributionPct: s.attributionPct, quality, unreliable }
  }).sort((a, b) => Number(a.unreliable) - Number(b.unreliable) || (b.quality ?? -1) - (a.quality ?? -1) || b.signups - a.signups)
  const shares = [...channelQuality].sort((a, b) => b.signups - a.signups)
  const concentration = { hhi: cur.n ? Math.round(channelQuality.reduce((s, c) => s + (c.signups / cur.n * 100) ** 2, 0) * 10) / 10 : null,
    top1Share: pct1(shares[0]?.signups || 0, cur.n), top3Share: pct1(shares.slice(0, 3).reduce((s, c) => s + c.signups, 0), cur.n), topChannel: shares[0]?.label || null }
  const weeks = new Map()
  current.forEach(r => { const key = isoWeekStart(createdMs(r)), rows = weeks.get(key) || []; rows.push(r); weeks.set(key, rows) })
  const weeklyCohorts = [...weeks.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([week, rows]) => {
    const s = summarize(rows, now); return { week, ...s, activationPct: s.matured.activationPct }
  })
  const issues = []
  if (!customerReady) issues.push(`Customer data ${dataStatus.customers || 'unavailable'}; signup counts are not confirmed.`)
  if (!trafficReady || trafficCount == null) issues.push(`Traffic ${dataStatus.traffic === 'ready' ? 'count unavailable' : dataStatus.traffic || 'unavailable'}; session ratios are withheld.`)
  if (customerReady && !currentComplete) issues.push(`Loaded ${raw.length} recent users; the current ${rangeDays}d window is incomplete. Counts are a lower bound.`)
  else if (customerReady && !previousComplete) issues.push('The prior window is incomplete; period changes are withheld.')
  if (invalidDates) issues.push(`${invalidDates} rows have invalid or future signup dates and are excluded.`)
  if (cur.pending) issues.push(`${cur.pending} recent signups are still inside the 7-day activation observation window.`)
  let constraint = 'volume', constraintNote = 'Small sample: collect more observations before diagnosing a bottleneck.'
  if (!customerReady || !trafficReady || trafficCount == null || !currentComplete || invalidDates) {
    constraint = 'measurement'; constraintNote = 'Resolve unavailable or incomplete measurements before diagnosing the funnel.'
  } else if (cur.n > 0 && !trafficCount) {
    constraint = 'measurement'; constraintNote = 'Signups exist but no sessions were measured. Check traffic coverage before interpreting a ratio.'
  } else if (cur.n >= MIN_N && cur.attributionPct < 50) {
    constraint = 'measurement'; constraintNote = 'Fewer than half of signup sources were captured. Channel comparisons have limited coverage.'
  } else if (trafficCount >= 40 && cur.n / trafficCount < .01) {
    constraint = 'conversion'; constraintNote = `${cur.n} signups and ${trafficCount} sessions recorded. Review the signup path; these are not matched visitor cohorts.`
  } else if (cur.n >= MIN_N && cur.matured.n < MIN_N) {
    constraint = 'observation'; constraintNote = `Only ${cur.matured.n} signups have a full 7-day observation window. Wait before ranking activation.`
  } else if (cur.matured.n >= MIN_N && cur.matured.activationPct < 25) {
    constraint = 'activation'; constraintNote = `Observed 7-day activation is ${cur.matured.activationPct}% among ${cur.matured.n} eligible signups; review onboarding.`
  } else if (cur.n >= MIN_N && concentration.top1Share >= 55) {
    constraint = 'concentration'; constraintNote = `${concentration.topChannel} accounts for ${concentration.top1Share}% of recorded signups. This is concentration, not proof of channel ROI.`
  } else if (cur.matured.n >= MIN_N) {
    constraint = 'experiment'; constraintNote = 'Enough observations for a small, tagged experiment; this does not establish stable performance or ROI.'
  }
  return { current: customerReady ? cur : null, previous: previousComplete ? prev : null, pop, channelQuality: customerReady ? channelQuality : [], concentration,
    weeklyCohorts: customerReady ? weeklyCohorts : [], constraint, constraintNote, bestReliable: channelQuality.find(c => !c.unreliable) || null,
    worstReliable: [...channelQuality].reverse().find(c => !c.unreliable) || null, minN: MIN_N,
    coverage: { customerReady, trafficReady, currentComplete, previousComplete, limitHit, loadedRows: raw.length, loadLimit,
      invalidDates, oldestSignup: oldestMs == null ? null : new Date(oldestMs).toISOString(), rangeStart: new Date(curStart).toISOString(),
      rangeEnd: new Date(now).toISOString(), customerLoadedAt: loadedAt.customers || null, trafficLoadedAt: loadedAt.traffic || null, issues },
    sessions: trafficCount }
}

/** Counts are independent cohorts, not a serial matched-user funnel. */
export function buildCrmDecisionMetrics(analysis) {
  const c = analysis?.current, sessions = analysis?.sessions ?? null
  const ready = analysis?.coverage?.customerReady === true
  const n = ready ? c.n : null
  const ratio = n != null && analysis.coverage.currentComplete && sessions > 0 ? pct1(n, sessions) : null
  return { sessions, signups: n, activated: ready ? c.activated : null, premiumIntent: ready ? c.intent : null,
    visitToSignupPct: ratio, signupToActivationPct: ready ? c.activationPct : null,
    signupToIntentPct: ready ? c.intentPct : null,
    // Intent need not be a subset of activation; never divide all intent by activated users.
    activationToIntentPct: null, visitToSignupDropoffPct: null, signupToActivationDropoffPct: null }
}
