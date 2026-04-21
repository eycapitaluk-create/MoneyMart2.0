/**
 * Fill ticker-like stock_symbols.name with Japanese display names.
 *
 * Priority:
 * 1) stock_symbol_profiles.name_jp
 * 2) ETF_LIST_FROM_XLSX.jpName (JP ETFs)
 * 3) ETF_JP_NAME_MAP (US/global ETFs)
 * 4) stock_symbol_profiles.name_en (fallback when JA unavailable)
 *
 * Usage:
 *   node scripts/fill-stock-symbol-names-ja.mjs           # dry-run
 *   node scripts/fill-stock-symbol-names-ja.mjs --apply   # write updates
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { ETF_LIST_FROM_XLSX } from '../src/data/etfListFromXlsx.js'
import { ETF_JP_NAME_MAP } from '../src/data/etfJpNameMap.js'

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

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase()
const normalizeName = (value) => String(value || '').trim()
const normalizeDisplayName = (value = '') => {
  let s = normalizeName(value)
  if (!s) return ''
  // full-width latin/symbol -> half-width
  s = s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  s = s.normalize('NFKC').replace(/\s+/g, ' ').trim()
  // join single latin/digit tokens: "T O P I X" -> "TOPIX", "i F r e e" -> "iFree"
  s = s.replace(/\b([A-Za-z0-9])\s+(?=[A-Za-z0-9]\b)/g, '$1')
  return s
}

const isTickerLikeText = (value, symbol = '') => {
  const t = normalizeName(value)
  const s = normalizeSymbol(symbol)
  if (!t) return true
  if (s && t.toUpperCase() === s) return true

  // JP ticker style: 1306.T / 159A.T
  if (/^\d{3,4}[A-Z]?\.T$/i.test(t)) return true
  // US/Global ticker style: AAPL / BRK.B / BRK-B
  if (/^[A-Z]{1,6}([.-][A-Z])?$/i.test(t)) return true

  return false
}

const parseFlags = (argv) => {
  const flags = new Set()
  for (const a of argv) {
    if (String(a).startsWith('--')) flags.add(String(a).slice(2))
  }
  return flags
}

const buildNameMapFromLocalSources = () => {
  const m = new Map()

  for (const row of Array.isArray(ETF_LIST_FROM_XLSX) ? ETF_LIST_FROM_XLSX : []) {
    const symbol = normalizeSymbol(row?.symbol)
    const jpName = normalizeDisplayName(row?.jpName)
    if (!symbol || !jpName || isTickerLikeText(jpName, symbol)) continue
    m.set(symbol, jpName)
  }

  for (const [symRaw, nameRaw] of Object.entries(ETF_JP_NAME_MAP || {})) {
    const symbol = normalizeSymbol(symRaw)
    const name = normalizeDisplayName(nameRaw)
    if (!symbol || !name || isTickerLikeText(name, symbol)) continue
    if (!m.has(symbol)) m.set(symbol, name)
  }

  return m
}

const fetchAllRows = async (queryBuilderFactory, pageSize = 1000) => {
  let from = 0
  const rows = []
  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await queryBuilderFactory().range(from, to)
    if (error) throw error
    const batch = Array.isArray(data) ? data : []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

const run = async () => {
  await loadEnv()
  const flags = parseFlags(process.argv.slice(2))
  const apply = flags.has('apply')

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const localNameMap = buildNameMapFromLocalSources()

  const [symbolRows, profileRows] = await Promise.all([
    fetchAllRows(() => supabase.from('stock_symbols').select('symbol,name').order('symbol', { ascending: true })),
    fetchAllRows(() => supabase.from('stock_symbol_profiles').select('symbol,name_jp,name_en').order('symbol', { ascending: true })),
  ])

  const profileNameMap = new Map()
  for (const row of profileRows || []) {
    const symbol = normalizeSymbol(row?.symbol)
    if (!symbol) continue
    const nameJp = normalizeDisplayName(row?.name_jp)
    const nameEn = normalizeDisplayName(row?.name_en)
    if (nameJp && !isTickerLikeText(nameJp, symbol)) {
      profileNameMap.set(symbol, nameJp)
      continue
    }
    if (nameEn && !isTickerLikeText(nameEn, symbol) && !profileNameMap.has(symbol)) {
      profileNameMap.set(symbol, nameEn)
    }
  }

  const updates = []
  let tickerLikeCurrentCount = 0
  let normalizedOnlyCount = 0
  let filledFromMapCount = 0
  for (const row of symbolRows || []) {
    const symbol = normalizeSymbol(row?.symbol)
    const currentName = normalizeName(row?.name)
    const normalizedCurrent = normalizeDisplayName(currentName)
    if (!symbol) continue

    const isTickerLikeCurrent = isTickerLikeText(currentName, symbol)
    if (isTickerLikeCurrent) tickerLikeCurrentCount += 1

    const nextName =
      profileNameMap.get(symbol)
      || localNameMap.get(symbol)
      || ''
    const normalizedNext = normalizeDisplayName(nextName)

    if (isTickerLikeCurrent) {
      if (!normalizedNext || isTickerLikeText(normalizedNext, symbol)) continue
      if (normalizedNext === currentName) continue
      updates.push({ symbol, name: normalizedNext })
      filledFromMapCount += 1
      continue
    }

    // not ticker-like but ugly-spaced/fullwidth -> normalize only
    if (normalizedCurrent && normalizedCurrent !== currentName) {
      updates.push({ symbol, name: normalizedCurrent })
      normalizedOnlyCount += 1
    }
  }

  const dedupMap = new Map()
  for (const row of updates) dedupMap.set(row.symbol, row)
  const dedupUpdates = [...dedupMap.values()]
  const unresolvedTickerCount = Math.max(0, tickerLikeCurrentCount - filledFromMapCount)

  console.log(`scanned: ${(symbolRows || []).length}`)
  console.log(`ticker-like current name: ${tickerLikeCurrentCount}`)
  console.log(`fillable from profile/local maps: ${filledFromMapCount}`)
  console.log(`normalization-only candidates: ${normalizedOnlyCount}`)
  console.log(`total updates (deduped): ${dedupUpdates.length}`)
  console.log(`unresolved ticker-only remaining: ${unresolvedTickerCount}`)
  console.log('sample:', dedupUpdates.slice(0, 20))

  if (!apply) {
    console.log('dry-run complete. Use --apply to write updates.')
    return
  }
  if (dedupUpdates.length === 0) {
    console.log('nothing to update.')
    return
  }

  const chunkSize = 500
  let total = 0
  for (let i = 0; i < dedupUpdates.length; i += chunkSize) {
    const chunk = dedupUpdates.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('stock_symbols')
      .upsert(chunk, { onConflict: 'symbol' })
    if (error) throw error
    total += chunk.length
  }
  console.log(`updated: ${total}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

