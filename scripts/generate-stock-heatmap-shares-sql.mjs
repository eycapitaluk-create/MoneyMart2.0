/**
 * securities_metadata.xlsx -> stock_heatmap_profiles upsert SQL.
 *
 * Scope is intentionally limited to StockPage stock universe:
 * - STOCK_LIST_400 US/JP rows
 * - explicit StockPage extra US symbols
 * - ETF rows are skipped here; ETF AUM can be handled by a separate flow.
 *
 * Usage:
 *   node scripts/generate-stock-heatmap-shares-sql.mjs /Users/justinnam/Downloads/securities_metadata.xlsx
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { STOCK_LIST_400 } from '../src/data/stockList400.js'
import { STOCK_MARKET_PAGE_EXTRA_SYMBOLS } from '../src/data/stockMarketPageExtras.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const DEFAULT_XLSX = '/Users/justinnam/Downloads/securities_metadata.xlsx'
const SOURCE_LABEL = 'securities_metadata.xlsx'
const VALUE_CHUNK_SIZE = 250
const SYMBOL_ALIASES = {
  'BRK.B': 'BRK-B',
  BNY: 'BK',
  MMC: 'MRSH',
}

const sqlLiteral = (value) => {
  if (value == null || value === '') return 'null'
  return `'${String(value).replace(/'/g, "''")}'`
}

const sqlNumber = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'null'
  return String(n)
}

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase()

const parseArgs = () => {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const outArg = process.argv.find((arg) => arg.startsWith('--out='))
  const auditArg = process.argv.find((arg) => arg.startsWith('--audit='))
  const asOfArg = process.argv.find((arg) => arg.startsWith('--as-of='))
  return {
    xlsxPath: path.resolve(positional[0] || DEFAULT_XLSX),
    outPath: outArg
      ? path.resolve(outArg.slice('--out='.length))
      : path.join(root, 'reports', `SUPABASE_PATCH_stock_heatmap_shares_${new Date().toISOString().slice(0, 10)}.sql`),
    auditPath: auditArg
      ? path.resolve(auditArg.slice('--audit='.length))
      : path.join(root, 'reports', `STOCK_HEATMAP_SECURITIES_METADATA_AUDIT_${new Date().toISOString().slice(0, 10)}.tsv`),
    asOf: asOfArg ? asOfArg.slice('--as-of='.length) : new Date().toISOString().slice(0, 10),
  }
}

const buildStockPageUniverse = () => {
  const seen = new Set()
  const rows = []
  STOCK_LIST_400.forEach((row, idx) => {
    const symbol = normalizeSymbol(row.symbol)
    const region = String(row.region || '').trim().toUpperCase()
    if (!symbol || seen.has(symbol)) return
    if (region !== 'US' && region !== 'JP') return
    seen.add(symbol)
    rows.push({
      symbol,
      region,
      source: 'STOCK_LIST_400',
      heatmapPriority: (idx + 1) * 10,
    })
  })

  STOCK_MARKET_PAGE_EXTRA_SYMBOLS.forEach((raw, idx) => {
    const symbol = normalizeSymbol(raw)
    if (!symbol || seen.has(symbol)) return
    seen.add(symbol)
    rows.push({
      symbol,
      region: 'US',
      source: 'stockMarketPageExtras',
      heatmapPriority: 50_000 + ((idx + 1) * 10),
    })
  })

  return rows
}

const readMetadata = (xlsxPath) => {
  const wb = XLSX.readFile(xlsxPath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  const bySymbol = new Map()
  for (const row of rows) {
    const symbol = normalizeSymbol(row.symbol)
    if (!symbol) continue
    bySymbol.set(symbol, {
      symbol,
      name: String(row.name || '').trim(),
      assetType: String(row.asset_type || '').trim().toUpperCase(),
      currency: String(row.currency || '').trim().toUpperCase(),
      sharesOutstanding: Number(row.shares_outstanding),
      aum: Number(row.aum),
    })
  }
  return { rows, bySymbol }
}

const resolveMetadataRow = (symbol, bySymbol) => {
  const direct = bySymbol.get(symbol)
  if (direct) return { row: direct, metadataSymbol: symbol, aliasUsed: '' }
  const alias = SYMBOL_ALIASES[symbol]
  if (!alias) return { row: null, metadataSymbol: '', aliasUsed: '' }
  const aliased = bySymbol.get(alias)
  return aliased ? { row: aliased, metadataSymbol: alias, aliasUsed: alias } : { row: null, metadataSymbol: '', aliasUsed: alias }
}

const buildOutputs = ({ xlsxPath, outPath, auditPath, asOf }) => {
  const { rows: metadataRows, bySymbol } = readMetadata(xlsxPath)
  const universe = buildStockPageUniverse()
  const values = []
  const auditRows = []
  const stats = {
    metadataRows: metadataRows.length,
    universe: universe.length,
    inserted: 0,
    skippedEtf: 0,
    missing: 0,
    missingShares: 0,
    aliasResolved: 0,
  }

  for (const item of universe) {
    const { row, metadataSymbol, aliasUsed } = resolveMetadataRow(item.symbol, bySymbol)
    if (!row) {
      stats.missing += 1
      auditRows.push({ ...item, status: 'missing_metadata', metadataSymbol, aliasUsed, sharesOutstanding: '', currency: '' })
      continue
    }
    if (row.assetType === 'ETF') {
      stats.skippedEtf += 1
      auditRows.push({ ...item, status: 'skipped_etf', metadataSymbol, aliasUsed, sharesOutstanding: '', currency: row.currency })
      continue
    }
    if (row.assetType !== 'STOCK' || !(row.sharesOutstanding > 0)) {
      stats.missingShares += 1
      auditRows.push({ ...item, status: 'missing_shares', metadataSymbol, aliasUsed, sharesOutstanding: '', currency: row.currency })
      continue
    }

    if (aliasUsed) stats.aliasResolved += 1
    stats.inserted += 1
    auditRows.push({
      ...item,
      status: aliasUsed ? 'matched_alias' : 'matched',
      metadataSymbol,
      aliasUsed,
      sharesOutstanding: row.sharesOutstanding,
      currency: row.currency,
    })
    values.push([
      sqlLiteral(item.symbol),
      sqlLiteral('STOCK'),
      sqlNumber(row.sharesOutstanding),
      sqlLiteral(row.currency || (item.region === 'JP' ? 'JPY' : 'USD')),
      sqlLiteral(asOf),
      sqlNumber(item.heatmapPriority),
      sqlLiteral(SOURCE_LABEL),
      sqlLiteral(aliasUsed ? `metadata_symbol=${metadataSymbol}` : null),
    ])
  }

  const lines = [
    '-- Generated by scripts/generate-stock-heatmap-shares-sql.mjs',
    `-- Source: ${xlsxPath}`,
    `-- Scope: StockPage US/JP stocks only. Inserted ${stats.inserted}/${stats.universe}; aliases ${stats.aliasResolved}; missing ${stats.missing}; missing shares ${stats.missingShares}; skipped ETF ${stats.skippedEtf}.`,
    '-- Run SUPABASE_SETUP_STOCK_HEATMAP_MARKET_CAP.sql before this patch.',
    'begin;',
  ]

  for (let i = 0; i < values.length; i += VALUE_CHUNK_SIZE) {
    const chunk = values.slice(i, i + VALUE_CHUNK_SIZE)
    lines.push(
      'insert into public.stock_heatmap_profiles (',
      '  symbol,',
      '  asset_type,',
      '  shares_outstanding,',
      '  metadata_currency,',
      '  market_cap_as_of,',
      '  heatmap_priority,',
      '  source,',
      '  notes',
      ')',
      'values',
      `${chunk.map((cols) => `  (${cols.join(', ')})`).join(',\n')}`,
      'on conflict (symbol) do update',
      'set asset_type = excluded.asset_type,',
      '    shares_outstanding = excluded.shares_outstanding,',
      '    metadata_currency = excluded.metadata_currency,',
      '    market_cap_as_of = excluded.market_cap_as_of,',
      '    heatmap_priority = excluded.heatmap_priority,',
      '    source = excluded.source,',
      '    notes = excluded.notes,',
      '    heatmap_enabled = true,',
      '    updated_at = now();',
    )
  }
  lines.push('commit;')

  const auditHeader = [
    'symbol',
    'region',
    'source',
    'status',
    'metadata_symbol',
    'alias_used',
    'shares_outstanding',
    'currency',
    'heatmap_priority',
  ]
  const auditText = [
    auditHeader.join('\t'),
    ...auditRows.map((row) => [
      row.symbol,
      row.region,
      row.source,
      row.status,
      row.metadataSymbol || '',
      row.aliasUsed || '',
      row.sharesOutstanding || '',
      row.currency || '',
      row.heatmapPriority,
    ].join('\t')),
  ].join('\n')

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.mkdirSync(path.dirname(auditPath), { recursive: true })
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8')
  fs.writeFileSync(auditPath, `${auditText}\n`, 'utf8')
  return { stats, outPath, auditPath }
}

const result = buildOutputs(parseArgs())
console.log(JSON.stringify(result, null, 2))
