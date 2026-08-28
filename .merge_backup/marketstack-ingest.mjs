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

const parseSymbols = (raw) =>
  (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const toDateOnly = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const getJson = async (url, init) => {
  const res = await fetch(url, init)
  const json = await res.json()
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Request failed: ${res.status}`)
  }
  return json
}

const fetchRows = async (key, symbols) => {
  const chunks = chunk(symbols, 20)
  const allRows = []
  const endpointStats = {}

  for (const symbolsChunk of chunks) {
    const result = await fetchRowsForChunk(key, symbolsChunk)
    allRows.push(...result.rows)
    endpointStats[result.endpoint] = (endpointStats[result.endpoint] || 0) + 1
  }

  return { endpointStats, rows: allRows, chunks: chunks.length }
}

const fetchRowsForChunk = async (key, symbols) => {
  const encodedKey = encodeURIComponent(key)
  const encodedSymbols = encodeURIComponent(symbols.join(','))

  const tryFetch = async ({ version, authMode }) => {
    const useHeaderAuth = authMode === 'header'
    const authQuery = useHeaderAuth ? '' : `access_key=${encodedKey}&`
    const init = useHeaderAuth ? { headers: { apikey: key } } : undefined

    const latestUrl = `https://api.marketstack.com/${version}/eod/latest?${authQuery}symbols=${encodedSymbols}`
    const latest = await getJson(latestUrl, init)
    const latestRows = Array.isArray(latest?.data) ? latest.data : []
    if (latestRows.length > 0) return { endpoint: `${version}:latest:${authMode}`, rows: latestRows }

    const eodUrl = `https://api.marketstack.com/${version}/eod?${authQuery}symbols=${encodedSymbols}&limit=100&sort=DESC`
    const eod = await getJson(eodUrl, init)
    const eodRows = Array.isArray(eod?.data) ? eod.data : []
    if (eodRows.length > 0) return { endpoint: `${version}:eod:${authMode}`, rows: eodRows }
    return { endpoint: `${version}:none:${authMode}`, rows: [] }
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
      // If v1 is unavailable for account, continue to v2 attempts.
      if (msg.includes('not available in the v1 endpoint')) continue
      // If auth fails, continue trying the other auth mode and version.
      if (msg.includes('access key') || msg.includes('apikey') || msg.includes('invalid')) continue
      // Otherwise still continue; final combined error will include details.
    }
  }

  throw new Error(`Marketstack fetch failed: ${errors.join(' | ')}`)
}

const run = async () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const marketstackKey =
    process.env.MARKETSTACK_ACCESS_KEY ||
    process.env.MARKETSTACK_APIKEY ||
    process.env.MARKETSTACK_API_KEY ||
    process.env.VITE_MARKETSTACK_ACCESS_KEY
  const symbols = parseSymbols(process.env.MARKETSTACK_SYMBOLS || DEFAULT_MARKETSTACK_SYMBOLS.join(','))

  if (!supabaseUrl || !serviceRole || !marketstackKey) {
    throw new Error(
      'Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MARKETSTACK_ACCESS_KEY'
    )
  }
  if (symbols.length === 0) throw new Error('MARKETSTACK_SYMBOLS is empty')

  const supabase = createClient(supabaseUrl, serviceRole)

  const { data: job } = await supabase
    .from('ingestion_jobs')
    .insert([{ source: 'marketstack', dataset: 'stock_daily_prices', status: 'started', meta: { symbols } }])
    .select('id')
    .single()

  try {
    const { endpointStats, rows, chunks } = await fetchRows(marketstackKey, symbols)
    if (rows.length === 0) throw new Error('No rows returned from marketstack')

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
      const { error } = await supabase.from('stock_symbols').upsert(symbolRows, { onConflict: 'symbol' })
      if (error) throw error
    }
    if (priceRows.length > 0) {
      const { error } = await supabase
        .from('stock_daily_prices')
        .upsert(priceRows, { onConflict: 'source,symbol,trade_date' })
      if (error) throw error
    }

    await supabase
      .from('ingestion_jobs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        rows_processed: priceRows.length,
        meta: { symbols, chunks, endpointStats },
      })
      .eq('id', job?.id)

    console.log(`OK: chunks=${chunks}, rows=${priceRows.length}, endpointStats=${JSON.stringify(endpointStats)}`)
  } catch (e) {
    await supabase
      .from('ingestion_jobs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: e.message,
      })
      .eq('id', job?.id)
    throw e
  }
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})

