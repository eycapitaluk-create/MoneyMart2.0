import { createClient } from '@supabase/supabase-js'

const DEFAULT_MARKETSTACK_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'TSLA', 'AVGO', 'AMD',
  'ORCL', 'NFLX', 'CRM', 'ADBE', 'INTC', 'QCOM', 'TXN', 'MU', 'CSCO', 'IBM',
  'PLTR', 'JPM', 'GS', 'MS', 'BAC', 'WFC', 'C', 'BLK', 'V', 'MA',
  'AXP', 'PYPL', 'SCHW', 'USB', 'PNC', 'COF', 'BK', 'SPGI', 'ICE', 'JNJ',
  'PFE', 'MRK', 'UNH', 'ABBV', 'LLY', 'TMO', 'ABT', 'DHR', 'ISRG', 'BMY',
  'GILD', 'AMGN', 'VRTX', 'CVS', 'MDT', 'SYK', 'ZTS', 'REGN', 'CI', 'XOM',
  'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OKE', 'KMI', 'WMB',
  'DVN', 'FANG', 'HAL', 'BKR', 'CAT', 'GE', 'DE', 'HON', 'ETN', 'MMM',
  'LMT', 'RTX', 'NOC', 'BA', 'UNP', 'UPS', 'FDX', 'WM', 'EMR', 'ITW',
  'PH', 'ROK', 'GD', 'CSX', 'WMT', 'COST', 'HD', 'MCD', 'KO', 'PEP',
  'UBER', 'ABNB', 'SHOP', 'SQ', 'COIN', 'SNOW', 'PANW', 'CRWD', 'NOW', 'ANET',
  'MRVL', 'SMCI', 'KKR', 'BX', 'APO', 'CG', 'MSTR', 'ARM', 'RBLX', 'DDOG',
  'ASML', 'NVO', 'SAP', 'SHEL', 'HSBC', 'UL', 'BP', 'RIO', 'BCS', 'AZN',
]

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

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const getJson = async (url, init) => {
  const res = await fetch(url, init)
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
  const chunks = chunk(symbols, 20)
  const allRows = []
  const endpointStats = {}

  for (const symbolsChunk of chunks) {
    const result = await fetchChunkRows(marketstackKey, symbolsChunk)
    allRows.push(...result.rows)
    endpointStats[result.endpoint] = (endpointStats[result.endpoint] || 0) + 1
  }

  return { rows: allRows, endpointStats, chunks: chunks.length }
}

const fetchChunkRows = async (marketstackKey, symbols) => {
  const encodedKey = encodeURIComponent(marketstackKey)
  const encodedSymbols = encodeURIComponent(symbols.join(','))

  const tryFetch = async ({ version, authMode }) => {
    const useHeaderAuth = authMode === 'header'
    const authQuery = useHeaderAuth ? '' : `access_key=${encodedKey}&`
    const init = useHeaderAuth ? { headers: { apikey: marketstackKey } } : undefined

    // 1) Try latest endpoint first
    const latestUrl = `https://api.marketstack.com/${version}/eod/latest?${authQuery}symbols=${encodedSymbols}`
    const latestJson = await getJson(latestUrl, init)
    const latestRows = Array.isArray(latestJson?.data) ? latestJson.data : []
    if (latestRows.length > 0) {
      return { rows: latestRows, endpoint: `${version}:latest:${authMode}` }
    }

    // 2) Fallback: standard EOD endpoint
    const eodUrl = `https://api.marketstack.com/${version}/eod?${authQuery}symbols=${encodedSymbols}&limit=100&sort=DESC`
    const eodJson = await getJson(eodUrl, init)
    const eodRows = Array.isArray(eodJson?.data) ? eodJson.data : []
    if (eodRows.length > 0) {
      return { rows: eodRows, endpoint: `${version}:eod:${authMode}` }
    }

    return { rows: [], endpoint: `${version}:none:${authMode}` }
  }

  const attempts = [
    { version: 'v1', authMode: 'query' },
    { version: 'v1', authMode: 'header' },
    { version: 'v2', authMode: 'query' },
    { version: 'v2', authMode: 'header' },
  ]
  const errors = []

  for (const attempt of attempts) {
    try {
      return await tryFetch(attempt)
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase()
      errors.push(`${attempt.version}/${attempt.authMode}: ${e.message}`)
      if (msg.includes('not available in the v1 endpoint')) continue
      if (msg.includes('access key') || msg.includes('apikey') || msg.includes('invalid')) continue
    }
  }

  throw new Error(`Marketstack fetch failed: ${errors.join(' | ')}`)
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET is required' })
  }
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== cronSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const marketstackKey =
    process.env.MARKETSTACK_ACCESS_KEY ||
    process.env.MARKETSTACK_APIKEY ||
    process.env.MARKETSTACK_API_KEY ||
    process.env.VITE_MARKETSTACK_ACCESS_KEY
  const configuredSymbols = parseSymbols(process.env.MARKETSTACK_SYMBOLS)
  const symbols =
    configuredSymbols.length > 0 ? configuredSymbols : DEFAULT_MARKETSTACK_SYMBOLS

  if (!supabaseUrl || !serviceRoleKey || !marketstackKey) {
    return res.status(500).json({
      ok: false,
      error:
        'Missing env. Required: SUPABASE_URL, SUPABASE_SECRET_KEY(or SUPABASE_SERVICE_ROLE_KEY), MARKETSTACK_ACCESS_KEY',
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

    const { rows, endpointStats, chunks } = await fetchMarketstackRows(marketstackKey, symbols)
    if (rows.length === 0) {
      throw new Error(
        'No rows returned from marketstack. Check MARKETSTACK_SYMBOLS and your plan coverage.'
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
          meta: { symbols, chunks, endpointStats },
        })
        .eq('id', jobId)
    }

    return res.status(200).json({
      ok: true,
      symbols: symbols.length,
      chunks,
      rows_processed: priceRows.length,
      endpoint_stats: endpointStats,
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

