/**
 * USD/JPY 日次レート取得（Frankfurter → Twelve Data）— /api/fx と cron で共有。
 * Frankfurter: ECBベース・無鍵・営業日ごとの公式参照レート。
 * Twelve Data: 日足 close（設定時）。
 */

export const FRANKFURTER = 'https://api.frankfurter.dev'
export const TWELVEDATA = 'https://api.twelvedata.com'
export const DEFAULT_FALLBACK_USDJPY = 150

export function toIsoDate(str) {
  if (!str) return ''
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dayRange(startIso, endIso) {
  const out = []
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function fillMissingDates(ratesByDate, startIso, endIso, seedRate = null) {
  const full = {}
  const seed = Number(seedRate)
  let last = Number.isFinite(seed) && seed > 0 ? seed : null
  for (const d of dayRange(startIso, endIso)) {
    const v = Number(ratesByDate[d])
    if (Number.isFinite(v) && v > 0) {
      last = v
      full[d] = v
    } else if (last != null) {
      full[d] = last
    }
  }
  return full
}

async function fetchJson(url) {
  const resp = await fetch(url)
  if (!resp.ok) return null
  return resp.json()
}

export async function fetchFrankfurterByDate(date) {
  const url = `${FRANKFURTER}/v1/${date}?from=USD&to=JPY`
  const data = await fetchJson(url)
  const usdJpy = data?.rates?.JPY != null ? Number(data.rates.JPY) : NaN
  return Number.isFinite(usdJpy) && usdJpy > 0 ? usdJpy : null
}

export async function fetchFrankfurterRange(start, end) {
  const url = `${FRANKFURTER}/v1/${start}..${end}?from=USD&to=JPY`
  const data = await fetchJson(url)
  if (!data?.rates || typeof data.rates !== 'object') return null
  const raw = data.rates
  const out = {}
  for (const [d, r] of Object.entries(raw)) {
    const v = r?.JPY != null ? Number(r.JPY) : NaN
    if (Number.isFinite(v) && v > 0) out[d] = v
  }
  return out
}

export async function fetchTwelveDataByDate(date, apiKey) {
  if (!apiKey) return null
  const url = `${TWELVEDATA}/time_series?symbol=USD/JPY&interval=1day&end_date=${date}&outputsize=1&apikey=${encodeURIComponent(apiKey)}`
  const data = await fetchJson(url)
  const row = Array.isArray(data?.values) ? data.values[0] : null
  const close = row?.close != null ? Number(row.close) : NaN
  return Number.isFinite(close) && close > 0 ? close : null
}

export async function fetchTwelveDataRange(start, end, apiKey) {
  if (!apiKey) return null
  const url = `${TWELVEDATA}/time_series?symbol=USD/JPY&interval=1day&start_date=${start}&end_date=${end}&outputsize=5000&apikey=${encodeURIComponent(apiKey)}`
  const data = await fetchJson(url)
  const values = Array.isArray(data?.values) ? data.values : null
  if (!values) return null
  const out = {}
  for (const row of values) {
    const dt = String(row?.datetime || '').slice(0, 10)
    const close = row?.close != null ? Number(row.close) : NaN
    if (!dt) continue
    if (Number.isFinite(close) && close > 0) out[dt] = close
  }
  return out
}
