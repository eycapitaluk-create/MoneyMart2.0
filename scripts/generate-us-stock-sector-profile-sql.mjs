/**
 * Generate Supabase SQL patch for US stock sectors from "SPX data check" workbook.
 *
 * Uses the right-side ticker/sector table (data!Ticker_1 + data!Sector), not the
 * left-side price rows, because those row orders can differ.
 *
 * Usage:
 *   node scripts/generate-us-stock-sector-profile-sql.mjs "/Users/justinnam/Downloads/SPX data check (1).xlsx"
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { STOCK_LIST_400 } from '../src/data/stockList400.js'
import { STOCK_MARKET_PAGE_EXTRA_SYMBOLS } from '../src/data/stockMarketPageExtras.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const DEFAULT_XLSX = '/Users/justinnam/Downloads/SPX data check (1).xlsx'

const GICS_EN_TO_JA = {
  'Communication Services': 'コミュニケーション',
  'Consumer Discretionary': '一般消費財',
  'Consumer Staples': '生活必需品',
  Energy: 'エネルギー',
  Financials: '金融',
  'Health Care': 'ヘルスケア',
  Industrials: '資本財・産業',
  'Information Technology': 'テクノロジー',
  Materials: '素材',
  'Real Estate': '不動産',
  Utilities: '公益',
}

const MANUAL_SECTOR_OVERRIDES = {
  MMC: {
    sectorEn: 'Financials',
    sectorJa: '金融',
    name: 'Marsh & McLennan',
    reason: 'Manual override from user-provided missing-sector table',
  },
  ALNY: {
    sectorEn: 'Health Care',
    sectorJa: 'ヘルスケア',
    name: 'Alnylam Pharmaceuticals',
    reason: 'Manual override from user-provided missing-sector table',
  },
  ASML: {
    sectorEn: 'Information Technology',
    sectorJa: 'テクノロジー',
    name: 'ASML Holding',
    reason: 'Manual override from user-provided missing-sector table',
  },
  AZN: {
    sectorEn: 'Health Care',
    sectorJa: 'ヘルスケア',
    name: 'AstraZeneca',
    reason: 'Manual override from user-provided missing-sector table',
  },
  ENPH: {
    sectorEn: 'Information Technology',
    sectorJa: 'テクノロジー',
    name: 'Enphase Energy',
    reason: 'Manual override from user-provided missing-sector table',
  },
  GFS: {
    sectorEn: 'Information Technology',
    sectorJa: 'テクノロジー',
    name: 'GlobalFoundries',
    reason: 'Manual override from user-provided missing-sector table',
  },
  ILMN: {
    sectorEn: 'Health Care',
    sectorJa: 'ヘルスケア',
    name: 'Illumina',
    reason: 'Manual override from user-provided missing-sector table',
  },
  JD: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'JD.com',
    reason: 'Manual override from user-provided missing-sector table',
  },
  LCID: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'Lucid Group',
    reason: 'Manual override from user-provided missing-sector table',
  },
  MDB: {
    sectorEn: 'Information Technology',
    sectorJa: 'テクノロジー',
    name: 'MongoDB',
    reason: 'Manual override from user-provided missing-sector table',
  },
  MELI: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'MercadoLibre',
    reason: 'Manual override from user-provided missing-sector table',
  },
  MRVL: {
    sectorEn: 'Information Technology',
    sectorJa: 'テクノロジー',
    name: 'Marvell Technology',
    reason: 'Manual override from user-provided missing-sector table',
  },
  OKTA: {
    sectorEn: 'Information Technology',
    sectorJa: 'テクノロジー',
    name: 'Okta',
    reason: 'Manual override from user-provided missing-sector table',
  },
  PDD: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'PDD Holdings',
    reason: 'Manual override from user-provided missing-sector table',
  },
  SIRI: {
    sectorEn: 'Communication Services',
    sectorJa: 'コミュニケーション',
    name: 'Sirius XM',
    reason: 'Manual override from user-provided missing-sector table',
  },
  TEAM: {
    sectorEn: 'Information Technology',
    sectorJa: 'テクノロジー',
    name: 'Atlassian',
    reason: 'Manual override from user-provided missing-sector table',
  },
  ZS: {
    sectorEn: 'Information Technology',
    sectorJa: 'テクノロジー',
    name: 'Zscaler',
    reason: 'Manual override from user-provided missing-sector table',
  },
  BIO: {
    sectorEn: 'Health Care',
    sectorJa: 'ヘルスケア',
    name: 'Bio-Rad Laboratories',
    reason: 'Manual override from user-provided missing-sector table',
  },
  BWA: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'BorgWarner',
    reason: 'Manual override from user-provided missing-sector table',
  },
  CZR: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'Caesars Entertainment',
    reason: 'Manual override from user-provided missing-sector table',
  },
  KMX: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'CarMax',
    reason: 'Manual override from user-provided missing-sector table',
  },
  CE: {
    sectorEn: 'Materials',
    sectorJa: '素材',
    name: 'Celanese',
    reason: 'Manual override from user-provided missing-sector table',
  },
  CNX: {
    sectorEn: 'Energy',
    sectorJa: 'エネルギー',
    name: 'CNX Resources',
    reason: 'Manual override from user-provided missing-sector table',
  },
  CTRA: {
    sectorEn: 'Energy',
    sectorJa: 'エネルギー',
    name: 'Coterra Energy',
    reason: 'Manual override from user-provided missing-sector table',
  },
  DAY: {
    sectorEn: 'Industrials',
    sectorJa: '資本財・産業',
    name: 'Dayforce',
    reason: 'Manual override from user-provided missing-sector table',
  },
  EMN: {
    sectorEn: 'Materials',
    sectorJa: '素材',
    name: 'Eastman Chemical',
    reason: 'Manual override from user-provided missing-sector table',
  },
  ETSY: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'Etsy',
    reason: 'Manual override from user-provided missing-sector table',
  },
  HOLX: {
    sectorEn: 'Health Care',
    sectorJa: 'ヘルスケア',
    name: 'Hologic',
    reason: 'Manual override from user-provided missing-sector table',
  },
  LW: {
    sectorEn: 'Consumer Staples',
    sectorJa: '生活必需品',
    name: 'Lamb Weston',
    reason: 'Manual override from user-provided missing-sector table',
  },
  LNC: {
    sectorEn: 'Financials',
    sectorJa: '金融',
    name: 'Lincoln National',
    reason: 'Manual override from user-provided missing-sector table',
  },
  LKQ: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'LKQ Corporation',
    reason: 'Manual override from user-provided missing-sector table',
  },
  MKTX: {
    sectorEn: 'Financials',
    sectorJa: '金融',
    name: 'MarketAxess',
    reason: 'Manual override from user-provided missing-sector table',
  },
  MTCH: {
    sectorEn: 'Communication Services',
    sectorJa: 'コミュニケーション',
    name: 'Match Group',
    reason: 'Manual override from user-provided missing-sector table',
  },
  MHK: {
    sectorEn: 'Consumer Discretionary',
    sectorJa: '一般消費財',
    name: 'Mohawk Industries',
    reason: 'Manual override from user-provided missing-sector table',
  },
  MOH: {
    sectorEn: 'Health Care',
    sectorJa: 'ヘルスケア',
    name: 'Molina Healthcare',
    reason: 'Manual override from user-provided missing-sector table',
  },
  PAYC: {
    sectorEn: 'Industrials',
    sectorJa: '資本財・産業',
    name: 'Paycom Software',
    reason: 'Manual override from user-provided missing-sector table',
  },
  QRVO: {
    sectorEn: 'Information Technology',
    sectorJa: 'テクノロジー',
    name: 'Qorvo',
    reason: 'Manual override from user-provided missing-sector table',
  },
  TFX: {
    sectorEn: 'Health Care',
    sectorJa: 'ヘルスケア',
    name: 'Teleflex',
    reason: 'Manual override from user-provided missing-sector table',
  },
  VNO: {
    sectorEn: 'Real Estate',
    sectorJa: '不動産',
    name: 'Vornado Realty Trust',
    reason: 'Manual override from user-provided missing-sector table',
  },
}

const normalizeTickerForDb = (raw) => {
  const u = String(raw ?? '').trim().toUpperCase()
  if (!u) return ''
  if (u === 'BRK/B' || u === 'BRK-B') return 'BRK.B'
  if (u === 'BF/B' || u === 'BF-B' || u === 'BF.B') return 'BF-B'
  if (u.includes('/')) return u.replace(/\//g, '-')
  return u
}

const sqlLiteral = (value) => {
  if (value == null || value === '') return 'null'
  return `'${String(value).replace(/'/g, "''")}'`
}

const parseArgs = () => {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const outArg = process.argv.find((arg) => arg.startsWith('--out='))
  const auditArg = process.argv.find((arg) => arg.startsWith('--audit='))
  return {
    xlsxPath: path.resolve(positional[0] || DEFAULT_XLSX),
    outPath: outArg
      ? path.resolve(outArg.slice('--out='.length))
      : path.join(root, 'reports', `SUPABASE_PATCH_us_stock_sectors_from_spx_${new Date().toISOString().slice(0, 10)}.sql`),
    auditPath: auditArg
      ? path.resolve(auditArg.slice('--audit='.length))
      : path.join(root, 'reports', `US_STOCK_SECTORS_FROM_SPX_AUDIT_${new Date().toISOString().slice(0, 10)}.tsv`),
  }
}

const buildUsUniverse = () => {
  const seen = new Set()
  const out = []
  STOCK_LIST_400.forEach((row, idx) => {
    const symbol = normalizeTickerForDb(row.symbol)
    if (!symbol || row.region !== 'US' || seen.has(symbol)) return
    seen.add(symbol)
    out.push({ symbol, source: 'STOCK_LIST_400', priority: (idx + 1) * 10 })
  })
  STOCK_MARKET_PAGE_EXTRA_SYMBOLS.forEach((raw, idx) => {
    const symbol = normalizeTickerForDb(raw)
    if (!symbol || seen.has(symbol)) return
    seen.add(symbol)
    out.push({ symbol, source: 'stockMarketPageExtras', priority: 50_000 + ((idx + 1) * 10) })
  })
  return out
}

const readSectorMap = (xlsxPath) => {
  const wb = XLSX.readFile(xlsxPath)
  const ws = wb.Sheets.data || wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false })
  const map = new Map()
  const unknown = new Set()
  for (const row of rows) {
    const symbol = normalizeTickerForDb(row.Ticker_1 || row.Check || row.Ticker)
    const sectorEn = String(row.Sector || '').trim()
    if (!symbol || !sectorEn) continue
    const sectorJa = GICS_EN_TO_JA[sectorEn]
    if (!sectorJa) {
      unknown.add(sectorEn)
      continue
    }
    map.set(symbol, { sectorEn, sectorJa, name: String(row.Name || '').trim() })
  }
  if (unknown.size) throw new Error(`Unknown GICS sectors: ${[...unknown].sort().join(', ')}`)
  return map
}

const { xlsxPath, outPath, auditPath } = parseArgs()
const sectorMap = readSectorMap(xlsxPath)
const universe = buildUsUniverse()
const matched = []
const auditRows = []

for (const item of universe) {
  const sector = sectorMap.get(item.symbol) || MANUAL_SECTOR_OVERRIDES[item.symbol]
  if (!sector) {
    auditRows.push({ ...item, status: 'missing_sector', sectorEn: '', sectorJa: '', name: '' })
    continue
  }
  matched.push({ ...item, ...sector })
  auditRows.push({ ...item, status: MANUAL_SECTOR_OVERRIDES[item.symbol] ? 'manual_override' : 'matched', ...sector })
}

const lines = [
  '-- Generated by scripts/generate-us-stock-sector-profile-sql.mjs',
  `-- Source: ${xlsxPath}`,
  `-- Scope: StockPage US stocks. Matched ${matched.length}/${universe.length}; missing ${universe.length - matched.length}.`,
  '-- Fixes sectors using right-side Ticker_1/Sector mapping from the workbook.',
  'begin;',
  'insert into public.stock_symbol_profiles (symbol, region, asset_type, sector, industry, priority)',
  'values',
  matched.map((row) => `  (${sqlLiteral(row.symbol)}, 'US', 'stock', ${sqlLiteral(row.sectorJa)}, ${sqlLiteral(row.name)}, ${row.priority})`).join(',\n'),
  'on conflict (symbol) do update',
  'set region = excluded.region,',
  '    asset_type = excluded.asset_type,',
  '    sector = excluded.sector,',
  '    industry = coalesce(nullif(excluded.industry, \'\'), stock_symbol_profiles.industry),',
  '    priority = least(stock_symbol_profiles.priority, excluded.priority),',
  '    updated_at = now();',
  'commit;',
]

const auditHeader = ['symbol', 'status', 'sector_en', 'sector_ja', 'name', 'source', 'priority']
const auditText = [
  auditHeader.join('\t'),
  ...auditRows.map((row) => [
    row.symbol,
    row.status,
    row.sectorEn || '',
    row.sectorJa || '',
    row.name || '',
    row.source,
    row.priority,
  ].join('\t')),
].join('\n')

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.mkdirSync(path.dirname(auditPath), { recursive: true })
fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8')
fs.writeFileSync(auditPath, `${auditText}\n`, 'utf8')
console.log(JSON.stringify({
  outPath,
  auditPath,
  universe: universe.length,
  matched: matched.length,
  missing: universe.length - matched.length,
  sample: matched.filter((row) => ['GOOGL', 'META', 'AAPL'].includes(row.symbol)),
}, null, 2))
