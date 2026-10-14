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

export function barsFromChart(payload, fallbackTimeZone) {
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
    bars.push({
      date,
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close: quote.close?.[i] ?? null,
      volume: quote.volume?.[i] ?? null,
    })
  }
  return { error: null, bars, events: result.events || {}, timeZone }
}

export function shouldRetryYahoo(status) {
  return status === 'pending_yahoo' || status === 'invalid_price'
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
