import { createClient } from '@supabase/supabase-js'

export const FX_PAIRS = [
  { symbol: 'USDJPY.FX', base: 'USD', quote: 'JPY', name: 'USD/JPY' },
  { symbol: 'EURJPY.FX', base: 'EUR', quote: 'JPY', name: 'EUR/JPY' },
  { symbol: 'GBPJPY.FX', base: 'GBP', quote: 'JPY', name: 'GBP/JPY' },
  { symbol: 'USDKRW.FX', base: 'USD', quote: 'KRW', name: 'USD/KRW' },
]

const toDateOnly = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

export const fetchFxSnapshot = async () => {
  const response = await fetch('https://open.er-api.com/v6/latest/USD')
  const json = await response.json()

  if (!response.ok || json?.result !== 'success') {
    throw new Error(json?.error || 'Failed to fetch FX snapshot')
  }

  const usdJpy = Number(json?.rates?.JPY)
  const usdKrw = Number(json?.rates?.KRW)
  const usdEur = Number(json?.rates?.EUR)
  const usdGbp = Number(json?.rates?.GBP)

  if (![usdJpy, usdKrw, usdEur, usdGbp].every(Number.isFinite)) {
    throw new Error('FX payload is missing required currencies')
  }

  const derived = {
    USDJPY: usdJpy,
    EURJPY: usdJpy / usdEur,
    GBPJPY: usdJpy / usdGbp,
    USDKRW: usdKrw,
  }

  return {
    tradeDate: toDateOnly(json?.time_last_update_utc),
    fetchedAt: new Date().toISOString(),
    raw: json,
    derived,
  }
}

export const buildFxRows = (snapshot) => {
  const rateByKey = {
    USDJPY: snapshot.derived.USDJPY,
    EURJPY: snapshot.derived.EURJPY,
    GBPJPY: snapshot.derived.GBPJPY,
    USDKRW: snapshot.derived.USDKRW,
  }

  const symbolRows = FX_PAIRS.map((pair) => ({
    symbol: pair.symbol,
    name: pair.name,
    exchange: 'FX',
    currency: pair.quote,
    is_active: true,
      asset_type: 'stock',
    country: 'GLOBAL',
    category: 'FX',
    subcategory: 'Daily Rate',
    benchmark: null,
    notes: `base=${pair.base}, quote=${pair.quote}`,
  }))

  const priceRows = FX_PAIRS.map((pair) => {
    const rateKey = `${pair.base}${pair.quote}`
    const close = Number(rateByKey[rateKey])

    return {
      source: 'fx_daily',
      symbol: pair.symbol,
      trade_date: snapshot.tradeDate,
      open: close,
      high: close,
      low: close,
      close,
      volume: null,
      raw: {
        provider: 'open.er-api.com',
        pair,
        derived_rate: close,
        fetched_at: snapshot.fetchedAt,
        source_base: 'USD',
      },
    }
  })

  return { symbolRows, priceRows }
}

export const ingestFxRates = async ({ supabaseUrl, serviceRoleKey }) => {
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  let jobId = null

  try {
    const { data: startedJob } = await supabase
      .from('ingestion_jobs')
      .insert([
        {
          source: 'fx_daily',
          dataset: 'stock_daily_prices',
          status: 'started',
          meta: { symbols: FX_PAIRS.map((pair) => pair.symbol) },
        },
      ])
      .select('id')
      .single()
    jobId = startedJob?.id ?? null

    const snapshot = await fetchFxSnapshot()
    const { symbolRows, priceRows } = buildFxRows(snapshot)

    const { error: symbolErr } = await supabase.from('stock_symbols').upsert(symbolRows, { onConflict: 'symbol' })
    if (symbolErr) throw symbolErr

    const { error: priceErr } = await supabase
      .from('stock_daily_prices')
      .upsert(priceRows, { onConflict: 'source,symbol,trade_date' })
    if (priceErr) throw priceErr

    if (jobId) {
      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          rows_processed: priceRows.length,
          meta: { symbols: FX_PAIRS.map((pair) => pair.symbol), trade_date: snapshot.tradeDate },
        })
        .eq('id', jobId)
    }

    return {
      ok: true,
      tradeDate: snapshot.tradeDate,
      rowsProcessed: priceRows.length,
      pairs: priceRows.map((row) => ({ symbol: row.symbol, close: row.close })),
    }
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
    throw error
  }
}
