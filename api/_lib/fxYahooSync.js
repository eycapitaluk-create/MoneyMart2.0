import { dayRange } from './fx-usdjpy-providers.js'

export const YAHOO_FX_PROVIDER = 'yahoo'

export function fxChangePct(close, previousClose) {
  const current = Number(close)
  const previous = Number(previousClose)
  if (!(current > 0) || !(previous > 0)) return null
  return (current / previous - 1) * 100
}

/** Day change uses only the same Yahoo session pair. A missing pair is not zero and not a new date. */
export function planFxPublication({ assessment }) {
  if (!assessment?.trade_date || assessment.status !== 'ok') {
    return { action: 'hold', reason: assessment?.status || 'pending_yahoo' }
  }
  if (assessment.expected_trade_date && assessment.trade_date !== assessment.expected_trade_date) {
    return { action: 'hold', reason: 'date_mismatch' }
  }
  if (!assessment.expected_previous_date || assessment.previous_trade_date !== assessment.expected_previous_date) {
    return { action: 'hold', reason: 'previous_session_mismatch' }
  }
  const changePct = fxChangePct(assessment.close, assessment.previous_close)
  if (changePct == null) return { action: 'hold', reason: 'missing_previous_close' }
  return {
    action: 'publish',
    tradeDate: assessment.trade_date,
    previousDate: assessment.expected_previous_date,
    close: Number(assessment.close),
    previousClose: Number(assessment.previous_close),
    changePct,
  }
}

function exactFxClose(stored, next) {
  const left = Number(stored)
  const right = Number(next)
  return Number.isFinite(left) && Number.isFinite(right) && left > 0 && right > 0 && left === right
}

/** Exact same-source close only. A 0.2% price band is not a match for FX. */
export function previousFxAlign(storedPrevious, previousDate, previousClose) {
  if (!previousDate || !(Number(previousClose) > 0)) return { action: 'skip', reason: 'missing_previous_close' }
  const storedDate = String(storedPrevious?.trade_date || storedPrevious?.as_of_date || '').slice(0, 10)
  if (!storedPrevious) {
    return { action: 'insert', tradeDate: previousDate, value: Number(previousClose), changePct: null, provider: YAHOO_FX_PROVIDER }
  }
  if (storedDate !== previousDate) return { action: 'skip', reason: 'previous_date_mismatch' }
  const stored = storedPrevious.value ?? storedPrevious.usd_jpy
  const provider = storedPrevious.provider ?? null
  const providerMatches = provider == null || provider === YAHOO_FX_PROVIDER
  if (exactFxClose(stored, previousClose) && providerMatches) return { action: 'keep' }
  return { action: 'replace', tradeDate: previousDate, value: Number(previousClose), changePct: null, provider: YAHOO_FX_PROVIDER }
}

export function planUsdJpyWrites({ plan, dashboardPrevious, fxCurrent, fxPrevious }) {
  const dashboardAlign = previousFxAlign(
    dashboardPrevious
      ? { trade_date: dashboardPrevious.trade_date, value: dashboardPrevious.value, provider: dashboardPrevious.provider ?? null, change_pct: dashboardPrevious.change_pct ?? null }
      : null,
    plan.previousDate,
    plan.previousClose,
  )
  const fxCurrentAlign = previousFxAlign(
    fxCurrent
      ? { trade_date: String(fxCurrent.as_of_date).slice(0, 10), usd_jpy: fxCurrent.usd_jpy, provider: fxCurrent.provider ?? null }
      : null,
    plan.tradeDate,
    plan.close,
  )
  const fxPreviousAlign = previousFxAlign(
    fxPrevious
      ? { trade_date: String(fxPrevious.as_of_date).slice(0, 10), usd_jpy: fxPrevious.usd_jpy, provider: fxPrevious.provider ?? null }
      : null,
    plan.previousDate,
    plan.previousClose,
  )
  const fxRows = []
  if (fxCurrentAlign.action !== 'keep') {
    fxRows.push({ as_of_date: plan.tradeDate, usd_jpy: plan.close, provider: YAHOO_FX_PROVIDER })
  }
  if (fxPreviousAlign.action === 'insert' || fxPreviousAlign.action === 'replace') {
    fxRows.push({ as_of_date: plan.previousDate, usd_jpy: plan.previousClose, provider: YAHOO_FX_PROVIDER })
  }
  const dashboardPreviousRow = dashboardAlign.action === 'insert' || dashboardAlign.action === 'replace'
    ? { trade_date: plan.previousDate, value: plan.previousClose, change_pct: null }
    : null
  return { dashboardAlign, fxCurrentAlign, fxPreviousAlign, fxRows, dashboardPreviousRow }
}

export function fxRestorePayload(backupRows, writtenDates) {
  const byDate = new Map((backupRows || []).map((row) => [String(row.as_of_date).slice(0, 10), row]))
  const restore = []
  const remove = []
  for (const date of writtenDates || []) {
    const prior = byDate.get(date)
    if (prior) restore.push(prior)
    else remove.push(date)
  }
  return { restore, remove }
}

/** Write the FX table first, then the dashboard. Restore the FX table if the dashboard write fails. */
export async function commitFxPair({ fxRows, dashboardRows, fxBackup, writeFx, deleteFx, writeDashboard }) {
  const writtenDates = (fxRows || []).map((row) => String(row.as_of_date).slice(0, 10))
  let fxWritten = false
  try {
    if (writtenDates.length) {
      await writeFx(fxRows)
      fxWritten = true
    }
    if ((dashboardRows || []).length) await writeDashboard(dashboardRows)
    return { ok: true, compensated: false }
  } catch (error) {
    if (!fxWritten) return { ok: false, compensated: false, error }
    const payload = fxRestorePayload(fxBackup, writtenDates)
    try {
      if (payload.restore.length) await writeFx(payload.restore)
      if (payload.remove.length) await deleteFx(payload.remove)
      return { ok: false, compensated: true, error, restored: payload }
    } catch (restoreError) {
      return { ok: false, compensated: false, error, restoreError }
    }
  }
}

function fxPoint(row) {
  const date = String(row?.as_of_date || row?.asOf || '').slice(0, 10)
  const value = Number(row?.usd_jpy ?? row?.rate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(value > 0)) return null
  return { date, value, provider: row?.provider || null, asOf: date }
}

export function dbFxSeriesResponse(rows, start, end, priorRow = null) {
  const byDate = new Map()
  for (const row of rows || []) {
    const point = fxPoint(row)
    if (point) byDate.set(point.date, point)
  }
  const ratesByDate = {}
  const asOfByDate = {}
  const providersByDate = {}
  const missingDates = []
  for (const date of dayRange(start, end)) {
    const row = byDate.get(date)
    if (!row) {
      missingDates.push(date)
      continue
    }
    ratesByDate[date] = row.value
    asOfByDate[date] = row.asOf
    providersByDate[date] = row.provider
  }
  if (missingDates.includes(start)) {
    const prior = fxPoint(priorRow)
    if (prior && prior.date < start) {
      ratesByDate[prior.date] = prior.value
      asOfByDate[prior.date] = prior.asOf
      providersByDate[prior.date] = prior.provider
    }
  }
  return { ratesByDate, asOfByDate, providersByDate, missingDates, source: 'database' }
}

export function singleUsdJpyResponse(requestedDate, row) {
  const point = fxPoint(row)
  if (!point || point.date > requestedDate) {
    return { date: requestedDate, rates: {}, source: 'unavailable' }
  }
  return {
    date: requestedDate,
    fxAsOf: point.asOf,
    rates: { USD: point.value },
    provider: point.provider,
    source: 'database',
  }
}

const FX_DB_ERROR = { error: 'FX database read failed' }

function queryResult(result) {
  if (result?.error) return { rows: [], error: result.error }
  const data = result?.data
  if (Array.isArray(data)) return { rows: data, error: null }
  if (data) return { rows: [data], error: null }
  return { rows: [], error: null }
}

/** Database only. Callers pass the table client; this function does not call another rate provider. */
export async function readFxDaily(admin, { date, start, end } = {}) {
  if (!admin) return { status: 500, body: FX_DB_ERROR }
  if (date) {
    const result = queryResult(await admin
      .from('fx_daily_usdjpy')
      .select('as_of_date,usd_jpy,provider')
      .lte('as_of_date', date)
      .order('as_of_date', { ascending: false })
      .limit(1))
    if (result.error) return { status: 500, body: FX_DB_ERROR }
    return { status: 200, body: singleUsdJpyResponse(date, result.rows[0] || null) }
  }
  if (start && end) {
    const ranged = queryResult(await admin
      .from('fx_daily_usdjpy')
      .select('as_of_date,usd_jpy,provider')
      .gte('as_of_date', start)
      .lte('as_of_date', end))
    if (ranged.error) return { status: 500, body: FX_DB_ERROR }
    const startCovered = ranged.rows.some((row) => String(row?.as_of_date || '').slice(0, 10) === start && Number(row?.usd_jpy) > 0)
    let prior = null
    if (!startCovered) {
      const before = queryResult(await admin
        .from('fx_daily_usdjpy')
        .select('as_of_date,usd_jpy,provider')
        .lt('as_of_date', start)
        .order('as_of_date', { ascending: false })
        .limit(1))
      if (before.error) return { status: 500, body: FX_DB_ERROR }
      prior = before.rows[0] || null
    }
    return { status: 200, body: dbFxSeriesResponse(ranged.rows, start, end, prior) }
  }
  return { status: 400, body: { error: 'Provide date or start_date & end_date' } }
}

function fxFieldChanged(snapshot, current, key) {
  const left = snapshot?.[key]
  const right = current?.[key]
  if (left == null && right == null) return false
  if (key === 'provider' || key === 'updated_at') return String(left ?? '') !== String(right ?? '')
  if (left == null || right == null) return true
  return Number(left) !== Number(right)
}

export function fxConcurrentChange(snapshot, current) {
  if (!snapshot && !current) return false
  if (Boolean(snapshot) !== Boolean(current)) return true
  return ['updated_at', 'value', 'usd_jpy', 'provider', 'change_pct'].some((key) => fxFieldChanged(snapshot, current, key))
}

export function importerFxWrites({ tradeDate, fxValue, fxExisting, recentRows }) {
  const yahoo = fxExisting?.provider === YAHOO_FX_PROVIDER
  const date = String(tradeDate || '').slice(0, 10)
  return {
    writeUsdJpy: fxValue != null && !yahoo,
    recentRows: yahoo
      ? (recentRows || []).filter((row) => row.category !== 'fx' || String(row.trade_date).slice(0, 10) !== date)
      : (recentRows || []),
    reason: yahoo ? 'yahoo_fx_protected' : 'ok',
  }
}

export function frankfurterRowsSkippingYahoo(existingRows, incomingRows) {
  const yahooDates = new Set(
    (existingRows || [])
      .filter((row) => row?.provider === YAHOO_FX_PROVIDER)
      .map((row) => String(row.as_of_date).slice(0, 10)),
  )
  return (incomingRows || []).filter((row) => !yahooDates.has(String(row.as_of_date).slice(0, 10)))
}
