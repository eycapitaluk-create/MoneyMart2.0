import { ohlcIsConsistent, PRICE_BASIS } from './yahooUnadjustedBar.js'

export const CHUNK_SIZE = 80

/** Symbols Marketstack already rejected or does not price. Do not call them again. */
export const MARKETSTACK_UNSUPPORTED = new Set([
  '^GSPC', '^DJI', '^IXIC', '^N225', '^HSI', '^SSEC', '^GDAXI',
  '^TNX', '^VIX', '^MOVE', '^VXTLT', '000001.SS', '491A.T',
  'JPY=X', 'EURJPY=X', 'GBPJPY=X', 'AUDJPY=X', 'CNYJPY=X',
])

const YAHOO_MISS = new Set(['pending_yahoo', 'invalid_price'])

/** Official FAQ: each ticker in one HTTP call is one billed request. Batching does not discount it. */
export function requestsForSymbols(count) {
  const symbols = Number(count)
  if (!Number.isFinite(symbols) || symbols <= 0) return 0
  return Math.floor(symbols)
}

export function supplementStorm(eligibleCount, batchSize) {
  const eligible = Number(eligibleCount) || 0
  const batch = Number(batchSize) || 0
  return eligible >= 8 && batch > 0 && eligible / batch > 0.25
}

/**
 * Historical marketstack jobs stored HTTP chunk counts, which underbill by up to 80x.
 * Prefer an explicit ticker bill. Otherwise charge chunks * 80. Missing marketstack
 * usage fails closed.
 */
export function conservativeBilledSymbols(jobs, { truncated = false } = {}) {
  if (truncated) return { used: null, reason: 'usage_unconfirmed' }
  const rows = Array.isArray(jobs) ? jobs : []
  if (!rows.some((row) => row?.source === 'marketstack')) {
    return { used: null, reason: 'usage_unconfirmed' }
  }
  let used = 0
  for (const row of rows) {
    const meta = row?.meta || {}
    const explicit = Number(meta.marketstack_billed_symbols)
    if (row?.source === 'yahoo') {
      if (Number.isFinite(explicit) && explicit > 0) used += explicit
      continue
    }
    if (row?.source !== 'marketstack') continue
    if (Number.isFinite(explicit) && explicit >= 0 && meta.marketstack_billed_symbols != null) {
      used += explicit
      continue
    }
    const listed = Array.isArray(meta.symbols) ? meta.symbols.length : Number(meta.symbol_count)
    if (Number.isFinite(listed) && listed > 0) {
      used += listed
      continue
    }
    const chunks = Number(meta.chunks)
    if (Number.isFinite(chunks) && chunks > 0) {
      used += chunks * CHUNK_SIZE
      continue
    }
    return { used: null, reason: 'usage_unconfirmed' }
  }
  return { used, reason: 'ok' }
}

export function budgetAllows(usedRequests, monthlyBudget, nextRequests) {
  return usedRequests + nextRequests <= monthlyBudget
}

/** Login-verified Basic usage. Do not replace this with a calendar-month log count. */
export const VERIFIED_MARKETSTACK_USAGE = {
  observedAt: '2026-10-09T05:33:27.201329+00:00',
  usedRequests: 1845,
  quotaRequests: 10000,
  periodStart: '2026-09-14',
  periodEnd: '2026-10-13',
  scheduledPlanChangeDate: '2026-10-13',
}

function tokyoDate(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function verifiedBillingOpen(now = new Date(), baseline = VERIFIED_MARKETSTACK_USAGE) {
  const today = tokyoDate(now)
  if (baseline.scheduledPlanChangeDate && today >= baseline.scheduledPlanChangeDate) return false
  return today >= baseline.periodStart && today <= baseline.periodEnd
}

export function enforcedQuota(envBudget, baseline = VERIFIED_MARKETSTACK_USAGE) {
  const requested = Number(envBudget)
  const cap = baseline.quotaRequests
  if (!Number.isFinite(requested) || requested <= 0) return cap
  return Math.min(requested, cap)
}

/**
 * Used = verified dashboard count plus ticker attempts reserved after that timestamp.
 * An empty job list is not zero usage. After the verified period, do not estimate the next plan.
 */
export function usageSinceVerifiedBaseline(jobs, { truncated = false, now = new Date(), baseline = VERIFIED_MARKETSTACK_USAGE } = {}) {
  if (!verifiedBillingOpen(now, baseline)) {
    return { used: null, reason: 'billing_period_unconfirmed', baseline_used: baseline.usedRequests, extra: null }
  }
  if (truncated) {
    return { used: null, reason: 'usage_unconfirmed', baseline_used: baseline.usedRequests, extra: null }
  }
  const observedMs = Date.parse(baseline.observedAt)
  let extra = 0
  for (const row of jobs || []) {
    const startedMs = Date.parse(row?.started_at || '')
    if (!Number.isFinite(startedMs) || startedMs <= observedMs) continue
    const meta = row?.meta || {}
    const explicit = Number(meta.marketstack_billed_symbols)
    if (Number.isFinite(explicit) && explicit > 0) {
      extra += explicit
      continue
    }
    if (row?.source === 'marketstack') {
      if (Array.isArray(meta.symbols) && meta.symbols.length > 0) {
        extra += meta.symbols.length
        continue
      }
      if (meta.marketstack_billed_symbols == null) {
        return { used: null, reason: 'usage_unconfirmed', baseline_used: baseline.usedRequests, extra: null }
      }
    }
  }
  return {
    used: baseline.usedRequests + extra,
    reason: 'verified_baseline',
    baseline_used: baseline.usedRequests,
    extra,
    quota: baseline.quotaRequests,
    period_end: baseline.periodEnd,
  }
}

export function marketstackHoldReason({ needed, classifiedCount, usage, hasKey, now, budget }) {
  if (!(Number(needed) > 0)) return null
  if (!verifiedBillingOpen(now)) return 'billing_period_unconfirmed'
  if (!hasKey) return 'marketstack_key_missing'
  if (!usage || usage.used == null) return usage?.reason || 'usage_unconfirmed'
  if (supplementStorm(needed, classifiedCount)) return 'yahoo_failure_storm'
  if (!budgetAllows(usage.used, budget, needed)) return 'budget'
  return null
}

export function marketstackCandidates(rows) {
  const eligible = []
  const skipped = []
  for (const row of rows || []) {
    const status = row?.assessment?.status
    if (!YAHOO_MISS.has(status)) continue
    const symbol = row.symbol || row.yahoo
    if (row.held || row.dashboardOnly || !symbol) {
      skipped.push({ symbol: symbol || row.item, reason: 'not_a_price_supplement' })
      continue
    }
    if (MARKETSTACK_UNSUPPORTED.has(symbol) || MARKETSTACK_UNSUPPORTED.has(row.yahoo)) {
      skipped.push({ symbol, reason: 'known_unsupported' })
      continue
    }
    eligible.push(row)
  }
  return { eligible, skipped }
}

const positive = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function assessmentFromMarketstackRow(row, expectedDate) {
  const tradeDate = String(row?.date || '').slice(0, 10)
  if (tradeDate !== expectedDate) return null
  const close = positive(row?.close)
  const open = positive(row?.open)
  const high = positive(row?.high)
  const low = positive(row?.low)
  if (close == null || open == null || high == null || low == null) return null
  if (!ohlcIsConsistent(open, high, low, close)) return null
  const volume = Number(row?.volume)
  return {
    status: 'ok',
    trade_date: tradeDate,
    expected_trade_date: expectedDate,
    close,
    open,
    high,
    low,
    ohlc_ok: true,
    volume: Number.isFinite(volume) && volume > 0 ? Math.round(volume) : null,
    change_pct: null,
    previous_trade_date: null,
    previous_close: null,
    price_basis: PRICE_BASIS,
    provider: 'marketstack',
    note: '',
  }
}
