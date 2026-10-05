#!/usr/bin/env node
/**
 * stock_daily_prices 의 분할 미조정·단위 이상 행을 PriceSeriesCleaner 규칙으로 고친다.
 * 최신 종가는 바꾸지 않는다. unresolved (예: MRNA) 는 기록만 하고 쓰지 않는다.
 *
 *   node scripts/apply-price-series-clean.mjs            # dry-run, 핸드오프 27종목
 *   node scripts/apply-price-series-clean.mjs --apply    # DB 반영
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { cleanPriceSeries, maxDailyMove } from '../api/_lib/price-series-cleaner.js'

try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (_) {}

const APPLY = process.argv.includes('--apply')
// DAY 는 ×20 이 분할이 아니라 다른 종목 데이터가 섞인 것일 수 있어 자동 반영하지 않는다.
const DO_NOT_APPLY = new Set(['DAY'])
const SYMBOLS = [
  '1329.T', '1306.T', '1364.T', '1367.T', '2247.T', '2248.T', '7735.T', '7012.T', '8309.T',
  'XLB', 'XLE', 'XLK', 'XLU', 'XLY', 'MRNA', 'DAY',
  '1545.T', '4452.T', '5801.T', '5802.T', '5803.T', '8053.T', '9008.T',
  '394A.T', '395A.T', '396A.T', 'CVNA',
]

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function loadSymbol(symbol) {
  const rows = []
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data, error } = await supabase
      .from('stock_daily_prices')
      .select('source,symbol,trade_date,open,high,low,close,volume')
      .eq('symbol', symbol)
      .order('trade_date', { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

async function main() {
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
    console.error('SUPABASE_URL 이 없습니다.')
    process.exit(1)
  }
  console.log(APPLY ? 'APPLY' : 'DRY-RUN')
  for (const symbol of SYMBOLS) {
    const rows = await loadSymbol(symbol)
    if (rows.length === 0) {
      console.log(`${symbol}: no rows`)
      continue
    }
    const bySource = new Map()
    for (const row of rows) {
      const source = row.source || ''
      if (!bySource.has(source)) bySource.set(source, [])
      bySource.get(source).push(row)
    }
    for (const [source, series] of bySource) {
      const cleaned = cleanPriceSeries(series.map((r) => ({
        date: String(r.trade_date).slice(0, 10),
        close: Number(r.close),
      })))
      const before = maxDailyMove(series.map((r) => ({ close: Number(r.close) })))
      const after = maxDailyMove(cleaned.points)
      const kinds = cleaned.corrections.map((c) => `${c.kind} ${c.date} ×${c.factor}`).join('; ') || '(none)'
      console.log(`${symbol} [${source}] ${series.length}→${cleaned.points.length} move ${(before * 100).toFixed(1)}%→${(after * 100).toFixed(1)}% ${kinds}`)
      if (!APPLY) continue
      const actionable = cleaned.corrections.some((c) => c.kind !== 'unresolved')
      if (!actionable || DO_NOT_APPLY.has(symbol)) continue
      const keptDates = new Set(cleaned.points.map((p) => p.date))
      const dropDates = series
        .map((r) => String(r.trade_date).slice(0, 10))
        .filter((d) => !keptDates.has(d))
      if (dropDates.length) {
        const { error } = await supabase
          .from('stock_daily_prices')
          .delete()
          .eq('symbol', symbol)
          .eq('source', source)
          .in('trade_date', dropDates)
        if (error) throw error
      }
      const updates = []
      cleaned.sourceIndex.forEach((idx, i) => {
        const factor = cleaned.scale[i]
        if (!(factor > 0) || Math.abs(factor - 1) < 1e-12) return
        const row = series[idx]
        const scalePx = (v) => {
          const n = Number(v)
          return Number.isFinite(n) ? n * factor : null
        }
        updates.push({
          source,
          symbol,
          trade_date: String(row.trade_date).slice(0, 10),
          open: scalePx(row.open),
          high: scalePx(row.high),
          low: scalePx(row.low),
          close: scalePx(row.close),
          volume: row.volume,
        })
      })
      for (let i = 0; i < updates.length; i += 200) {
        const batch = updates.slice(i, i + 200)
        const { error } = await supabase
          .from('stock_daily_prices')
          .upsert(batch, { onConflict: 'source,symbol,trade_date' })
        if (error) throw error
      }
    }
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
