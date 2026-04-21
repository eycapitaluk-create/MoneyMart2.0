/**
 * Historical FX rates (USD/JPY) by date.
 * Provider strategy:
 * 1) Frankfurter (ECB-based, no key)
 * 2) Twelve Data (if FX_TWELVEDATA_API_KEY is set)
 * 3) Static fallback rate via FX_FALLBACK_USDJPY
 */

const FRANKFURTER = 'https://api.frankfurter.dev'
const TWELVEDATA = 'https://api.twelvedata.com'
const DEFAULT_FALLBACK_USDJPY = 150
const FX_FALLBACK_USDJPY = Number(process.env.FX_FALLBACK_USDJPY || DEFAULT_FALLBACK_USDJPY)
const FX_TWELVEDATA_API_KEY = process.env.FX_TWELVEDATA_API_KEY || ''

function toIsoDate(str) {
  if (!str) return ''
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayRange(startIso, endIso) {
  const out = []
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function fillMissingDates(ratesByDate, startIso, endIso) {
  const full = {}
  let last = null
  for (const d of dayRange(startIso, endIso)) {
    const v = Number(ratesByDate[d])
    if (Number.isFinite(v) && v > 0) {
      last = v
      full[d] = v
    } else if (last != null) {
      // Carry forward previous available business-day rate.
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

async function fetchFrankfurterByDate(date) {
  const url = `${FRANKFURTER}/v1/${date}?from=USD&to=JPY`
  const data = await fetchJson(url)
  const usdJpy = data?.rates?.JPY != null ? Number(data.rates.JPY) : NaN
  return Number.isFinite(usdJpy) && usdJpy > 0 ? usdJpy : null
}

async function fetchFrankfurterRange(start, end) {
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

async function fetchTwelveDataByDate(date) {
  if (!FX_TWELVEDATA_API_KEY) return null
  // end_date with outputsize=1 returns latest available daily close on/before date.
  const url = `${TWELVEDATA}/time_series?symbol=USD/JPY&interval=1day&end_date=${date}&outputsize=1&apikey=${encodeURIComponent(FX_TWELVEDATA_API_KEY)}`
  const data = await fetchJson(url)
  const row = Array.isArray(data?.values) ? data.values[0] : null
  const close = row?.close != null ? Number(row.close) : NaN
  return Number.isFinite(close) && close > 0 ? close : null
}

async function fetchTwelveDataRange(start, end) {
  if (!FX_TWELVEDATA_API_KEY) return null
  const url = `${TWELVEDATA}/time_series?symbol=USD/JPY&interval=1day&start_date=${start}&end_date=${end}&outputsize=5000&apikey=${encodeURIComponent(FX_TWELVEDATA_API_KEY)}`
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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const date = toIsoDate(req.query.date)
  const start = toIsoDate(req.query.start_date || req.query.start)
  const end = toIsoDate(req.query.end_date || req.query.end)

  try {
    if (date) {
      const fromFrankfurter = await fetchFrankfurterByDate(date)
      if (fromFrankfurter != null) {
        return res.status(200).json({ date, rates: { USD: fromFrankfurter }, source: 'frankfurter' })
      }

      const fromTwelveData = await fetchTwelveDataByDate(date)
      if (fromTwelveData != null) {
        return res.status(200).json({ date, rates: { USD: fromTwelveData }, source: 'twelvedata' })
      }

      return res.status(200).json({ date, rates: { USD: FX_FALLBACK_USDJPY }, source: 'fallback' })
    }

    if (start && end) {
      let ratesByDate = await fetchFrankfurterRange(start, end)
      let source = 'frankfurter'
      if (!ratesByDate || Object.keys(ratesByDate).length === 0) {
        ratesByDate = await fetchTwelveDataRange(start, end)
        source = 'twelvedata'
      }

      if (!ratesByDate || Object.keys(ratesByDate).length === 0) {
        return res.status(200).json({ ratesByDate: {}, source: 'fallback' })
      }

      const filled = fillMissingDates(ratesByDate, start, end)
      const withFallback = {}
      for (const d of dayRange(start, end)) {
        withFallback[d] = Number(filled[d] || FX_FALLBACK_USDJPY)
      }
      return res.status(200).json({ ratesByDate: withFallback, source })
    }

    return res.status(400).json({ error: 'Provide date or start_date & end_date' })
  } catch (e) {
    console.error('fx api error', e)
    return res.status(500).json({ error: 'FX fetch failed' })
  }
}
