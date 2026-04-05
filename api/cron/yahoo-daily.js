import { createClient } from '@supabase/supabase-js'

// Yahoo Finance symbols
// US: AAPL, MSFT, etc.
// Japan: 7203.T, 6758.T, etc. (Yahoo Finance format)
const DEFAULT_SYMBOLS = [
  // US - Tech
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'TSLA', 'AVGO', 'AMD',
  'ORCL', 'NFLX', 'CRM', 'ADBE', 'INTC', 'QCOM', 'TXN', 'MU', 'CSCO', 'IBM',
  'PLTR', 'SNOW', 'PANW', 'CRWD', 'NOW', 'ANET', 'MRVL', 'SMCI', 'DDOG', 'RBLX',
  'UBER', 'ABNB', 'SHOP', 'SQ', 'COIN', 'ARM',
  // US - Finance
  'JPM', 'GS', 'MS', 'BAC', 'WFC', 'C', 'BLK', 'V', 'MA',
  'AXP', 'PYPL', 'SCHW', 'USB', 'PNC', 'COF', 'BK', 'SPGI', 'ICE',
  'KKR', 'BX', 'APO', 'CG', 'MSTR',
  // US - Health
  'JNJ', 'PFE', 'MRK', 'UNH', 'ABBV', 'LLY', 'TMO', 'ABT', 'DHR', 'ISRG',
  'BMY', 'GILD', 'AMGN', 'VRTX', 'CVS', 'MDT', 'SYK', 'ZTS', 'REGN', 'CI',
  // US - Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OKE', 'KMI',
  'DVN', 'HAL', 'BKR',
  // US - Industrial/Consumer
  'CAT', 'GE', 'DE', 'HON', 'ETN', 'MMM', 'LMT', 'RTX', 'NOC', 'BA',
  'UNP', 'UPS', 'FDX', 'WM', 'EMR', 'ITW', 'PH', 'ROK', 'GD', 'CSX',
  'WMT', 'COST', 'HD', 'MCD', 'KO', 'PEP',
  // Europe/Global (US-listed)
  'ASML', 'NVO', 'SAP', 'SHEL', 'HSBC', 'UL', 'BP', 'RIO', 'BCS', 'AZN',
  // Japan (Yahoo Finance: ticker.T)
  '7203.T', '6758.T', '8035.T', '9984.T', '6861.T',
  '7974.T', '4063.T', '8306.T', '6367.T', '9432.T',
]

const toDateOnly = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const parseSymbols = (raw) => {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Yahoo Finance v7 quote endpoint (batch, up to ~100 symbols)
const fetchYahooQuotes = async (symbols) => {
  const chunks = chunk(symbols, 50)
  const allRows = []

  for (const symbolsChunk of chunks) {
    const encodedSymbols = symbolsChunk.join('%2C')
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodedSymbols}&fields=symbol,shortName,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketPrice,regularMarketVolume,regularMarketTime,currency,fullExchangeName`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MoneyMart/2.0)',
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      console.error(`Yahoo Finance error: ${res.status} for chunk ${symbolsChunk.join(',')}`)
      continue
    }

    const json = await res.json()
    const quotes = json?.quoteResponse?.result ?? []
    allRows.push(...quotes)

    // Polite delay between chunks
    if (chunks.length > 1) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  return allRows
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET is required' })
  }
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== cronSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const configuredSymbols = parseSymbols(process.env.YAHOO_SYMBOLS || process.env.MARKETSTACK_SYMBOLS)
  const symbols = configuredSymbols.length > 0 ? configuredSymbols : DEFAULT_SYMBOLS

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      ok: false,
      error: 'Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  let jobId = null

  try {
    const { data: startedJob, error: startedErr } = await supabase
      .from('ingestion_jobs')
      .insert([{ source: 'yahoo', dataset: 'stock_daily_prices', status: 'started', meta: { symbols } }])
      .select('id')
      .single()
    if (!startedErr) jobId = startedJob?.id ?? null

    const quotes = await fetchYahooQuotes(symbols)
    if (quotes.length === 0) {
      throw new Error('No data returned from Yahoo Finance. Market may be closed or rate limited.')
    }

    const today = new Date().toISOString().slice(0, 10)

    const symbolRows = []
    const priceRows = []

    for (const q of quotes) {
      const symbol = q.symbol
      if (!symbol) continue

      // regularMarketTime is a Unix timestamp
      const tradeDate = q.regularMarketTime
        ? toDateOnly(new Date(q.regularMarketTime * 1000))
        : today

      symbolRows.push({
        symbol,
        name: q.shortName || q.longName || null,
        exchange: q.fullExchangeName || q.exchange || null,
        currency: q.currency || null,
        is_active: true,
      })

      priceRows.push({
        source: 'yahoo',
        symbol,
        trade_date: tradeDate,
        open: q.regularMarketOpen ?? null,
        high: q.regularMarketDayHigh ?? null,
        low: q.regularMarketDayLow ?? null,
        close: q.regularMarketPrice ?? null,
        volume: q.regularMarketVolume ?? null,
        raw: q,
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
          meta: { symbols, rows: priceRows.length },
        })
        .eq('id', jobId)
    }

    return res.status(200).json({
      ok: true,
      symbols_requested: symbols.length,
      rows_processed: priceRows.length,
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
