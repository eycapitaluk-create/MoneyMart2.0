import { supabase } from './supabase'

const BATCH_SIZE = 40

const daysAgoIso = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

const chunk = (items, size = BATCH_SIZE) => {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

export const formatAum = (aum) => {
  if (!Number.isFinite(aum) || aum <= 0) return '-'
  return `¥${(aum / 100000000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}億`
}

export const formatPercent = (value, digits = 2) => {
  if (!Number.isFinite(value)) return '-'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

export const fetchJapanFundMetadata = async () => {
  const { data, error } = await supabase
    .from('stock_symbols')
    .select('symbol,name,exchange,currency,is_active,trust_fee,nisa_category,isin,asset_type,country,category,subcategory,benchmark,aum')
    .eq('asset_type', 'fund')
    .eq('country', 'JP')
    .eq('is_active', true)
    .order('symbol')

  if (error) throw error
  return data || []
}

export const fetchLatestFundRows = async (symbols) => {
  const latestMap = new Map()

  for (const batch of chunk(symbols)) {
    const { data, error } = await supabase
      .from('v_stock_latest')
      .select('symbol,trade_date,open,high,low,close,volume')
      .in('symbol', batch)

    if (error) throw error
    for (const row of data || []) latestMap.set(row.symbol, row)
  }

  return latestMap
}

export const fetchFundHistoryRows = async (symbols, daysBack = 370) => {
  const historyMap = new Map(symbols.map((symbol) => [symbol, []]))
  const fromDate = daysAgoIso(daysBack)

  for (const batch of chunk(symbols, 20)) {
    const { data, error } = await supabase
      .from('stock_daily_prices')
      .select('symbol,trade_date,close')
      .in('symbol', batch)
      .gte('trade_date', fromDate)
      .order('trade_date', { ascending: true })

    if (error) throw error
    for (const row of data || []) {
      if (!historyMap.has(row.symbol)) historyMap.set(row.symbol, [])
      historyMap.get(row.symbol).push({
        tradeDate: row.trade_date,
        close: Number(row.close),
      })
    }
  }

  return historyMap
}

export const buildFundSnapshot = (meta, latestRow, series = []) => {
  const filteredSeries = series.filter((item) => Number.isFinite(item.close))
  const latestSeriesRow = filteredSeries.at(-1) || null
  const latestClose = Number(latestRow?.close ?? latestSeriesRow?.close ?? NaN)
  const latestTradeDate = latestRow?.trade_date || latestSeriesRow?.tradeDate || null
  const previousRow = filteredSeries.length >= 2 ? filteredSeries.at(-2) : null
  const previousClose = Number(previousRow?.close ?? NaN)
  const dayChange = Number.isFinite(latestClose) && Number.isFinite(previousClose) ? latestClose - previousClose : null
  const dayRate = Number.isFinite(dayChange) && previousClose > 0 ? (dayChange / previousClose) * 100 : null
  const firstRow = filteredSeries[0] || null
  const oneYearReturn = firstRow && Number.isFinite(firstRow.close) && firstRow.close > 0 && Number.isFinite(latestClose)
    ? ((latestClose - firstRow.close) / firstRow.close) * 100
    : null
  const highs = filteredSeries.map((item) => item.close).filter(Number.isFinite)
  const high52w = highs.length > 0 ? Math.max(...highs) : null
  const low52w = highs.length > 0 ? Math.min(...highs) : null

  return {
    id: meta.symbol,
    symbol: meta.symbol,
    name: meta.name || meta.symbol,
    exchange: meta.exchange || 'XJPX',
    category: meta.category || 'その他',
    subcategory: meta.subcategory || '',
    benchmark: meta.benchmark || '-',
    trustFee: Number(meta.trust_fee ?? NaN),
    trustFeeDisplay: Number.isFinite(Number(meta.trust_fee)) ? `${Number(meta.trust_fee).toFixed(3)}%` : '-',
    aum: Number(meta.aum ?? NaN),
    aumDisplay: formatAum(Number(meta.aum ?? NaN)),
    nisaCategory: meta.nisa_category || '-',
    isin: meta.isin || '-',
    latestClose: Number.isFinite(latestClose) ? latestClose : null,
    latestTradeDate,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    dayChange,
    dayRate,
    oneYearReturn,
    high52w,
    low52w,
    history: filteredSeries,
  }
}

export const buildNormalizedHistory = (snapshots, limit = 180) => {
  const dateMap = new Map()

  for (const snapshot of snapshots) {
    const series = snapshot.history.slice(-limit)
    if (series.length === 0) continue
    const base = series[0].close
    if (!Number.isFinite(base) || base <= 0) continue

    for (const row of series) {
      if (!dateMap.has(row.tradeDate)) dateMap.set(row.tradeDate, { date: row.tradeDate })
      dateMap.get(row.tradeDate)[snapshot.symbol] = Number(((row.close / base) * 100).toFixed(2))
    }
  }

  return [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date))
}
