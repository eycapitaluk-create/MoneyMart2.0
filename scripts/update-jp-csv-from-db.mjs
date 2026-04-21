#!/usr/bin/env node
/**
 * Supabase stock_daily_prices에서 JP 데이터를 가져와 CSV에 행 추가
 * 실행: node scripts/update-jp-csv-from-db.mjs [--date 2026-03-16] [--csv /path/to/jp_prices.csv]
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const CSV_PATH = process.argv.includes('--csv')
  ? process.argv[process.argv.indexOf('--csv') + 1]
  : '/Users/justinnam/Downloads/jp_prices_2026-03-17.csv'
const TARGET_DATE = process.argv.includes('--date')
  ? process.argv[process.argv.indexOf('--date') + 1]
  : '2026-03-16'

const loadEnv = async () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(path.resolve(process.cwd(), f), 'utf8')
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

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !key) {
    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  }

  const supabase = createClient(supabaseUrl, key)

  const { data: rows, error } = await supabase
    .from('stock_daily_prices')
    .select('symbol,close')
    .eq('trade_date', TARGET_DATE)
    .eq('source', 'marketstack')
    .like('symbol', '%.T')

  if (error) throw error
  const priceBySymbol = new Map((rows || []).map((r) => [r.symbol, r.close]))

  const raw = await fs.readFile(CSV_PATH, 'utf8')
  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 1) throw new Error('CSV 비어있음')

  const header = lines[0]
  const symbols = header.split(',').slice(1).map((s) => s.trim())
  const values = symbols.map((sym) => {
    const close = priceBySymbol.get(sym) ?? priceBySymbol.get(sym?.replace(/\.1$/, ''))
    return close != null && close > 0 ? String(close) : ''
  })

  const filled = values.filter(Boolean).length
  if (filled === 0) {
    console.log(`${TARGET_DATE} DB에 데이터 없음. CSV 변경 안 함.`)
    return
  }

  const newRow = [TARGET_DATE, ...values].join(',')
  const existingIdx = lines.findIndex((l) => l.startsWith(TARGET_DATE + ','))
  let newLines
  if (existingIdx >= 0) {
    newLines = [...lines]
    newLines[existingIdx] = newRow
  } else {
    newLines = [...lines, newRow]
  }

  await fs.writeFile(CSV_PATH, newLines.join('\n') + '\n', 'utf8')
  console.log(`${TARGET_DATE} 행 ${existingIdx >= 0 ? '갱신' : '추가'} 완료. ${filled}/${symbols.length} 종목`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
