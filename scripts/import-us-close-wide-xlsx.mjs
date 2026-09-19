/**
 * Yahoo 등 와이드 시트: 1행 = 티커 열, 2행 = 회사명, 3행 = Date 라벨, 4행~ = 날짜 + 종목별 종가
 *
 *   node scripts/import-us-close-wide-xlsx.mjs /path/to.xlsx [--source=yfinance]
 *
 * --trade-date=YYYY-MM-DD  그 날짜 행만 upsert（전체 적재 시 타임아ウト 방지용）
 * --prices-only           stock_symbols 는 건드리지 않고 stock_daily_prices 만
 *
 * --brk-dot-after=YYYY-MM-DD  BRK.B 만 해당 일 다음 거래일부터 적재 (기본 2026-04-21 → 그 다음일부터)
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 SUPABASE_SECRET_KEY)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

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

const parseFlags = (argv) => {
  const pos = []
  const flags = {}
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1)
      else flags[a.slice(2)] = 'true'
    } else {
      pos.push(a)
    }
  }
  return { pos, flags }
}

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

const cellToTradeDate = (cell) => {
  if (cell == null || cell === '') return null
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return cell.toISOString().slice(0, 10)
  }
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    const d = XLSX.SSF.parse_date_code(cell)
    if (!d) return null
    const dt = new Date(Date.UTC(d.y, d.m - 1, d.d))
    return dt.toISOString().slice(0, 10)
  }
  const s = String(cell).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

/** 헤더 티커 → DB `stock_symbols.symbol` 에 맞춤 */
const normalizeDbSymbol = (rawHeader) => {
  const u = String(rawHeader ?? '').trim().toUpperCase()
  if (!u) return ''
  if (u === 'BRK/B' || u === 'BRK-B') return 'BRK.B'
  if (u === 'BF/B' || u === 'BF-B' || u === 'BF.B') return 'BF-B'
  if (u.includes('/')) return u.replace(/\//g, '-')
  return u
}

const run = async () => {
  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }

  const { pos, flags } = parseFlags(process.argv.slice(2))
  const xlsxPath = pos[0]
  if (!xlsxPath) {
    console.error('Usage: node scripts/import-us-close-wide-xlsx.mjs /path/to.xlsx [--sheet=Close Prices] [--source=yfinance] [--brk-dot-after=2026-04-21]')
    process.exit(1)
  }

  const source = String(flags.source || 'yfinance').trim() || 'yfinance'
  const sheetName = String(flags.sheet || 'Close Prices').trim()
  const brkCutoff = String(flags['brk-dot-after'] || flags.brk_dot_after || '2026-04-21').slice(0, 10)
  const tradeDateOnly = String(flags['trade-date'] || flags.trade_date || '').trim().slice(0, 10)
  const tradeDateFrom = String(flags['trade-date-from'] || flags.trade_date_from || '').trim().slice(0, 10)
  const tradeDateTo = String(flags['trade-date-to'] || flags.trade_date_to || '').trim().slice(0, 10)
  const hasTradeDateFrom = /^\d{4}-\d{2}-\d{2}$/.test(tradeDateFrom)
  const hasTradeDateTo = /^\d{4}-\d{2}-\d{2}$/.test(tradeDateTo)
  const latestOnly = flags.latest === 'true' || flags.latest === '1'
  const noBrkCutoff = flags['no-brk-cutoff'] === 'true' || flags['no-brk-cutoff'] === '1'
  const pricesOnly =
    flags['prices-only'] === 'true'
    || flags['prices-only'] === '1'
    || flags.prices_only === 'true'
    || flags.prices_only === '1'
  const fileBase = path.basename(xlsxPath)

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const ws = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error(`시트 없음: ${sheetName}`)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  if (rows.length < 4) throw new Error('행이 너무 적음')

  const hdr = rows[0] || []
  const namesRow = rows[1] || []
  const normH = (h) => String(h ?? '').normalize('NFKC').trim().toLowerCase()
  /** Numbers 내보내기: col0 Ticker, col1 Date(text), col2~ 심볼 */
  let symbolStartIdx = 1
  const h0 = normH(hdr[0])
  const h1 = normH(hdr[1])
  if (h0 === 'ticker' && (h1 === 'date (text)' || h1.includes('date'))) {
    symbolStartIdx = 2
  }
  /** 데이터는 Date 가 첫 열인 행부터 (보통 인덱스 3) */
  let dataStart = 2
  for (; dataStart < rows.length; dataStart += 1) {
    const d0 = cellToTradeDate(rows[dataStart]?.[0])
    if (d0) break
  }
  if (dataStart >= rows.length) throw new Error('날짜 데이터 시작 행을 찾지 못함')

  const fetchedAt = new Date().toISOString()

  let singleTradeDate = /^\d{4}-\d{2}-\d{2}$/.test(tradeDateOnly) ? tradeDateOnly : ''
  /** --trade-date / --latest 시 해당 행만 스캔（종목×전체일자 루프를 피함） */
  let fixedRowIdx = null
  if (latestOnly) {
    for (let ri = rows.length - 1; ri >= dataStart; ri -= 1) {
      const d = cellToTradeDate(rows[ri]?.[0])
      if (d) {
        fixedRowIdx = ri
        singleTradeDate = d
        break
      }
    }
    if (fixedRowIdx == null) {
      console.log('No data rows with a parseable date (--latest)')
      return
    }
    console.log(`--latest: row index ${fixedRowIdx} → ${singleTradeDate}`)
  } else if (singleTradeDate) {
    for (let ri = dataStart; ri < rows.length; ri += 1) {
      const d = cellToTradeDate(rows[ri]?.[0])
      if (d === singleTradeDate) {
        fixedRowIdx = ri
        break
      }
    }
    if (fixedRowIdx == null) {
      console.log(`No sheet row with trade_date=${singleTradeDate} (파일 최신일은 --latest 로 확인)`)
      return
    }
    console.log(`Single-date mode: row index ${fixedRowIdx} → ${singleTradeDate}`)
  }

  /** @type {{ source: string, symbol: string, trade_date: string, open: number, high: number, low: number, close: number, volume: null, fetched_at: string, raw: object }[]} */
  const priceRows = []

  for (let ci = symbolStartIdx; ci < hdr.length; ci += 1) {
    const rawTicker = hdr[ci]
    const symbol = normalizeDbSymbol(rawTicker)
    if (!symbol) continue
    const displayName = String(namesRow[ci] ?? symbol).trim() || symbol

    const riLo = fixedRowIdx != null ? fixedRowIdx : dataStart
    const riHi = fixedRowIdx != null ? fixedRowIdx + 1 : rows.length

    for (let ri = riLo; ri < riHi; ri += 1) {
      const row = rows[ri]
      if (!row) continue
      const tradeDate = cellToTradeDate(row[0])
      const close = toNum(row[ci])
      if (!tradeDate || close == null || close <= 0) continue

      if (hasTradeDateFrom && tradeDate < tradeDateFrom) continue
      if (hasTradeDateTo && tradeDate > tradeDateTo) continue

      if (!noBrkCutoff && symbol === 'BRK.B' && tradeDate <= brkCutoff) continue

      priceRows.push({
        source,
        symbol,
        trade_date: tradeDate,
        open: close,
        high: close,
        low: close,
        close,
        volume: null,
        fetched_at: fetchedAt,
        raw: {
          imported_from: fileBase,
          wide_sheet: true,
          header_ticker: String(rawTicker ?? '').trim(),
          company_name: displayName,
        },
      })
    }
  }

  const filteredPrices =
    singleTradeDate
      ? priceRows
      : /^\d{4}-\d{2}-\d{2}$/.test(tradeDateOnly)
        ? priceRows.filter((r) => r.trade_date === tradeDateOnly)
        : priceRows

  if (filteredPrices.length === 0) {
    console.log(
      tradeDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(tradeDateOnly)
        ? `No rows for trade_date=${tradeDateOnly}`
        : 'No valid rows',
    )
    return
  }

  const dedup = [...new Map(filteredPrices.map((r) => [`${r.source}|${r.symbol}|${r.trade_date}`, r])).values()]
  const symRows = [...new Map(dedup.map((r) => [r.symbol, r.raw.company_name || r.symbol])).entries()].map(
    ([symbol, name]) => ({ symbol, name: String(name).slice(0, 500), is_active: true }),
  )

  console.log(`Wide import: ${symRows.length} symbols, ${dedup.length} price rows (source=${source}), ${fileBase}`)
  if (tradeDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(tradeDateOnly)) {
    console.log(`Filtered to trade_date=${tradeDateOnly} only`)
  }
  const brkCount = dedup.filter((r) => r.symbol === 'BRK.B').length
  console.log(`BRK.B rows after ${brkCutoff}: ${brkCount}`)

  const supabase = createClient(supabaseUrl, supabaseKey)

  if (!pricesOnly) {
    const symChunk = 200
    for (let i = 0; i < symRows.length; i += symChunk) {
      const { error: symErr } = await supabase
        .from('stock_symbols')
        .upsert(symRows.slice(i, i + symChunk), { onConflict: 'symbol' })
      if (symErr) throw symErr
    }
  } else {
    console.log('Skip stock_symbols upsert (--prices-only)')
  }

  const chunk = 250
  for (let i = 0; i < dedup.length; i += chunk) {
    const batch = dedup.slice(i, i + chunk)
    const { error } = await supabase.from('stock_daily_prices').upsert(batch, { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
  }

  console.log('Done.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
