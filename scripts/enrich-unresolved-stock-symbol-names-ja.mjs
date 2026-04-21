/**
 * Enrich unresolved ticker-like stock_symbols.name rows.
 *
 * Flow:
 * 1) Query unresolved rows from stock_symbols (ticker-like / empty name)
 * 2) Resolve human-readable names from Yahoo Finance quote API
 * 3) Translate names to Japanese with Gemini (if GEMINI_API_KEY exists)
 * 4) Upsert stock_symbols.name
 *
 * Usage:
 *   node scripts/enrich-unresolved-stock-symbol-names-ja.mjs           # dry-run
 *   node scripts/enrich-unresolved-stock-symbol-names-ja.mjs --apply   # write updates
 */
import fs from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const GEMINI_URL = (apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`

const EXCHANGE_TO_YAHOO_SUFFIX = {
  XLON: 'L',
  XAMS: 'AS',
  XPAR: 'PA',
  XMIL: 'MI',
  XSWX: 'SW',
  XBRU: 'BR',
  XCSE: 'CO',
  XHEL: 'HE',
  XOSL: 'OL',
}

const EXCHANGE_TO_ALIAS_SUFFIX = {
  XLON: 'L',
  XPAR: 'PA',
  XAMS: 'AS',
  XMIL: 'MI',
  XSWX: 'SW',
  XBRU: 'BR',
  XCSE: 'CO',
  XHEL: 'HE',
  XOSL: 'OL',
}

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const normalizeSymbol = (value) => String(value || '').trim().toUpperCase()
const normalizeName = (value) => String(value || '').trim()

const isTickerLikeText = (value, symbol = '') => {
  const t = normalizeName(value)
  const s = normalizeSymbol(symbol)
  if (!t) return true
  if (s && t.toUpperCase() === s) return true
  if (/^\d{3,4}[A-Z]?\.T$/i.test(t)) return true
  if (/^[A-Z]{1,6}([.-][A-Z])?$/i.test(t)) return true
  return false
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

const resolveInternalAliasSymbol = (symbolRaw = '') => {
  const symbol = normalizeSymbol(symbolRaw)
  const m = symbol.match(/^(.+)\.(X[A-Z]{3,4})$/i)
  if (!m) return ''
  const base = String(m[1] || '').toUpperCase()
  const exch = String(m[2] || '').toUpperCase()
  const suffix = EXCHANGE_TO_ALIAS_SUFFIX[exch]
  if (!suffix) return ''
  return `${base}.${suffix}`.toUpperCase()
}

const toYahooSymbol = (symbolRaw = '') => {
  const symbol = normalizeSymbol(symbolRaw)
  if (!symbol) return ''

  // broken format seen in db: 6479.T.1
  if (/^\d{3,4}[A-Z]?\.T\.\d+$/i.test(symbol)) {
    return symbol.replace(/\.T\.\d+$/i, '.T')
  }

  if (/\.[A-Z]{1,4}$/i.test(symbol) && !/\.X[A-Z]{3,4}$/i.test(symbol)) {
    return symbol
  }

  const m = symbol.match(/^(.+)\.(X[A-Z]{3,4})$/i)
  if (!m) return symbol
  const base = String(m[1] || '').toUpperCase()
  const exch = String(m[2] || '').toUpperCase()
  const suffix = EXCHANGE_TO_YAHOO_SUFFIX[exch]
  if (!suffix) return symbol
  return `${base}.${suffix}`
}

const fetchYahooNames = async (symbols = []) => {
  const reqSymbols = [...new Set(symbols.map((s) => toYahooSymbol(s)).filter(Boolean))]
  const result = new Map()
  const chunkSize = 45

  for (let i = 0; i < reqSymbols.length; i += chunkSize) {
    const chunk = reqSymbols.slice(i, i + chunkSize)
    const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(chunk.join(','))}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 MoneyMart/1.0',
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      if (res.status === 429) {
        await sleep(1200)
        continue
      }
      await sleep(250)
      continue
    }
    const json = await res.json().catch(() => null)
    const rows = json?.quoteResponse?.result
    if (!Array.isArray(rows)) continue

    for (const row of rows) {
      const key = normalizeSymbol(row?.symbol)
      const name = normalizeName(row?.longName || row?.shortName || row?.displayName || '')
      if (!key || !name) continue
      result.set(key, name)
    }
    await sleep(120)
  }
  return result
}

const parseGeminiJsonObject = (text = '') => {
  const raw = String(text || '').trim()
  if (!raw) return null
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

const translateNamesToJapanese = async (englishNames = [], apiKey = '') => {
  const out = new Map()
  if (!apiKey) return out
  const unique = [...new Set(englishNames.map((n) => normalizeName(n)).filter(Boolean))]
  const batchSize = 40

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize)
    const prompt = [
      'You are a financial instrument naming translator for Japanese UI.',
      'Translate each input company/fund/security name into natural Japanese.',
      'Rules:',
      '- Keep ticker-like tokens or legal suffixes as needed (ETF, plc, SA, NV etc.)',
      '- Prefer well-known Japanese financial media naming style',
      '- Do NOT add explanations.',
      '- Return ONLY valid JSON object: {"translations":[{"en":"...","ja":"..."}]}',
      '',
      `Input names JSON: ${JSON.stringify(batch)}`,
    ].join('\n')

    const res = await fetch(GEMINI_URL(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    })
    if (!res.ok) {
      await sleep(400)
      continue
    }
    const json = await res.json().catch(() => null)
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('\n') || ''
    const parsed = parseGeminiJsonObject(text)
    const rows = parsed?.translations
    if (!Array.isArray(rows)) {
      await sleep(250)
      continue
    }
    for (const row of rows) {
      const en = normalizeName(row?.en)
      const ja = normalizeName(row?.ja)
      if (!en || !ja) continue
      out.set(en, ja)
    }
    await sleep(200)
  }
  return out
}

const main = async () => {
  await loadEnv()
  const apply = process.argv.slice(2).includes('--apply')
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const geminiKey = process.env.GEMINI_API_KEY || ''

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY')
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const allRows = await fetchAllRows(() =>
    supabase
      .from('stock_symbols')
      .select('symbol,name,exchange')
      .order('symbol', { ascending: true })
  )
  const rowBySymbol = new Map(
    allRows.map((r) => [normalizeSymbol(r?.symbol), { symbol: normalizeSymbol(r?.symbol), name: normalizeName(r?.name) }]),
  )
  const unresolved = allRows.filter((r) => isTickerLikeText(r?.name, r?.symbol))
  const rawSymbols = unresolved.map((r) => normalizeSymbol(r.symbol)).filter(Boolean)

  const yahooNameMapByYahooSymbol = await fetchYahooNames(rawSymbols)
  const symbolToEnglish = new Map()
  for (const sym of rawSymbols) {
    // 1) Internal alias symbol first (e.g. AZN.XLON -> AZN.L)
    const aliasSym = resolveInternalAliasSymbol(sym)
    if (aliasSym) {
      const aliasRow = rowBySymbol.get(aliasSym)
      const internalName = normalizeName(aliasRow?.name || '')
      if (internalName && !isTickerLikeText(internalName, sym)) {
        symbolToEnglish.set(sym, internalName)
        continue
      }
    }

    // 2) Yahoo fallback
    const ySym = toYahooSymbol(sym)
    const yahooName = normalizeName(yahooNameMapByYahooSymbol.get(normalizeSymbol(ySym)) || '')
    if (yahooName && !isTickerLikeText(yahooName, sym)) {
      symbolToEnglish.set(sym, yahooName)
    }
  }

  const englishNames = [...new Set([...symbolToEnglish.values()])]
  const enToJa = await translateNamesToJapanese(englishNames, geminiKey)

  const updates = []
  let jaCount = 0
  let enFallbackCount = 0
  for (const sym of rawSymbols) {
    const en = symbolToEnglish.get(sym)
    if (!en) continue
    const ja = normalizeName(enToJa.get(en) || '')
    const nextName = ja || en
    if (!nextName || isTickerLikeText(nextName, sym)) continue
    updates.push({ symbol: sym, name: nextName })
    if (ja) jaCount += 1
    else enFallbackCount += 1
  }

  const dedup = [...new Map(updates.map((r) => [r.symbol, r])).values()]
  const unresolvedAfterEstimate = Math.max(0, unresolved.length - dedup.length)

  console.log(`unresolved current: ${unresolved.length}`)
  console.log(`resolved names (internal alias + yahoo): ${symbolToEnglish.size}`)
  console.log(`japanese translated: ${jaCount}`)
  console.log(`english fallback used: ${enFallbackCount}`)
  console.log(`updatable now: ${dedup.length}`)
  console.log(`estimated unresolved after apply: ${unresolvedAfterEstimate}`)
  console.log('sample:', dedup.slice(0, 20))

  if (!apply) {
    console.log('dry-run complete. Use --apply to write updates.')
    return
  }
  if (dedup.length === 0) {
    console.log('nothing to update.')
    return
  }

  const chunkSize = 500
  let written = 0
  for (let i = 0; i < dedup.length; i += chunkSize) {
    const chunk = dedup.slice(i, i + chunkSize)
    const { error } = await supabase.from('stock_symbols').upsert(chunk, { onConflict: 'symbol' })
    if (error) throw error
    written += chunk.length
  }
  console.log(`updated: ${written}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

