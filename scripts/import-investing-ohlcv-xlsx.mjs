/**
 * Investing.com 等の Price History xlsx（1行目タイトル、Date/Open/High/Low/Close/Volume ヘッダ）→ stock_daily_prices へ upsert
 *
 *   node scripts/import-investing-ohlcv-xlsx.mjs /path/to.xlsx [symbol] [--source=marketstack] --dry-run
 *   node scripts/import-investing-ohlcv-xlsx.mjs /path/to.xlsx 1306.T --source=marketstack --apply
 *
 * symbol 省略時はファイル名から 1306T / 1306.T を推測。
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

const toNum = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

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

const normalizeHeader = (h) => String(h ?? '').trim().toLowerCase().replace(/\./g, '')

const symbolFromPath = (p) => {
  const base = path.basename(p, path.extname(p))
  const m = base.match(/(\d{3,4}[A-Z]?)\s*T?$/i) || base.match(/^(\d{3,4}[A-Z]?)[._-]/i)
  if (m) return `${m[1].toUpperCase()}.T`
  return null
}

const parseFlags = (argv) => {
  const pos = []
  const flags = {}
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1)
      else flags[a.slice(2)] = 'true'
    } else pos.push(a)
  }
  return { pos, flags }
}

const colIndex = (headerRow, ...names) => {
  const norm = headerRow.map((c) => normalizeHeader(c))
  for (const name of names) {
    const want = normalizeHeader(name)
    const i = norm.findIndex((h) => h === want)
    if (i >= 0) return i
  }
  return -1
}

const run = async () => {
  const { pos, flags } = parseFlags(process.argv.slice(2))
  const dryRun = flags['dry-run'] === 'true'
  const apply = flags.apply === 'true'
  const xlsxPath = pos[0]
  const symbolArg = pos[1] || null

  if (!xlsxPath) {
    console.error(
      'Usage: node scripts/import-investing-ohlcv-xlsx.mjs <file.xlsx> [symbol] [--source=marketstack] --dry-run|--apply',
    )
    process.exit(1)
  }
  if (!apply && !dryRun) {
    console.error('--dry-run または --apply を指定してください')
    process.exit(1)
  }
  if (apply && dryRun) {
    console.error('--dry-run と --apply は同時に使えません')
    process.exit(1)
  }

  const source = flags.source || 'marketstack'
  const symbol = (symbolArg || symbolFromPath(xlsxPath) || '').trim()
  if (!symbol) {
    console.error('シンボルを引数で渡すか、ファイル名に 1306T 形式を含めてください')
    process.exit(1)
  }

  await loadEnv()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }

  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

  let headerIdx = -1
  for (let i = 0; i < rows.length; i += 1) {
    const c0 = String(rows[i]?.[0] ?? '').trim().toLowerCase()
    if (c0 === 'date') {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) throw new Error('Date 列のヘッダ行が見つかりません')

  const header = rows[headerIdx]
  const iDate = colIndex(header, 'Date')
  const iOpen = colIndex(header, 'Open')
  const iHigh = colIndex(header, 'High')
  const iLow = colIndex(header, 'Low')
  const iClose = colIndex(header, 'Close', 'Adj Close', 'AdjClose')
  const iVol = colIndex(header, 'Volume')

  if (iDate < 0 || iClose < 0) throw new Error('Date / Close 列が必要です')

  const fileBase = path.basename(xlsxPath)
  const priceRows = []
  for (let r = headerIdx + 1; r < rows.length; r += 1) {
    const row = rows[r]
    if (!row?.length) continue
    const tradeDate = cellToTradeDate(row[iDate])
    if (!tradeDate) continue
    const close = toNum(row[iClose])
    if (close == null || close <= 0) continue
    const open = iOpen >= 0 ? toNum(row[iOpen]) : null
    const high = iHigh >= 0 ? toNum(row[iHigh]) : null
    const low = iLow >= 0 ? toNum(row[iLow]) : null
    let volume = iVol >= 0 ? toNum(row[iVol]) : null
    if (volume != null) volume = Math.round(volume)

    priceRows.push({
      source,
      symbol,
      trade_date: tradeDate,
      open,
      high,
      low,
      close,
      volume,
      raw: { imported_from: fileBase, format: 'investing_price_history' },
    })
  }

  const dedup = [...new Map(priceRows.map((p) => [`${p.source}|${p.symbol}|${p.trade_date}`, p])).values()].sort(
    (a, b) => a.trade_date.localeCompare(b.trade_date),
  )

  if (dedup.length === 0) {
    console.log('有効な行がありません')
    return
  }

  console.log(`${fileBase} → ${symbol} / source=${source} / ${dedup.length} 行 (期間 ${dedup[0].trade_date} … ${dedup[dedup.length - 1].trade_date})`)

  if (dryRun) {
    console.log('Dry run — DB 書き込みなし')
    dedup.slice(0, 3).forEach((p) => console.log('  sample', p))
    if (dedup.length > 3) console.log('  …')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const displayName =
    symbol === '1306.T'
      ? 'ＴＯＰＩＸ連動型上場投信'
      : symbol

  const { error: symErr } = await supabase
    .from('stock_symbols')
    .upsert({ symbol, name: displayName, is_active: true }, { onConflict: 'symbol' })
  if (symErr) throw symErr

  const BATCH = 200
  let total = 0
  for (let i = 0; i < dedup.length; i += BATCH) {
    const batch = dedup.slice(i, i + BATCH)
    const { error } = await supabase.from('stock_daily_prices').upsert(batch, { onConflict: 'source,symbol,trade_date' })
    if (error) throw error
    total += batch.length
    console.log(`  upsert ${total}/${dedup.length}`)
  }
  console.log(`Done. ${total} rows upserted.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
