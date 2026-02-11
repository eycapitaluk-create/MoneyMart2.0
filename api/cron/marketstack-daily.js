import { createClient } from '@supabase/supabase-js'

const toDateOnly = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const parseSymbols = (raw) => {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const getJson = async (url) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error?.message || `marketstack request failed: ${res.status}`)
  }
  if (json?.error) {
    throw new Error(json.error.message || 'marketstack returned error')
  }
  return json
}

const fetchMarketstackRows = async (marketstackKey, symbols) => {
  const encodedKey = encodeURIComponent(marketstackKey)
  const encodedSymbols = encodeURIComponent(symbols.join(','))

  // 1) Try latest endpoint first
  const latestUrl = `https://api.marketstack.com/v1/eod/latest?access_key=${encodedKey}&symbols=${encodedSymbols}`
  const latestJson = await getJson(latestUrl)
  const latestRows = Array.isArray(latestJson?.data) ? latestJson.data : []
  if (latestRows.length > 0) {
    return { rows: latestRows, endpoint: 'eod/latest' }
  }

  // 2) Fallback: standard EOD endpoint (often more stable on free plans)
  // limit=100 is enough for a small symbol set on monthly runs
  const eodUrl = `https://api.marketstack.com/v1/eod?access_key=${encodedKey}&symbols=${encodedSymbols}&limit=100&sort=DESC`
  const eodJson = await getJson(eodUrl)
  const eodRows = Array.isArray(eodJson?.data) ? eodJson.data : []
  if (eodRows.length > 0) {
    return { rows: eodRows, endpoint: 'eod' }
  }

  return { rows: [], endpoint: 'none' }
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (token !== cronSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const marketstackKey =
    process.env.MARKETSTACK_ACCESS_KEY || process.env.VITE_MARKETSTACK_ACCESS_KEY
  const symbols = parseSymbols(process.env.MARKETSTACK_SYMBOLS)

  if (!supabaseUrl || !serviceRoleKey || !marketstackKey) {
    return res.status(500).json({
      ok: false,
      error:
        'Missing env. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MARKETSTACK_ACCESS_KEY',
    })
  }
  if (symbols.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'MARKETSTACK_SYMBOLS is empty. Example: AAPL,MSFT,7203.XTKS',
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  let jobId = null

  try {
    const { data: startedJob, error: startedErr } = await supabase
      .from('ingestion_jobs')
      .insert([
        {
          source: 'marketstack',
          dataset: 'stock_daily_prices',
          status: 'started',
          meta: { symbols },
        },
      ])
      .select('id')
      .single()
    if (!startedErr) jobId = startedJob?.id ?? null

    const { rows, endpoint } = await fetchMarketstackRows(marketstackKey, symbols)
    if (rows.length === 0) {
      throw new Error(
        'No rows returned from marketstack. Check MARKETSTACK_SYMBOLS (e.g. AAPL,MSFT) and plan access.'
      )
    }

    const symbolRows = []
    const priceRows = []

    for (const r of rows) {
      const symbol = r?.symbol || r?.ticker
      const tradeDate = toDateOnly(r?.date)
      if (!symbol || !tradeDate) continue

      symbolRows.push({
        symbol,
        name: r?.name || null,
        exchange: r?.exchange || null,
        currency: r?.currency || null,
        is_active: true,
      })

      priceRows.push({
        source: 'marketstack',
        symbol,
        trade_date: tradeDate,
        open: r?.open ?? null,
        high: r?.high ?? null,
        low: r?.low ?? null,
        close: r?.close ?? null,
        volume: r?.volume ?? null,
        raw: r,
      })
    }

    if (symbolRows.length > 0) {
      const { error: symbolErr } = await supabase
        .from('stock_symbols')
        .upsert(symbolRows, { onConflict: 'symbol' })
      if (symbolErr) throw symbolErr
    }

    if (priceRows.length > 0) {
      const { error: priceErr } = await supabase
        .from('stock_daily_prices')
        .upsert(priceRows, { onConflict: 'source,symbol,trade_date' })
      if (priceErr) throw priceErr
    }

    if (jobId) {
      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          rows_processed: priceRows.length,
          meta: { symbols, endpoint },
        })
        .eq('id', jobId)
    }

    return res.status(200).json({
      ok: true,
      symbols: symbols.length,
      rows_processed: priceRows.length,
      endpoint_used: endpoint,
    })
  } catch (error) {
    if (jobId) {
      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: error.message,
        })
        .eq('id', jobId)
    }
    return res.status(500).json({ ok: false, error: error.message })
  }
}

