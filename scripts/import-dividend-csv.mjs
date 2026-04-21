#!/usr/bin/env node
/**
 * Import dividend_calendar_us_jp.csv into dividendStockUniverse.js
 * Usage: node scripts/import-dividend-csv.mjs [path-to-csv]
 * Default: ~/Downloads/dividend_calendar_us_jp.csv
 */
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const csvPath = process.argv[2] || path.join(process.env.HOME || '', 'Downloads', 'dividend_calendar_us_jp.csv')
const outPath = path.join(root, 'src/data/dividendStockUniverse.js')

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else if (c !== '\r') {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length < 5) continue
    let dividendMonths = (values[4] || '').replace(/^"|"$/g, '')
    const dividendAmountPerShare = values[5] || ''
    if (values.length > 6) {
      dividendMonths = values.slice(4, -1).join(',').replace(/^"|"$/g, '')
    }
    rows.push({
      symbol: values[0] || '',
      name: values[1] || '',
      sector: values[2] || '',
      region: values[3] || '',
      dividendMonths,
      dividendAmountPerShare,
    })
  }
  return rows
}

const content = readFileSync(csvPath, 'utf8')
const rows = parseCSV(content)

const entries = rows.map((r) => {
  const symbol = String(r.symbol || '').trim()
  if (!symbol) return null
  const name = String(r.name || symbol).trim()
  const sector = String(r.sector || 'その他').trim()
  const region = (r.region || '').toUpperCase() === 'JP' ? 'JP' : 'US'
  const indexTag = region === 'JP' ? 'NIKKEI225' : 'SP500'

  let dividendMonths = []
  const monthsStr = String(r.dividendMonths || '').trim()
  if (monthsStr && monthsStr !== '[]') {
    try {
      dividendMonths = JSON.parse(monthsStr)
      if (!Array.isArray(dividendMonths)) dividendMonths = []
    } catch {
      dividendMonths = []
    }
  }

  let dividendAmountPerShare = null
  const amtStr = String(r.dividendAmountPerShare || '').trim()
  if (amtStr) {
    const n = parseFloat(amtStr)
    if (Number.isFinite(n) && n >= 0) dividendAmountPerShare = n
  }

  const entry = {
    symbol,
    name,
    region,
    sector,
    indexTag,
    dividendMonths,
  }
  if (dividendAmountPerShare != null) entry.dividendAmountPerShare = dividendAmountPerShare
  return entry
}).filter(Boolean)

const arrContent = 'export const DIVIDEND_STOCK_UNIVERSE = [\n' +
  entries.map((r) => {
    const lines = [
      `  {`,
      `    "symbol": ${JSON.stringify(r.symbol)},`,
      `    "name": ${JSON.stringify(r.name)},`,
      `    "region": ${JSON.stringify(r.region)},`,
      `    "sector": ${JSON.stringify(r.sector)},`,
      `    "indexTag": ${JSON.stringify(r.indexTag)},`,
      `    "dividendMonths": ${JSON.stringify(r.dividendMonths)}`,
    ]
    if (r.dividendAmountPerShare != null) {
      lines[lines.length - 1] += ','
      lines.push(`    "dividendAmountPerShare": ${r.dividendAmountPerShare}`)
    }
    lines.push(`  }`)
    return lines.join('\n')
  }).join(',\n') +
  '\n]'

const footer = `
const normalizeLookupSymbol = (value = '') => String(value || '').trim().toUpperCase()

const DIVIDEND_STOCK_UNIVERSE_MAP = new Map()
for (const row of DIVIDEND_STOCK_UNIVERSE) {
  const symbol = normalizeLookupSymbol(row?.symbol)
  if (!symbol) continue
  DIVIDEND_STOCK_UNIVERSE_MAP.set(symbol, row)
  if (symbol.endsWith('.T')) {
    const jpCode = symbol.slice(0, -2)
    if (jpCode) DIVIDEND_STOCK_UNIVERSE_MAP.set(jpCode, row)
  }
}

export const lookupDividendStockBySymbol = (inputSymbol) => {
  const key = normalizeLookupSymbol(inputSymbol)
  if (!key) return null
  return DIVIDEND_STOCK_UNIVERSE_MAP.get(key) || null
}

/**
 * Supabase fallback: 銘柄名・セクター・地域を取得（dividendStockUniverse にない銘柄用）
 * @param {string} inputSymbol - ティッカー (例: 8306, 8306.T, KO)
 * @returns {Promise<{ name: string, sector?: string, region?: string } | null>}
 */
export async function fetchStockFromSupabase(inputSymbol) {
  const raw = String(inputSymbol || '').trim().toUpperCase()
  if (!raw) return null
  const candidates = [raw]
  if (/^\\d{4}$/.test(raw)) candidates.push(\`\${raw}.T\`)
  if (raw.endsWith('.T')) candidates.push(raw.slice(0, -2))
  const { supabase } = await import('../lib/supabase')
  for (const sym of candidates) {
    const { data: symbolRows } = await supabase
      .from('stock_symbols')
      .select('symbol,name')
      .in('symbol', [sym])
      .limit(1)
    const symbolRow = symbolRows?.[0]
    if (!symbolRow) continue
    const { data: profileRows } = await supabase
      .from('stock_symbol_profiles')
      .select('symbol,sector,region,name_jp,name_en')
      .eq('symbol', sym)
      .limit(1)
    const profile = profileRows?.[0]
    const name = profile?.name_jp || profile?.name_en || symbolRow?.name || null
    if (!name) continue
    const region = profile?.region === 'JP' ? 'JP' : profile?.region === 'US' ? 'US' : ''
    return { name, sector: profile?.sector || '', region }
  }
  // Supabase にない場合、クライアント側フォールバック（主に米国銘柄）
  const { getStockNameFallback } = await import('./stockNameFallback')
  const fallbackName = getStockNameFallback(raw)
  if (fallbackName) return { name: fallbackName, sector: '', region: 'US' }
  return null
}
`

writeFileSync(outPath, arrContent + footer, 'utf8')

const jpCount = entries.filter((e) => e.region === 'JP').length
const usCount = entries.filter((e) => e.region === 'US').length
const withAmount = entries.filter((e) => e.dividendAmountPerShare != null).length

console.log(`Imported ${entries.length} stocks from ${csvPath}`)
console.log(`  JP: ${jpCount} | US: ${usCount}`)
console.log(`  With dividendAmountPerShare: ${withAmount}`)
console.log(`Wrote ${outPath}`)
