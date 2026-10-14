import { lastCompletedSessionDate } from './tradingSessionDate.js'

export const PRICE_BASIS = 'unadjusted_daily_ohlc'
const BASIS_TOLERANCE = 0.002

export const EXCHANGE_SESSIONS = {
  XNYS: { timeZone: 'America/New_York', closeMinutes: 16 * 60 },
  XTKS: { timeZone: 'Asia/Tokyo', closeMinutes: 15 * 60 + 30 },
  XHKG: { timeZone: 'Asia/Hong_Kong', closeMinutes: 16 * 60 },
  XSHG: { timeZone: 'Asia/Shanghai', closeMinutes: 15 * 60 },
  XETR: { timeZone: 'Europe/Berlin', closeMinutes: 17 * 60 + 30 },
}

export function sessionDateFromUnix(unixSeconds, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Number(unixSeconds) * 1000))
}

export function completedSessionDate(calendarName, now = new Date()) {
  const session = EXCHANGE_SESSIONS[calendarName]
  if (!session) return null
  return lastCompletedSessionDate(now, session)
}

const positive = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function ohlcIsConsistent(open, high, low, close) {
  return low <= Math.min(open, close) && Math.max(open, close) <= high
}

export function eventDates(events, timeZone) {
  const dates = new Set()
  for (const group of [events?.dividends, events?.splits]) {
    if (!group || typeof group !== 'object') continue
    for (const event of Object.values(group)) {
      const ts = Number(event?.date)
      if (Number.isFinite(ts)) dates.add(sessionDateFromUnix(ts, timeZone))
    }
  }
  return dates
}

export function barsFromChart(payload, fallbackTimeZone, { expectedDate = null, now = new Date() } = {}) {
  const result = payload?.chart?.result?.[0]
  if (!result) {
    return { error: payload?.chart?.error?.description || 'empty chart', bars: [], events: {}, timeZone: fallbackTimeZone }
  }
  const timeZone = result.meta?.exchangeTimezoneName || fallbackTimeZone
  const quote = result.indicators?.quote?.[0] || {}
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : []
  const bars = []
  for (let i = 0; i < timestamps.length; i += 1) {
    const date = sessionDateFromUnix(timestamps[i], timeZone)
    if (!date) continue
    const bar = {
      date,
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close: quote.close?.[i] ?? null,
      volume: quote.volume?.[i] ?? null,
    }
    const evidence = verifiedRegularSessionClose(result.meta, bar, timestamps[i], expectedDate, now)
    if (evidence) {
      bar.close = evidence.regular_market_price
      bar.close_evidence = evidence
    }
    bars.push(bar)
  }
  return { error: null, bars, events: result.events || {}, timeZone }
}

// Yahoo can omit the newest daily close while reporting the completed regular
// session quote separately. Never use an intraday or extended-hours quote.
export function verifiedRegularSessionClose(meta, bar, timestamp, expectedDate, now) {
  if (bar.close != null || !expectedDate || bar.date !== expectedDate) return null
  if (!['EQUITY', 'ETF'].includes(meta?.instrumentType) || meta.exchangeTimezoneName !== 'America/New_York') return null
  const regular = meta.currentTradingPeriod?.regular
  const end = Number(regular?.end)
  if (!Number.isFinite(end) || Number(regular?.start) !== Number(timestamp)) return null
  const reportOffset = Number(meta.regularMarketTime) - end
  // Closing-auction prints can be reported seconds after 16:00. The field is
  // explicitly the regular-session quote; post/fullday fields are never read.
  if (!Number.isFinite(reportOffset) || reportOffset < 0 || reportOffset > 60 || new Date(now).getTime() < (end + 1800) * 1000) return null
  if (sessionDateFromUnix(end, meta.exchangeTimezoneName) !== expectedDate) return null
  const localEnd = new Intl.DateTimeFormat('en-GB', { timeZone: meta.exchangeTimezoneName, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(end * 1000))
  if (localEnd !== '16:00:00') return null
  const close = positive(meta.regularMarketPrice)
  const open = positive(bar.open), high = positive(bar.high), low = positive(bar.low)
  if (close == null || open == null || high == null || low == null || !ohlcIsConsistent(open, high, low, close)) return null
  if (!(Number(bar.volume) > 0) || Number(meta.regularMarketVolume) !== Number(bar.volume)) return null
  const tolerance = 10 ** -(Number.isFinite(Number(meta.priceHint)) ? Number(meta.priceHint) : 2)
  if (!(Number(meta.regularMarketDayHigh) > 0) || !(Number(meta.regularMarketDayLow) > 0)) return null
  if (Math.abs(Number(meta.regularMarketDayHigh) - high) > tolerance || Math.abs(Number(meta.regularMarketDayLow) - low) > tolerance) return null
  return {
    kind: 'yahoo_regular_session_quote_at_close',
    trade_date: expectedDate,
    time_zone: meta.exchangeTimezoneName,
    regular_market_time: Number(meta.regularMarketTime),
    regular_session_end: end,
    closing_auction_report_offset_seconds: reportOffset,
    regular_market_price: close,
    original_daily_close: null,
    regular_volume_matches_daily_bar: true,
    verified_at: new Date(now).toISOString(),
    extended_hours_price_used: false,
  }
}

export const YAHOO_LIMIT_STATUSES = [429, 401, 403]
export const YAHOO_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const YAHOO_MIN_GAP_MS = 2000
export const YAHOO_FETCH_CONCURRENCY = 1

export function yahooAccessLimited(status) {
  return YAHOO_LIMIT_STATUSES.includes(Number(status))
}

export function yahooSourceOutage(status) {
  const code = Number(status)
  return Number.isFinite(code) && code >= 500 && code <= 599
}

/** 404 is one symbol. 5xx, 429, 401, 403, and a thrown network or timeout stop the rest of the run. */
export function yahooResponseHalt(status, error, now = new Date()) {
  const code = Number(status)
  if (code === 404) return null
  if (code === 401 || code === 403 || code === 429 || yahooSourceOutage(code)) return yahooLimitRecord(code, now)
  if (error) return yahooLimitRecord('source_outage', now)
  return null
}

export function yahooLimitRecord(status, now = new Date()) {
  const code = Number(status)
  const known = Number.isFinite(code)
  const at = now instanceof Date ? now : new Date(now)
  const manual = code === 401 || code === 403
  return {
    yahoo_access_limited: true,
    yahoo_limit_status: known ? code : 'source_outage',
    yahoo_limited_at: at.toISOString(),
    yahoo_cooldown_until: manual ? null : new Date(at.getTime() + YAHOO_COOLDOWN_MS).toISOString(),
    yahoo_manual_review_required: manual,
    yahoo_retry: manual ? 'blocked_until_manual_review' : 'blocked_for_24h',
  }
}

export function yahooCooldownActive(jobs, now = Date.now()) {
  let until = null
  let manual = false
  for (const job of jobs || []) {
    const meta = job?.meta
    if (!meta) continue
    const code = Number(meta.yahoo_limit_status)
    if (meta.yahoo_manual_review_required || code === 401 || code === 403) manual = true
    if (!meta.yahoo_access_limited && !manual) continue
    const end = Date.parse(meta.yahoo_cooldown_until || '')
    if (Number.isFinite(end) && end > now && (until == null || end > until)) until = end
  }
  if (manual) return { active: true, until: null, manual: true }
  return until == null ? { active: false, until: null, manual: false } : { active: true, until: new Date(until).toISOString(), manual: false }
}

/** Same-run repeats are off. A missing bar or a source error waits for a later scheduled run, after any cooldown. */
export function shouldRetryYahoo() {
  return false
}

/** One new Yahoo request at a time. The next start waits at least gapMs. A tripped breaker performs no further fetch. */
export async function mapUntilYahooLimit(items, _concurrency, worker, { gapMs = YAHOO_MIN_GAP_MS, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = () => Date.now(), deadline = Infinity } = {}) {
  const breaker = { tripped: null }
  const out = []
  let lastStart = null
  for (const item of items || []) {
    if (breaker.tripped || now() > deadline) {
      out.push(await worker(item, breaker))
      continue
    }
    if (lastStart != null) {
      const wait = gapMs - (now() - lastStart)
      if (wait > 0) await sleep(wait)
    }
    if (breaker.tripped || now() > deadline) {
      out.push(await worker(item, breaker))
      continue
    }
    lastStart = now()
    out.push(await worker(item, breaker))
  }
  return { rows: out, breaker }
}

export function assessUnadjustedBar({ bars, events, timeZone, expectedDate, expectedPreviousDate, requireOhlc }) {
  const series = (bars || []).filter((bar) => bar.date && bar.date <= expectedDate)
  const bar = series.find((item) => item.date === expectedDate)
  const latest = series.length ? series[series.length - 1].date : null
  if (!bar) {
    return {
      status: 'pending_yahoo',
      trade_date: null,
      expected_trade_date: expectedDate,
      latest_available_date: latest,
      expected_previous_date: expectedPreviousDate || null,
      price_basis: PRICE_BASIS,
      note: '예상 거래일 데이터 미도착. 날짜를 바꾸지 않습니다.',
    }
  }
  if (eventDates(events, timeZone).has(expectedDate)) {
    return {
      status: 'corporate_action_isolated',
      trade_date: null,
      expected_trade_date: expectedDate,
      expected_previous_date: expectedPreviousDate || null,
      price_basis: PRICE_BASIS,
      note: '배당 또는 분할이 같은 세션에 있습니다. 종가를 섞지 않고 보류합니다.',
    }
  }
  const close = positive(bar.close)
  if (close == null) {
    return {
      status: 'invalid_price',
      trade_date: null,
      expected_trade_date: expectedDate,
      expected_previous_date: expectedPreviousDate || null,
      price_basis: PRICE_BASIS,
      note: '종가가 없습니다.',
    }
  }
  const open = positive(bar.open)
  const high = positive(bar.high)
  const low = positive(bar.low)
  const rangeOk = open != null && high != null && low != null && ohlcIsConsistent(open, high, low, close)
  if (requireOhlc && !rangeOk) {
    return {
      status: 'invalid_price',
      trade_date: null,
      expected_trade_date: expectedDate,
      expected_previous_date: expectedPreviousDate || null,
      price_basis: PRICE_BASIS,
      note: 'OHLC가 없거나 범위가 맞지 않습니다.',
    }
  }
  const prior = expectedPreviousDate
    ? series.find((item) => item.date === expectedPreviousDate && positive(item.close) != null)
    : null
  if (!prior) {
    return {
      status: 'previous_session_mismatch',
      trade_date: null,
      expected_trade_date: expectedDate,
      expected_previous_date: expectedPreviousDate || null,
      previous_trade_date: null,
      previous_close: null,
      close,
      open: rangeOk ? open : null,
      high: rangeOk ? high : null,
      low: rangeOk ? low : null,
      ohlc_ok: rangeOk,
      change_pct: null,
      price_basis: PRICE_BASIS,
      note: '직전 실제 세션이 아닙니다. 더 오래된 봉으로 등락률을 계산하지 않습니다.',
    }
  }
  const previousClose = positive(prior.close)
  const changePct = (close / previousClose - 1) * 100
  return {
    status: 'ok',
    trade_date: expectedDate,
    expected_trade_date: expectedDate,
    expected_previous_date: expectedPreviousDate,
    previous_trade_date: expectedPreviousDate,
    previous_close: previousClose,
    close,
    open: rangeOk ? open : null,
    high: rangeOk ? high : null,
    low: rangeOk ? low : null,
    ohlc_ok: rangeOk,
    volume: rangeOk && Number.isFinite(Number(bar.volume)) && Number(bar.volume) > 0
      ? Math.round(Number(bar.volume))
      : null,
    change_pct: changePct,
    price_basis: PRICE_BASIS,
    close_evidence: bar.close_evidence || null,
    note: '',
  }
}

export function sameBasisClose(storedClose, yahooClose) {
  const stored = Number(storedClose)
  const yahoo = Number(yahooClose)
  if (!(stored > 0) || !(yahoo > 0)) return false
  return Math.abs(stored - yahoo) / yahoo <= BASIS_TOLERANCE
}

export async function fetchYahooChart(symbol, { timeoutMs = 8000 } = {}) {
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - 45 * 24 * 60 * 60
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div%7Csplit&includeAdjustedClose=false`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: controller.signal })
    if (!response.ok) return { ok: false, status: response.status, payload: null }
    return { ok: true, status: response.status, payload: await response.json() }
  } finally {
    clearTimeout(timer)
  }
}
