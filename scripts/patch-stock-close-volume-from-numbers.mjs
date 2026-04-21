#!/usr/bin/env node
/**
 * Apple Numbers(Investing 등 추출)의 종가·거래량으로 stock_daily_prices 를 패치.
 * DB에 이미 있는 (symbol, trade_date, source) 행만 갱신하고, Numbers에만 있는 날짜는 삽입하지 않음.
 *
 * 사용:
 *   node scripts/patch-stock-close-volume-from-numbers.mjs /path/to/price.numbers 1629.T 2025-02-18 2026-03-27 --dry-run
 *   node scripts/patch-stock-close-volume-from-numbers.mjs /path/to/price.numbers 1629.T 2025-02-18 2026-03-27 --apply
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_ENV_FILES = ['.env.local', '.env']

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
      const raw = await fs.readFile(path.join(process.cwd(), envFile), 'utf8')
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

const run = async () => {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const dryRun = args.includes('--dry-run')
  const apply = args.includes('--apply')
  const pos = args.filter((a) => !a.startsWith('--'))
  const numbersPath = pos[0]
  const symbol = (pos[1] || '1629.T').trim()
  const dateFrom = (pos[2] || '2025-02-18').slice(0, 10)
  const dateTo = (pos[3] || '2026-03-27').slice(0, 10)

  if (!numbersPath) {
    console.error(
      'Usage: node scripts/patch-stock-close-volume-from-numbers.mjs <file.numbers> [symbol] [dateFrom] [dateTo] --dry-run|--apply',
    )
    process.exit(1)
  }
  if (!apply && !dryRun) {
    console.error('--dry-run 또는 --apply 를 지정하세요.')
    process.exit(1)
  }
  if (apply && dryRun) {
    console.error('--dry-run 과 --apply 는 동時に使えません.')
    process.exit(1)
  }

  await loadEnvFiles()

  const py = path.join(__dirname, 'extract-numbers-close-volume.py')
  const jsonText = execFileSync('python3', [py, numbersPath], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const arr = JSON.parse(jsonText)
  const priceByDate = new Map()
  for (const r of arr) {
    const d = String(r.date || '').slice(0, 10)
    if (d < dateFrom || d > dateTo) continue
    priceByDate.set(d, {
      close: Number(r.close),
      volume: r.volume != null && Number.isFinite(Number(r.volume)) ? Math.round(Number(r.volume)) : null,
    })
  }
  console.log(`Numbers: ${priceByDate.size} rows in [${dateFrom}..${dateTo}]`)

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_SECRET_KEY) 필요')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: dbRows, error: qErr } = await supabase
    .from('stock_daily_prices')
    .select('source,symbol,trade_date,close,volume')
    .eq('symbol', symbol)
    .gte('trade_date', dateFrom)
    .lte('trade_date', dateTo)
    .order('trade_date', { ascending: true })

  if (qErr) throw qErr

  const toPatch = []
  for (const row of dbRows || []) {
    const d = String(row.trade_date || '').slice(0, 10)
    const p = priceByDate.get(d)
    if (!p) continue
    toPatch.push({
      source: row.source,
      trade_date: d,
      close: p.close,
      volume: p.volume,
      prevClose: row.close,
      prevVol: row.volume,
    })
  }

  console.log(`DB 해당 구간 행: ${(dbRows || []).length}, Numbers와 날짜 겹침(패치 대상): ${toPatch.length}`)
  if (toPatch.length <= 10) {
    for (const x of toPatch) {
      console.log(
        `  ${x.trade_date} [${x.source}] close ${x.prevClose}→${x.close} vol ${x.prevVol}→${x.volume}`,
      )
    }
  } else {
    const head = toPatch.slice(0, 3)
    const tail = toPatch.slice(-3)
    ;[...head, { trade_date: '…' }, ...tail].forEach((x) => {
      if (x.trade_date === '…') console.log('  …')
      else
        console.log(
          `  ${x.trade_date} [${x.source}] close ${x.prevClose}→${x.close} vol ${x.prevVol}→${x.volume}`,
        )
    })
  }

  const inDbOnly = (dbRows || []).filter((r) => !priceByDate.has(String(r.trade_date || '').slice(0, 10))).length
  const inNumbersOnly = [...priceByDate.keys()].filter(
    (d) => !(dbRows || []).some((r) => String(r.trade_date || '').slice(0, 10) === d),
  ).length
  console.log(`DB만 있음(패치 안 함): ${inDbOnly}일, Numbers만 있음(삽입 안 함): ${inNumbersOnly}일`)

  if (dryRun) {
    console.log('Dry run — DB 쓰기 없음')
    return
  }

  const fetchedAt = new Date().toISOString()
  let ok = 0
  for (const x of toPatch) {
    const { error: uErr } = await supabase
      .from('stock_daily_prices')
      .update({
        close: x.close,
        volume: x.volume,
        fetched_at: fetchedAt,
      })
      .eq('source', x.source)
      .eq('symbol', symbol)
      .eq('trade_date', x.trade_date)
    if (uErr) {
      console.error('Update error', x.trade_date, uErr.message)
      throw uErr
    }
    ok += 1
  }
  console.log(`완료: ${ok}행 update (${symbol})`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
