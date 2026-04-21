#!/usr/bin/env node
/**
 * Price History xlsx(Date, Close, Volume) → stock_daily_prices の close・volume のみ更新。
 * DB に既にある (source, symbol, trade_date) のみ。xlsx にだけある日は挿入しない。
 *
 * 사용:
 *   node scripts/patch-stock-close-volume-from-xlsx.mjs /path/to.xlsx [symbol] [dateFrom] [dateTo] --dry-run
 *   node scripts/patch-stock-close-volume-from-xlsx.mjs /path/to.xlsx 1306.T --apply
 *   (dateFrom/dateTo 省略時は xlsx 内の最小・最大日で DB を絞る)
 *
 * 要: pip install openpyxl
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
  const xlsxPath = pos[0]
  const symbol = (pos[1] || '1306.T').trim()
  const dateFromOpt = pos[2] ? pos[2].slice(0, 10) : null
  const dateToOpt = pos[3] ? pos[3].slice(0, 10) : null

  if (!xlsxPath) {
    console.error(
      'Usage: node scripts/patch-stock-close-volume-from-xlsx.mjs <file.xlsx> [symbol] [dateFrom] [dateTo] --dry-run|--apply',
    )
    process.exit(1)
  }
  if (!apply && !dryRun) {
    console.error('--dry-run 또는 --apply 를 지정하세요.')
    process.exit(1)
  }
  if (apply && dryRun) {
    console.error('--dry-run 과 --apply 는 동시에 쓸 수 없습니다.')
    process.exit(1)
  }

  await loadEnvFiles()

  const py = path.join(__dirname, 'extract-xlsx-close-volume.py')
  const jsonText = execFileSync('python3', [py, xlsxPath], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const arr = JSON.parse(jsonText)
  const priceByDate = new Map()
  for (const r of arr) {
    const d = String(r.date || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
    if (dateFromOpt && dateToOpt && (d < dateFromOpt || d > dateToOpt)) continue
    priceByDate.set(d, {
      close: Number(r.close),
      volume:
        r.volume != null && Number.isFinite(Number(r.volume))
          ? Math.round(Number(r.volume))
          : null,
    })
  }

  const sortedDates = [...priceByDate.keys()].sort()
  if (sortedDates.length === 0) {
    console.error('xlsx から有効な行がありません')
    process.exit(1)
  }
  const dateFrom = dateFromOpt || sortedDates[0]
  const dateTo = dateToOpt || sortedDates[sortedDates.length - 1]

  console.log(`xlsx: ${priceByDate.size} rows (filter [${dateFrom}..${dateTo}])`)

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

  console.log(`DB 해당 구간 행: ${(dbRows || []).length}, xlsx と日付一致(更新): ${toPatch.length}`)
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
  const inXlsxOnly = [...priceByDate.keys()].filter(
    (d) => !(dbRows || []).some((r) => String(r.trade_date || '').slice(0, 10) === d),
  ).length
  console.log(`DBのみ(スキップ): ${inDbOnly}日, xlsxのみ(挿入なし): ${inXlsxOnly}日`)

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
  console.log(`완료: ${ok}행 update (${symbol}, close+volume만)`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
