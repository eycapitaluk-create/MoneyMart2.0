/**
 * market_dashboard_YYYY-MM-DD.xlsx →
 *   stock_daily_prices / commodity_daily_prices / fx_daily_usdjpy /
 *   market_dashboard_recent  （Business アプリが読む統合テーブル — 常に更新）
 *
 *   node scripts/import-market-dashboard-xlsx.mjs /path/to/market_dashboard_2026-08-25.xlsx
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const SOURCE = 'marketstack'

const INDEX_LABEL_TO_SYMBOL = {
  '日経225': '^N225',
  'TOPIX': '1306.T',
  'S&P500': '^GSPC',
  'NASDAQ': '^IXIC',
  'Dow': '^DJI',
  'Hang Seng': '^HSI',
  '上海総合': '^SSEC',
  'DAX': '^GDAXI',
  'US10Y': '^TNX',
  'VIX': '^VIX',
  'MOVE': '^MOVE',
}

const COMMODITY_LABEL_TO_NAME = {
  Gold: 'gold',
  Silver: 'silver',
  WTI: 'crude_oil',
  Brent: 'brent_crude',
}

/** Business `market_dashboard_recent.category` */
const ITEM_CATEGORY = {
  '日経225': 'index',
  TOPIX: 'index',
  'S&P500': 'index',
  NASDAQ: 'index',
  Dow: 'index',
  'Hang Seng': 'index',
  '上海総合': 'index',
  DAX: 'index',
  US10Y: 'rates',
  VIX: 'vol',
  MOVE: 'vol',
  VXTLT: 'vol',
  'USD/JPY': 'fx',
  'EUR/JPY': 'fx',
  'GBP/JPY': 'fx',
  'AUD/JPY': 'fx',
  'CNY/JPY': 'fx',
  Gold: 'commodity',
  Silver: 'commodity',
  WTI: 'commodity',
  Brent: 'commodity',
  'Risk-On/Off Score': 'sentiment',
}

const loadEnv = async () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(f, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch {}
  }
}

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

const tradeDateFromPath = (filePath) => {
  const m = path.basename(filePath).match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

const parseDashboardRows = (xlsxPath) => {
  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  const fileBase = path.basename(xlsxPath)
  const tradeDate = tradeDateFromPath(xlsxPath)
  if (!tradeDate) throw new Error(`trade_date をファイル名から取得できません: ${fileBase}`)

  const commodityRows = []
  const indexPriceRows = []
  const symbolRows = []
  const recentRows = []
  let fxUsdJpy = null
  const nowIso = new Date().toISOString()

  for (const row of rows.slice(1)) {
    const label = String(row?.[0] ?? '').trim()
    const value = toNum(row?.[1])
    const pct = toNum(row?.[2])
    const status = String(row?.[3] ?? '').trim() || 'ok'
    if (!label || value == null || value <= 0) continue

    const category = ITEM_CATEGORY[label]
    if (category) {
      recentRows.push({
        trade_date: tradeDate,
        item: label,
        category,
        value,
        change_pct: pct,
        status,
        updated_at: nowIso,
      })
    }

    // single_point（VXTLT 等）は recent のみ。価格系列テーブルには入れない
    if (status === 'single_point') continue

    if (label === 'Risk-On/Off Score') {
      commodityRows.push({
        commodity_name: 'risk_on_off',
        trade_date: tradeDate,
        price: value,
        price_change_day: null,
        percentage_day: null,
        percentage_week: null,
        percentage_month: null,
        percentage_year: null,
        commodity_unit: 'score',
        raw: { imported_from: fileBase, dashboard_label: label, status },
        fetched_at: nowIso,
      })
      continue
    }

    if (label === 'USD/JPY') {
      fxUsdJpy = value
      continue
    }

    // クロス円は market_dashboard_recent のみ（fx_daily_usdjpy は USD/JPY 専用）
    if (category === 'fx') continue

    const commodityName = COMMODITY_LABEL_TO_NAME[label]
    if (commodityName) {
      commodityRows.push({
        commodity_name: commodityName,
        trade_date: tradeDate,
        price: value,
        price_change_day: null,
        percentage_day: pct,
        percentage_week: null,
        percentage_month: null,
        percentage_year: null,
        commodity_unit: null,
        raw: { imported_from: fileBase, dashboard_label: label },
        fetched_at: nowIso,
      })
      continue
    }

    const symbol = INDEX_LABEL_TO_SYMBOL[label]
    if (!symbol) continue

    symbolRows.push({ symbol, name: label, is_active: true })
    indexPriceRows.push({
      source: SOURCE,
      symbol,
      trade_date: tradeDate,
      open: value,
      high: value,
      low: value,
      close: value,
      volume: null,
      raw: { imported_from: fileBase, dashboard_label: label, pct_day: pct },
    })
  }

  return { fileBase, tradeDate, commodityRows, indexPriceRows, symbolRows, fxUsdJpy, recentRows }
}

const upsertMarketDashboardRecent = async (supabase, recentRows, tradeDate) => {
  if (!recentRows.length) return { count: 0, mode: 'skip' }

  // Prefer natural key. Fall back to delete+insert if constraint name differs.
  const { error: upErr } = await supabase
    .from('market_dashboard_recent')
    .upsert(recentRows, { onConflict: 'trade_date,item' })

  if (!upErr) return { count: recentRows.length, mode: 'upsert' }

  const { error: delErr } = await supabase
    .from('market_dashboard_recent')
    .delete()
    .eq('trade_date', tradeDate)
  if (delErr) throw new Error(`market_dashboard_recent upsert failed (${upErr.message}); delete fallback failed (${delErr.message})`)

  const { error: insErr } = await supabase.from('market_dashboard_recent').insert(recentRows)
  if (insErr) throw new Error(`market_dashboard_recent insert failed: ${insErr.message} (after upsert: ${upErr.message})`)

  return { count: recentRows.length, mode: 'delete+insert' }
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

  const xlsxPath = process.argv[2]
  if (!xlsxPath) throw new Error('Usage: node scripts/import-market-dashboard-xlsx.mjs /path/market_dashboard_YYYY-MM-DD.xlsx')

  const parsed = parseDashboardRows(xlsxPath)
  const supabase = createClient(supabaseUrl, supabaseKey)

  if (parsed.symbolRows.length > 0) {
    const dedupSymbols = [...new Map(parsed.symbolRows.map((r) => [r.symbol, r])).values()]
    const { error } = await supabase.from('stock_symbols').upsert(dedupSymbols, { onConflict: 'symbol' })
    if (error) throw error
  }

  if (parsed.indexPriceRows.length > 0) {
    const { error } = await supabase
      .from('stock_daily_prices')
      .upsert(parsed.indexPriceRows, { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
  }

  if (parsed.commodityRows.length > 0) {
    const { error } = await supabase
      .from('commodity_daily_prices')
      .upsert(parsed.commodityRows, { onConflict: 'commodity_name,trade_date' })
    if (error) throw error
  }

  if (parsed.fxUsdJpy != null) {
    const { error } = await supabase.from('fx_daily_usdjpy').upsert({
      as_of_date: parsed.tradeDate,
      usd_jpy: parsed.fxUsdJpy,
      provider: 'manual_xlsx',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'as_of_date' })
    if (error) throw error
  }

  const recent = await upsertMarketDashboardRecent(supabase, parsed.recentRows, parsed.tradeDate)

  console.log(
    `Done ${parsed.fileBase} (${parsed.tradeDate}): `
    + `indices=${parsed.indexPriceRows.length}, `
    + `commodities=${parsed.commodityRows.length}, `
    + `fx=${parsed.fxUsdJpy != null ? 'USD/JPY' : 'skip'}, `
    + `recent=${recent.count} (${recent.mode}) `
    + `(→stock_daily_prices/commodity_daily/fx_daily/market_dashboard_recent)`,
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
