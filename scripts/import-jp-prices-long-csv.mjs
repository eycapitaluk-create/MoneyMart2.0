#!/usr/bin/env node
/**
 * 일본 주식 일별 롱 포맷 CSV → Supabase stock_daily_prices
 * 헤더 예: source,symbol,trade_date,open,high,low,close,volume,raw,fetched_at
 *
 * 사용:
 *   node scripts/import-jp-prices-long-csv.mjs /path/to/jp_prices.csv
 *   JP_LONG_CSV=/path/to.csv node scripts/import-jp-prices-long-csv.mjs
 *
 * --dry-run: DB 쓰기 없이 행 수만 출력
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_ENV_FILES = ['.env.local', '.env']
const BATCH = 4000

const stripWrappingQuotes = (value = '') => {
  const trimmed = String(value || '').trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const loadEnvFiles = async () => {
  for (const envFile of DEFAULT_ENV_FILES) {
    try {
      const raw = await fs.readFile(envFile, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
        const eqIdx = trimmed.indexOf('=')
        const key = trimmed.slice(0, eqIdx).trim()
        const value = stripWrappingQuotes(trimmed.slice(eqIdx + 1))
        if (!key || process.env[key]) continue
        process.env[key] = value
      }
    } catch {
      // ignore
    }
  }
}

/** RFC4180 스타일 (따옴표·"" 이스케이프) */
function parseCsv(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQuotes = false
  const pushCell = () => {
    row.push(cur)
    cur = ''
  }
  const pushRow = () => {
    rows.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"'
        i += 1
        continue
      }
      if (c === '"') {
        inQuotes = false
        continue
      }
      cur += c
      continue
    }
    if (c === '"') {
      inQuotes = true
      continue
    }
    if (c === ',') {
      pushCell()
      continue
    }
    if (c === '\r') continue
    if (c === '\n') {
      pushCell()
      pushRow()
      continue
    }
    cur += c
  }
  pushCell()
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) pushRow()
  return rows
}

const normalizeDbSource = (cell) => {
  const s = String(cell || 'yfinance')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return s || 'yfinance'
}

const normalizeSymbol = (sym) => {
  let u = String(sym || '').trim().toUpperCase()
  u = u.replace(/\.\d+$/, '')
  return u
}

const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const run = async () => {
  await loadEnvFiles()
  const csvPath =
    process.argv.find((a) => !a.startsWith('-') && a.endsWith('.csv'))
    || process.env.JP_LONG_CSV
  if (!csvPath) {
    console.error('CSV 경로 필요: node scripts/import-jp-prices-long-csv.mjs /path/to.csv')
    process.exit(1)
  }

  const dryRun = process.argv.includes('--dry-run')
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!dryRun && (!supabaseUrl || !supabaseKey)) {
    throw new Error('SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_SECRET_KEY) 필요')
  }

  const rawText = await fs.readFile(csvPath, 'utf8')
  const table = parseCsv(rawText.replace(/^\uFEFF/, ''))
  if (table.length < 2) throw new Error('CSV 데이터 없음')

  const header = table[0].map((h) => String(h).trim().toLowerCase())
  const idx = (name) => header.indexOf(name)
  const iSym = idx('symbol')
  const iDate = idx('trade_date')
  const iClose = idx('close')
  const iOpen = idx('open')
  const iHigh = idx('high')
  const iLow = idx('low')
  const iVol = idx('volume')
  const iSrc = idx('source')
  const iRaw = idx('raw')
  if (iSym < 0 || iDate < 0 || iClose < 0) {
    throw new Error(`필수 컬럼 없음: symbol=${iSym} trade_date=${iDate} close=${iClose}`)
  }

  const priceRows = []
  const symSet = new Set()
  const ingestAt = new Date().toISOString()

  for (let r = 1; r < table.length; r += 1) {
    const cells = table[r]
    if (!cells || cells.length < header.length - 2) continue
    const symbol = normalizeSymbol(cells[iSym])
    const tradeDate = String(cells[iDate] || '').trim().slice(0, 10)
    if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) continue
    const close = toNum(cells[iClose])
    if (close == null || close <= 0) continue

    const dbSource = normalizeDbSource(iSrc >= 0 ? cells[iSrc] : 'yfinance')
    symSet.add(symbol)

    let rawObj = null
    if (iRaw >= 0 && cells[iRaw]) {
      try {
        rawObj = JSON.parse(cells[iRaw])
      } catch {
        rawObj = { text: cells[iRaw] }
      }
    }
    const baseRaw = rawObj && typeof rawObj === 'object' ? rawObj : {}
    const mergedRaw = {
      ...baseRaw,
      imported_via: 'jp_long_csv',
      imported_from: path.basename(csvPath),
    }

    priceRows.push({
      source: dbSource,
      symbol,
      trade_date: tradeDate,
      open: iOpen >= 0 ? toNum(cells[iOpen]) : null,
      high: iHigh >= 0 ? toNum(cells[iHigh]) : null,
      low: iLow >= 0 ? toNum(cells[iLow]) : null,
      close,
      volume: iVol >= 0 ? (() => {
        const v = toNum(cells[iVol])
        return v != null && Number.isFinite(v) && v >= 0 ? Math.round(v) : null
      })() : null,
      raw: mergedRaw,
      fetched_at: ingestAt,
    })
  }

  const dedup = new Map()
  for (const pr of priceRows) {
    dedup.set(`${pr.source}|${pr.symbol}|${pr.trade_date}`, pr)
  }
  const finalPrices = [...dedup.values()]

  console.log(`파일: ${csvPath}`)
  console.log(`심볼 수: ${symSet.size}, 가격 행(중복 제거 후): ${finalPrices.length}`)
  if (dryRun) {
    console.log('Dry run — Supabase 쓰기 생략')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const symbolRows = [...symSet].map((symbol) => ({ symbol, name: symbol, is_active: true }))

  const { data: existing } = await supabase
    .from('stock_symbols')
    .select('symbol')
    .in('symbol', symbolRows.map((r) => r.symbol))
  const existingSet = new Set((existing || []).map((r) => r.symbol))
  const newSyms = symbolRows.filter((r) => !existingSet.has(r.symbol))
  if (newSyms.length > 0) {
    const { error } = await supabase.from('stock_symbols').upsert(newSyms, { onConflict: 'symbol' })
    if (error) throw error
    console.log(`stock_symbols 신규 upsert: ${newSyms.length}건`)
  } else {
    console.log('stock_symbols: 기존 심볼만 (이름 유지)')
  }

  const batches = chunk(finalPrices, BATCH)
  for (let i = 0; i < batches.length; i += 1) {
    const { error } = await supabase
      .from('stock_daily_prices')
      .upsert(batches[i], { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
    console.log(`stock_daily_prices 배치 ${i + 1}/${batches.length} (${batches[i].length}행)`)
  }
  console.log('완료.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
