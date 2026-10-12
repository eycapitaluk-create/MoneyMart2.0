/**
 * StockPage と同じ母集団・セクター正規化で、米国/日本の銘柄マスタ TSV を出力。
 *
 *   node scripts/export-stock-page-sector-master.mjs [--out=reports/STOCK_PAGE_SECTOR_MASTER.tsv]
 *
 * 列: region, symbol, name_ja, name_en, sector_app, sector_db, industry
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { STOCK_LIST_400 } from '../src/data/stockList400.js'
import { STOCK_MARKET_PAGE_EXTRA_SYMBOLS } from '../src/data/stockMarketPageExtras.js'
import { isRetiredStockSymbol } from '../src/lib/retiredStockSymbols.js'
import {
  STOCK_SECTOR_OVERRIDE_BY_SYMBOL,
  normalizeSectorName,
} from '../src/lib/stockSectorNormalize.js'

/** StockPage サイドバーに出る11セクター（ETF/未分類以外） */
export const APP_STANDARD_SECTORS = [
  'エネルギー',
  'コミュニケーション',
  'テクノロジー',
  'ヘルスケア',
  '一般消費財',
  '金融',
  '資本財・産業',
  '生活必需品',
  '素材',
  '電力・ガス',
  '不動産',
]

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

const parseOutFlag = () => {
  const arg = process.argv.find((a) => a.startsWith('--out='))
  return arg ? arg.slice('--out='.length) : 'reports/STOCK_PAGE_SECTOR_MASTER.tsv'
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const escapeTsv = (s) => {
  const x = String(s ?? '')
  if (/[\t\n\r"]/.test(x)) return `"${x.replace(/"/g, '""')}"`
  return x
}

/** etfListFromXlsx は Vite 依存があるため、StockPage と同じ ETF 除外は blocklist ファイルから読む */
const loadEtfAndBlocklist = async () => {
  const etfSet = new Set()
  const blocklist = new Set()
  try {
    const raw = await fs.readFile('src/data/etfListFromXlsx.js', 'utf8')
    for (const m of raw.matchAll(/ETF_SYMBOLS_FROM_XLSX\s*=\s*\[([\s\S]*?)\]/)) {
      for (const sym of m[1].matchAll(/'([^']+)'/g)) etfSet.add(sym[1].toUpperCase())
    }
    for (const m of raw.matchAll(/MARKETSTACK_BLOCKLIST_EXPORT\s*=\s*new Set\(\[([\s\S]*?)\]\)/)) {
      for (const sym of m[1].matchAll(/'([^']+)'/g)) blocklist.add(sym[1].toUpperCase())
    }
  } catch {}
  return { etfSet, blocklist }
}

const inferLiveRegion = (code, exchange) => {
  if (/^\d{4}(\.T)?$/i.test(code || '')) return 'JP'
  if (/\.T$/i.test(code || '')) return 'JP'
  if (/tokyo|jpx|xtks|xjpx|tse|japan/i.test(exchange || '')) return 'JP'
  return 'US'
}

const applyProfiles = (baseMap, profileRows) => {
  const profileBySymbol = new Map(profileRows.map((r) => [r.symbol, r]))
  for (const [code, base] of baseMap) {
    const profile = profileBySymbol.get(code)
    if (profile) {
      base.sector_db = profile.sector || ''
      base.industry = profile.industry || ''
      if (profile.name_jp) base.name_ja = profile.name_jp
      if (profile.name_en) base.name_en = profile.name_en
      if (profile.sector) base.sector_app = normalizeSectorName(profile.sector)
    }
    const ov = STOCK_SECTOR_OVERRIDE_BY_SYMBOL.get(code)
    if (ov) base.sector_app = ov
  }
}

const run = async () => {
  await loadEnv()
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) throw new Error('Missing Supabase credentials')

  const { etfSet, blocklist } = await loadEtfAndBlocklist()
  const isExcluded = (sym) => etfSet.has(sym) || blocklist.has(sym) || isRetiredStockSymbol(sym)

  const staticRows = STOCK_LIST_400.filter(
    (item) => (item?.region === 'US' || item?.region === 'JP')
      && item?.symbol
      && !isExcluded(String(item.symbol).toUpperCase()),
  )

  const baseMap = new Map()
  for (const item of staticRows) {
    const sym = String(item.symbol).trim().toUpperCase()
    baseMap.set(sym, {
      region: item.region || 'US',
      symbol: sym,
      name_ja: '',
      name_en: item.name && item.name !== sym ? item.name : '',
      sector_app: normalizeSectorName(item.sector),
      sector_db: '',
      industry: '',
    })
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const staticSymbolSet = new Set(baseMap.keys())
  const extraAllowlist = STOCK_MARKET_PAGE_EXTRA_SYMBOLS.map((s) => String(s).trim().toUpperCase())

  /** extras: allowlist 内で static に無く v_stock_latest 終値あり */
  const extraCandidates = extraAllowlist.filter((s) => !staticSymbolSet.has(s))
  const extraWithPrice = []
  for (const batch of chunk(extraCandidates, 60)) {
    const { data, error } = await supabase
      .from('v_stock_latest')
      .select('symbol,close')
      .in('symbol', batch)
    if (error) throw error
    for (const row of data || []) {
      const sym = String(row.symbol || '').trim().toUpperCase()
      const c = Number(row.close)
      if (!sym || !Number.isFinite(c) || c <= 0) continue
      extraWithPrice.push(sym)
    }
  }

  for (const sym of extraWithPrice) {
    if (baseMap.has(sym)) continue
    const { data: meta } = await supabase
      .from('stock_symbols')
      .select('symbol,name,exchange')
      .eq('symbol', sym)
      .maybeSingle()
    const region = inferLiveRegion(sym, meta?.exchange)
    if (region !== 'US' && region !== 'JP') continue
    baseMap.set(sym, {
      region,
      symbol: sym,
      name_ja: '',
      name_en: meta?.name && meta.name !== sym ? meta.name : '',
      sector_app: '未分類',
      sector_db: '',
      industry: '',
    })
  }

  const targetSymbols = [...baseMap.keys()]
  const profileRows = []
  for (const batch of chunk(targetSymbols, 100)) {
    const { data, error } = await supabase
      .from('stock_symbol_profiles')
      .select('symbol,sector,industry,name_jp,name_en,asset_type')
      .in('symbol', batch)
    if (error) throw error
    profileRows.push(...(data || []))
  }
  applyProfiles(baseMap, profileRows)

  /** stock_symbols 名補完 */
  for (const batch of chunk(targetSymbols, 100)) {
    const { data, error } = await supabase
      .from('stock_symbols')
      .select('symbol,name')
      .in('symbol', batch)
    if (error) throw error
    for (const row of data || []) {
      const sym = String(row.symbol || '').trim().toUpperCase()
      const base = baseMap.get(sym)
      if (!base) continue
      if (!base.name_en && row.name && row.name !== sym) base.name_en = row.name
    }
  }

  const rows = [...baseMap.values()].sort((a, b) => {
    const ra = a.region.localeCompare(b.region)
    if (ra !== 0) return ra
    const sa = a.sector_app.localeCompare(b.sector_app, 'ja')
    if (sa !== 0) return sa
    return a.symbol.localeCompare(b.symbol)
  })

  const outPath = parseOutFlag()
  await fs.mkdir(path.dirname(outPath), { recursive: true })

  const header = ['region', 'symbol', 'name_ja', 'name_en', 'sector_app', 'sector_db', 'industry']
  const lines = [header.join('\t'), ...rows.map((r) => header.map((k) => escapeTsv(r[k])).join('\t'))]
  await fs.writeFile(outPath, `${lines.join('\n')}\n`, 'utf8')

  const summary = {}
  const outliers = []
  for (const r of rows) {
    const key = `${r.region}\t${r.sector_app}`
    summary[key] = (summary[key] || 0) + 1
    if (!APP_STANDARD_SECTORS.includes(r.sector_app)) outliers.push(r)
  }

  const byRegion = { US: 0, JP: 0 }
  for (const r of rows) byRegion[r.region] = (byRegion[r.region] || 0) + 1

  console.log(`Wrote ${rows.length} rows → ${outPath}`)
  console.log(`Totals: US ${byRegion.US} / JP ${byRegion.JP}`)
  console.log('\nSector counts (app display):')
  for (const region of ['US', 'JP']) {
    console.log(`\n[${region}]`)
    const entries = APP_STANDARD_SECTORS.map((sec) => {
      const n = rows.filter((r) => r.region === region && r.sector_app === sec).length
      return `${sec}\t${n}`
    })
    console.log(entries.join('\n'))
    const other = rows.filter((r) => r.region === region && !APP_STANDARD_SECTORS.includes(r.sector_app))
    if (other.length) {
      console.log(`\n⚠ Non-standard sectors (${other.length}):`)
      const g = {}
      for (const r of other) g[r.sector_app] = (g[r.sector_app] || 0) + 1
      console.log(Object.entries(g).map(([k, v]) => `  ${k}: ${v}`).join('\n'))
    }
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
