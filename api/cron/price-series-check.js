import { createClient } from '@supabase/supabase-js'
import { cleanPriceSeries, maxDailyMove } from '../_lib/price-series-cleaner.js'

const PAGE = 1000

const daysAgo = (n) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

async function loadRecentCloses(supabase, fromDate) {
  const rows = []
  for (let offset = 0; offset < 200000; offset += PAGE) {
    const { data, error } = await supabase
      .from('stock_daily_prices')
      .select('symbol,trade_date,close')
      .gte('trade_date', fromDate)
      .order('symbol', { ascending: true })
      .order('trade_date', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return res.status(500).json({ ok: false, error: 'CRON_SECRET is required' })
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== cronSecret) return res.status(401).json({ ok: false, error: 'Unauthorized cron request' })

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  )
  const fromDate = daysAgo(40)
  const rows = await loadRecentCloses(supabase, fromDate)
  const bySymbol = new Map()
  for (const row of rows) {
    const symbol = String(row.symbol || '').trim().toUpperCase()
    if (!symbol) continue
    if (!bySymbol.has(symbol)) bySymbol.set(symbol, [])
    bySymbol.get(symbol).push({
      date: String(row.trade_date).slice(0, 10),
      close: Number(row.close),
    })
  }

  const alerts = []
  for (const [symbol, points] of bySymbol) {
    const cleaned = cleanPriceSeries(points)
    const actionable = cleaned.corrections.filter((c) => c.kind !== 'unresolved')
    if (actionable.length === 0 && cleaned.corrections.length === 0) continue
    alerts.push({
      symbol,
      maxMove: Number(maxDailyMove(points).toFixed(4)),
      corrections: cleaned.corrections.map((c) => ({
        kind: c.kind,
        date: c.date,
        endDate: c.endDate,
        factor: Number(c.factor.toFixed(6)),
        rows: c.rows,
      })),
    })
  }
  alerts.sort((a, b) => b.maxMove - a.maxMove)

  await supabase.from('ingestion_jobs').insert([{
    source: 'price_series_check',
    dataset: 'stock_daily_prices',
    status: 'success',
    finished_at: new Date().toISOString(),
    rows_processed: bySymbol.size,
    error_message: alerts.length ? `${alerts.length} symbols need review` : null,
    meta: {
      fromDate,
      symbols: bySymbol.size,
      alertCount: alerts.length,
      alerts: alerts.slice(0, 40),
    },
  }])

  return res.status(200).json({
    ok: true,
    fromDate,
    symbols: bySymbol.size,
    alertCount: alerts.length,
    alerts: alerts.slice(0, 40),
  })
}
