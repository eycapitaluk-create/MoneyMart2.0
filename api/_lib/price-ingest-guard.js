/**
 * 수집 직전 필터.
 * - 토·일 행은 넣지 않는다.
 * - 직전 영업일 종가 대비 1.8배 초과 또는 0.55배 미만이면 stock_daily_prices 에 넣지 않고 격리한다.
 */

import { isWeekendTradeDate, SPIKE_DOWN, SPIKE_UP } from './price-series-cleaner.js'

export function isExtremeCloseMove(prevClose, close) {
  const prev = Number(prevClose)
  const next = Number(close)
  if (!(prev > 0) || !(next > 0)) return false
  const ratio = next / prev
  return ratio > SPIKE_UP || ratio < SPIKE_DOWN
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object[]} rows source, symbol, trade_date, close 를 가진 행
 */
export async function partitionIncomingPrices(supabase, rows) {
  const accepted = []
  const weekend = []
  const quarantined = []
  const bySymbol = new Map()
  for (const row of rows || []) {
    const symbol = String(row?.symbol || '').trim().toUpperCase()
    const tradeDate = String(row?.trade_date || '').slice(0, 10)
    if (!symbol || !tradeDate) continue
    if (isWeekendTradeDate(tradeDate)) {
      weekend.push({ ...row, symbol, trade_date: tradeDate, reason: 'weekend' })
      continue
    }
    if (!bySymbol.has(symbol)) bySymbol.set(symbol, [])
    bySymbol.get(symbol).push({ ...row, symbol, trade_date: tradeDate })
  }

  const symbols = [...bySymbol.keys()]
  const priorClose = new Map()
  for (let i = 0; i < symbols.length; i += 80) {
    const batch = symbols.slice(i, i + 80)
    const { data, error } = await supabase
      .from('v_stock_latest')
      .select('symbol,trade_date,close')
      .in('symbol', batch)
    if (error) throw error
    for (const row of data || []) {
      const symbol = String(row.symbol || '').trim().toUpperCase()
      priorClose.set(symbol, { date: String(row.trade_date || '').slice(0, 10), close: Number(row.close) })
    }
  }

  for (const [symbol, list] of bySymbol) {
    list.sort((a, b) => a.trade_date.localeCompare(b.trade_date))
    let cursor = priorClose.get(symbol) || null
    for (const row of list) {
      const close = Number(row.close)
      if (cursor && row.trade_date > cursor.date && isExtremeCloseMove(cursor.close, close)) {
        quarantined.push({
          ...row,
          reason: 'extreme_vs_prev_close',
          prev_trade_date: cursor.date,
          prev_close: cursor.close,
          ratio: close / cursor.close,
        })
        continue
      }
      if (!cursor || row.trade_date >= cursor.date) {
        cursor = { date: row.trade_date, close }
      }
      accepted.push(row)
    }
  }

  return { accepted, weekend, quarantined }
}

export async function writePriceQuarantine(supabase, rows) {
  if (!rows?.length) return { stored: 0, skipped: true }
  const payload = rows.map((row) => ({
    source: row.source || 'marketstack',
    symbol: row.symbol,
    trade_date: row.trade_date,
    open: row.open ?? null,
    high: row.high ?? null,
    low: row.low ?? null,
    close: row.close ?? null,
    volume: row.volume ?? null,
    reason: row.reason || 'extreme_vs_prev_close',
    prev_trade_date: row.prev_trade_date || null,
    prev_close: row.prev_close ?? null,
    ratio: row.ratio ?? null,
  }))
  const { error } = await supabase
    .from('stock_daily_price_quarantine')
    .upsert(payload, { onConflict: 'source,symbol,trade_date' })
  if (error) {
    const missing = error.code === '42P01' || error.code === 'PGRST205' || /stock_daily_price_quarantine/i.test(String(error.message || ''))
    if (missing) return { stored: 0, skipped: true, message: error.message }
    throw error
  }
  return { stored: payload.length, skipped: false }
}
