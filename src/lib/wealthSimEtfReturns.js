import { supabase } from './supabase'

/** DB の銘柄コード（HomePage / ETFリストと同じ連動型代表） */
export const WEALTH_SIM_ETF_SYMBOL = {
  topix: '1306.T',
  nikkei: '1321.T',
}

/** trade_date の YYYY-MM-DD を暦として n か月前の日付（TZずれなし）。 */
function calendarMonthsBeforeYmd(ymdStr, monthsBack) {
  const s = String(ymdStr).slice(0, 10)
  const parts = s.split('-').map((p) => parseInt(p, 10))
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return null
  const [y, m, d] = parts
  const dt = new Date(Date.UTC(y, m - 1 - monthsBack, d))
  const yy = dt.getUTCFullYear()
  const mm = dt.getUTCMonth() + 1
  const dd = dt.getUTCDate()
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

function calendarDaysBetweenYmd(latestYmd, pastYmd) {
  const a = Date.parse(`${latestYmd.slice(0, 10)}T12:00:00Z`)
  const b = Date.parse(`${pastYmd.slice(0, 10)}T12:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN
  return Math.round((a - b) / 86400000)
}

/**
 * 約3か月リターンとしてあり得ない広い指数連動ETFの想定外振れ幅（分割未調整・欠損列の切り捨て疑い）。
 */
const MAX_ABS_THREE_MONTH_PCT_BROAD_ETF = 55

/**
 * latest と past の暦日差がこの範囲外なら、欠損により「3か月前」以外の基準日になったとみなす。
 */
const MIN_SPAN_DAYS_3M_WINDOW = 45
const MAX_SPAN_DAYS_3M_WINDOW = 135

/**
 * 代表ETFの「最新終値の日付」基準で約3か月前以前の直近営業日終値との対比リターン（%）。
 * 指数そのものではなく当該上場投信の実データ。欠損時は ok: false。
 */
export async function fetchEtfThreeMonthReturnPct(proxyKey) {
  const symbol = WEALTH_SIM_ETF_SYMBOL[proxyKey] || WEALTH_SIM_ETF_SYMBOL.topix
  const { data: latestRow, error: e1 } = await supabase
    .from('stock_daily_prices')
    .select('trade_date,close')
    .eq('symbol', symbol)
    .order('trade_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (e1 || !latestRow?.trade_date) {
    return { ok: false, error: e1?.message || 'latest_missing', symbol }
  }

  const latestClose = Number(latestRow.close || 0)
  if (!Number.isFinite(latestClose) || latestClose <= 0) {
    return { ok: false, error: 'invalid_latest_close', symbol }
  }

  const latestYmd = String(latestRow.trade_date).slice(0, 10)
  const anchorStr = calendarMonthsBeforeYmd(latestYmd, 3)
  if (!anchorStr) {
    return { ok: false, error: 'invalid_latest_date', symbol }
  }

  const { data: pastRow, error: e2 } = await supabase
    .from('stock_daily_prices')
    .select('trade_date,close')
    .eq('symbol', symbol)
    .lte('trade_date', anchorStr)
    .order('trade_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (e2 || !pastRow?.trade_date) {
    return { ok: false, error: e2?.message || 'past_missing', symbol }
  }

  const pastYmd = String(pastRow.trade_date).slice(0, 10)
  const spanDays = calendarDaysBetweenYmd(latestYmd, pastYmd)
  if (
    !Number.isFinite(spanDays)
    || spanDays < MIN_SPAN_DAYS_3M_WINDOW
    || spanDays > MAX_SPAN_DAYS_3M_WINDOW
  ) {
    return { ok: false, error: 'history_span_mismatch', symbol }
  }

  const pastClose = Number(pastRow.close || 0)
  if (!Number.isFinite(pastClose) || pastClose <= 0) {
    return { ok: false, error: 'invalid_past_close', symbol }
  }

  const pct = ((latestClose / pastClose) - 1) * 100
  if (!Number.isFinite(pct) || Math.abs(pct) > MAX_ABS_THREE_MONTH_PCT_BROAD_ETF) {
    return { ok: false, error: 'implausible_return', symbol }
  }

  return {
    ok: true,
    pct,
    symbol,
    latestDate: latestYmd,
    pastDate: pastYmd,
  }
}

/**
 * 3か月トータルリターン R（%）を「同じトータルリターンが四半期ごとに続く」と仮定した参考年率へ換算:
 * (1 + R/100)^4 - 1 を % で返す（複利）。単純な R×4 年換算は行わない。極端値はクリップ。
 */
export function annualizeThreeMonthReturnPct(threeMonthPct) {
  const d = Number(threeMonthPct)
  if (!Number.isFinite(d)) return null
  const dec = d / 100
  if (dec <= -0.999) return -80
  try {
    const annual = (Math.pow(1 + dec, 4) - 1) * 100
    if (!Number.isFinite(annual)) return null
    return Math.max(-80, Math.min(80, annual))
  } catch {
    return null
  }
}
