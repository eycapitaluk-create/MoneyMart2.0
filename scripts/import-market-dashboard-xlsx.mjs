/**
 * market_dashboard_YYYY-MM-DD.xlsx →
 *   stock_daily_prices / fx_daily_usdjpy /
 *   market_dashboard_daily  （Business の market_dashboard_recent ビューの実테이블）
 *
 *   node scripts/import-market-dashboard-xlsx.mjs /path/to/market_dashboard_2026-08-25.xlsx
 *   node scripts/import-market-dashboard-xlsx.mjs /path/to/market_dashboard_2026-08-25.xlsx --dry-run
 *   日本市場休場日: --jp-market-closed（Nikkei/TOPIX の価格行を作らず recent は休場表示）
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { importerFxWrites } from '../api/_lib/fxYahooSync.js'
import { omitUnverifiedSpreadsheetCommodities } from '../src/lib/commodityDataGuard.js'
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
    // 1306.T is the TOPIX ETF and already has a real OHLC bar. A dashboard close must not replace it.
    if (symbol === '1306.T') continue
    indexPriceRows.push({
      source: SOURCE,
      symbol,
      trade_date: tradeDate,
      open: null,
      high: null,
      low: null,
      close: value,
      volume: null,
      raw: {
        imported_from: fileBase,
        dashboard_label: label,
        pct_day: pct,
        price_basis: 'close_only',
        ohlc: 'unavailable',
      },
    })
  }

  return { fileBase, tradeDate, commodityRows, indexPriceRows, symbolRows, fxUsdJpy, recentRows }
}

export function rowsPreservingExistingOhlc(incomingRows, existingRows) {
  const byKey = new Map((existingRows || []).map((row) => [`${row.symbol}|${row.trade_date}`, row]))
  const writes = []
  const kept = []
  for (const row of incomingRows || []) {
    const existing = byKey.get(`${row.symbol}|${row.trade_date}`)
    const hasOhlc = existing && [existing.open, existing.high, existing.low].some((value) => value != null)
    if (hasOhlc) {
      kept.push(row.symbol)
      continue
    }
    writes.push({
      ...row,
      open: null,
      high: null,
      low: null,
      close: row.close,
      volume: existing?.volume ?? null,
    })
  }
  return { writes, kept }
}

const upsertMarketDashboardDaily = async (supabase, recentRows) => {
  if (!recentRows.length) return { count: 0, mode: 'skip' }
  const { error } = await supabase
    .from('market_dashboard_daily')
    .upsert(recentRows, { onConflict: 'trade_date,item' })
  if (error) throw new Error(`market_dashboard_daily upsert failed: ${error.message}`)
  return { count: recentRows.length, mode: 'upsert' }
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

  const xlsxPath = process.argv[2]
  if (!xlsxPath) throw new Error('Usage: node scripts/import-market-dashboard-xlsx.mjs /path/market_dashboard_YYYY-MM-DD.xlsx')

  const parsed = parseDashboardRows(xlsxPath)
  parsed.recentRows = omitUnverifiedSpreadsheetCommodities(parsed.recentRows)
  const dryRun = process.argv.slice(3).includes('--dry-run')
  if (/PARTIAL_DO_NOT_IMPORT/i.test(path.basename(xlsxPath)) && !dryRun) {
    throw new Error('Partial workbook rejected: inspect with --dry-run; do not import missing or unverified values.')
  }
  const jpMarketClosed = process.argv.slice(3).includes('--jp-market-closed')
  if (jpMarketClosed) {
    const closedSymbols = new Set(['^N225', '1306.T'])
    const closedLabels = new Set(['日経225', 'TOPIX'])
    parsed.indexPriceRows = parsed.indexPriceRows.filter((row) => !closedSymbols.has(row.symbol))
    parsed.symbolRows = parsed.symbolRows.filter((row) => !closedSymbols.has(row.symbol))
    parsed.recentRows = parsed.recentRows.map((row) => (
      closedLabels.has(row.item) ? { ...row, status: 'market_closed' } : row
    ))
  }
  if (dryRun) {
    console.log(
      `[dry-run] ${parsed.fileBase} (${parsed.tradeDate}): `
      + `indices=${parsed.indexPriceRows.length}, `
      + `commodities_held=${parsed.commodityRows.length}, `
      + `fx=${parsed.fxUsdJpy != null ? 'USD/JPY' : 'skip'}, `
      + `recent=${parsed.recentRows.length}, `
      + `jp_market_closed=${jpMarketClosed ? 'yes' : 'no'}. No database rows were changed.`,
    )
    return
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  if (parsed.symbolRows.length > 0) {
    const dedupSymbols = [...new Map(parsed.symbolRows.map((r) => [r.symbol, r])).values()]
    const { error } = await supabase.from('stock_symbols').upsert(dedupSymbols, { onConflict: 'symbol' })
    if (error) throw error
  }

  if (parsed.indexPriceRows.length > 0) {
    const symbols = [...new Set(parsed.indexPriceRows.map((row) => row.symbol))]
    const { data: existingRows, error: existingErr } = await supabase
      .from('stock_daily_prices')
      .select('symbol,trade_date,open,high,low,close,volume')
      .in('symbol', symbols)
      .eq('trade_date', parsed.tradeDate)
    if (existingErr) throw existingErr
    const { writes, kept } = rowsPreservingExistingOhlc(parsed.indexPriceRows, existingRows || [])
    if (kept.length) {
      console.log(`[keep-ohlc] left existing ranged bars unchanged: ${kept.join(', ')}`)
    }
    for (const row of writes) {
      const existing = (existingRows || []).find((item) => item.symbol === row.symbol && item.trade_date === row.trade_date)
      if (existing) {
        const { error } = await supabase
          .from('stock_daily_prices')
          .update({ close: row.close, raw: row.raw })
          .eq('symbol', row.symbol)
          .eq('trade_date', row.trade_date)
          .is('open', null)
          .is('high', null)
          .is('low', null)
        if (error) throw error
      } else {
        const { error } = await supabase.from('stock_daily_prices').insert([row])
        if (error) throw error
      }
    }
  }

  if (parsed.commodityRows.length > 0) {
    console.log(`[hold-commodities] skipped ${parsed.commodityRows.length} spreadsheet commodity/score rows; verified settlement job owns these values`)
  }

  const { data: fxExisting, error: fxExistingErr } = await supabase
    .from('fx_daily_usdjpy')
    .select('as_of_date,usd_jpy,provider,updated_at')
    .eq('as_of_date', parsed.tradeDate)
    .maybeSingle()
  if (fxExistingErr) throw fxExistingErr
  const fxGuard = importerFxWrites({
    tradeDate: parsed.tradeDate,
    fxValue: parsed.fxUsdJpy,
    fxExisting,
    recentRows: parsed.recentRows,
  })
  parsed.recentRows = fxGuard.recentRows
  if (fxGuard.reason === 'yahoo_fx_protected') {
    console.log(`[keep-yahoo-fx] left Yahoo USD/JPY and dashboard FX for ${parsed.tradeDate} unchanged`)
  }
  if (fxGuard.writeUsdJpy) {
    const { error } = await supabase.from('fx_daily_usdjpy').upsert({
      as_of_date: parsed.tradeDate,
      usd_jpy: parsed.fxUsdJpy,
      provider: 'manual_xlsx',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'as_of_date' })
    if (error) throw error
  }

  const recent = await upsertMarketDashboardDaily(supabase, parsed.recentRows)

  console.log(
    `Done ${parsed.fileBase} (${parsed.tradeDate}): `
    + `indices=${parsed.indexPriceRows.length}, `
    + `commodities_held=${parsed.commodityRows.length}, `
    + `fx=${parsed.fxUsdJpy != null ? 'USD/JPY' : 'skip'}, `
    + `recent=${recent.count} (${recent.mode}) `
    + `(→stock_daily_prices/fx_daily/market_dashboard_daily; commodity and risk-score values preserved)`,
  )
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isDirectRun) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
