import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { ETF_LIST_FROM_XLSX } from '../src/data/etfListFromXlsx.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const run = async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY')
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const etfMetaMap = new Map(ETF_LIST_FROM_XLSX.map((x) => [x.symbol, x]))
  const etfSymbols = ETF_LIST_FROM_XLSX.map((x) => x.symbol)

  const existingLatestRows = []
  const latestBatches = chunk(etfSymbols, 80)
  for (const batch of latestBatches) {
    const { data, error } = await supabase
      .from('v_stock_latest')
      .select('symbol')
      .in('symbol', batch)
    if (error) throw error
    existingLatestRows.push(...(data || []))
  }
  const listedSymbols = [...new Set(existingLatestRows.map((r) => r.symbol))]

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const rows = []
  for (const symbol of listedSymbols) {
    const { count, error } = await supabase
      .from('stock_daily_prices')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'marketstack')
      .eq('symbol', symbol)
      .gte('trade_date', cutoffStr)
    if (error) throw error
    const n = count || 0
    rows.push({
      symbol,
      isin: etfMetaMap.get(symbol)?.isin || '',
      jpName: etfMetaMap.get(symbol)?.jpName || symbol,
      rows1y: n,
      has1yForMetrics: n >= 80,
    })
  }

  rows.sort((a, b) => a.rows1y - b.rows1y || a.symbol.localeCompare(b.symbol))
  const okCount = rows.filter((r) => r.has1yForMetrics).length
  const missing = rows.filter((r) => !r.has1yForMetrics)

  const reportDir = path.resolve('reports')
  await fs.mkdir(reportDir, { recursive: true })
  const jsonPath = path.join(reportDir, 'etf_history_coverage.json')
  const csvPath = path.join(reportDir, 'etf_history_missing_under80.csv')

  const summary = {
    generatedAt: new Date().toISOString(),
    cutoffDate: cutoffStr,
    listedCount: listedSymbols.length,
    withEnoughHistoryCount: okCount,
    missingCount: missing.length,
  }
  await fs.writeFile(jsonPath, JSON.stringify({ summary, rows }, null, 2), 'utf8')

  const csvHeader = 'symbol,isin,jpName,rows1y,has1yForMetrics\n'
  const csvBody = missing
    .map((r) => {
      const esc = (v) => `"${String(v || '').replace(/"/g, '""')}"`
      return [esc(r.symbol), esc(r.isin), esc(r.jpName), r.rows1y, r.has1yForMetrics].join(',')
    })
    .join('\n')
  await fs.writeFile(csvPath, csvHeader + csvBody + (csvBody ? '\n' : ''), 'utf8')

  console.log(JSON.stringify(summary))
  console.log(`Wrote: ${jsonPath}`)
  console.log(`Wrote: ${csvPath}`)
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
