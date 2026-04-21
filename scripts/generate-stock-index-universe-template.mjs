import fs from 'node:fs/promises'
import path from 'node:path'
import { ETF_SYMBOLS_FROM_XLSX } from '../src/data/etfListFromXlsx.js'

const ETF_SET = new Set(ETF_SYMBOLS_FROM_XLSX)

const parseSeedRows = (sqlText) => {
  const rows = []
  const re = /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']*)',\s*(\d+)\)/g
  let match = re.exec(sqlText)
  while (match) {
    rows.push({
      symbol: match[1],
      region: match[2],
      sector: match[3],
      industry: match[4],
      priority: Number(match[5] || 9999),
    })
    match = re.exec(sqlText)
  }
  return rows
}

const isEtfLike = (row) => {
  if (ETF_SET.has(row.symbol)) return true
  return String(row.sector || '').toLowerCase().includes('etf')
}

const inferIndexTag = (row) => {
  if (row.region === 'US') return 'SP500 or NASDAQ100'
  if (row.region === 'JP') return 'NIKKEI225'
  if (row.region === 'UK') return 'FTSE100'
  if (row.region === 'EU') return 'EUROSTOXX'
  return ''
}

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

const run = async () => {
  const base = path.resolve('.')
  const usSql = await fs.readFile(path.join(base, 'SUPABASE_SEED_STOCK_SYMBOL_PROFILES_US.sql'), 'utf8')
  const intlSql = await fs.readFile(path.join(base, 'SUPABASE_SEED_STOCK_SYMBOL_PROFILES_JP_UK_EU.sql'), 'utf8')
  const parsed = [...parseSeedRows(usSql), ...parseSeedRows(intlSql)]
  const dedup = new Map()
  parsed.forEach((row) => dedup.set(row.symbol, row))
  const stockRows = [...dedup.values()]
    .filter((row) => !isEtfLike(row))
    .sort((a, b) => {
      if (a.region !== b.region) return a.region.localeCompare(b.region)
      return Number(a.priority || 9999) - Number(b.priority || 9999)
    })

  const header = 'symbol,region,asset_type,index_tag,market_cap,sector,industry,priority'
  const body = stockRows
    .map((row) => [
      csvEscape(row.symbol),
      csvEscape(row.region),
      csvEscape('stock'),
      csvEscape(inferIndexTag(row)),
      csvEscape(''),
      csvEscape(row.sector),
      csvEscape(row.industry),
      csvEscape(row.priority),
    ].join(','))
    .join('\n')

  const reportDir = path.resolve('reports')
  await fs.mkdir(reportDir, { recursive: true })
  const outPath = path.join(reportDir, 'stock_index_universe_template.csv')
  await fs.writeFile(outPath, `${header}\n${body}\n`, 'utf8')
  console.log(`Wrote: ${outPath}`)
  console.log(`Rows: ${stockRows.length}`)
}

run().catch((err) => {
  console.error(err?.message || String(err))
  process.exit(1)
})

