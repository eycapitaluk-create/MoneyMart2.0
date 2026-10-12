import { getEtfJpName } from '../data/etfJpNameMap.js'
import { getEtfListedJaName } from '../data/etfListedJaNameMap.js'
import { getEtfListedNisaCategory } from '../data/etfListedNisaMap.js'
import { normalizeFundDisplayNamePlain, normalizeNisaCategoryField } from './textEncodingUtils.js'

/**
 * Decodes HTML entities in plain-text labels (e.g. "S&amp;P" → "S&P").
 * For React text nodes only — do not use the result as HTML.
 */
export function decodeHtmlEntities(value = '') {
  const s = String(value ?? '')
  if (!s || !/&[#a-z0-9]+;/i.test(s)) return s
  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea')
    el.innerHTML = s
    return el.value
  }
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x([0-9a-f]{1,6});/gi, (full, h) => {
      const code = parseInt(h, 16)
      if (!Number.isFinite(code) || code < 0) return full
      try {
        return String.fromCodePoint(code)
      } catch {
        return full
      }
    })
    .replace(/&#(\d{1,7});/g, (full, d) => {
      const code = parseInt(d, 10)
      if (!Number.isFinite(code) || code < 0) return full
      try {
        return String.fromCodePoint(code)
      } catch {
        return full
      }
    })
}

/**
 * Normalizes fund display names for consistent rendering.
 * - Decodes HTML entities (e.g. from DB/API)
 * - Converts full-width (zenkaku) alphanumeric to half-width to prevent "spaced apart" letters
 * - Joins single-letter tokens (e.g. "T O P I X" -> "TOPIX")
 */
export const normalizeFundDisplayName = (value = '') => {
  const s = decodeHtmlEntities(String(value || '').trim())
  if (!s) return ''
  return normalizeFundDisplayNamePlain(s)
}

const JP_CHAR_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/

/** Align DB/API symbols with app universe keys (e.g. 1301.XTKS → 1301.T) */
export function normalizeFundSymbolKey(s) {
  if (!s || typeof s !== 'string') return s
  const t = s.trim()
  if (t.endsWith('.XTKS')) return `${t.slice(0, -5)}.T`
  if (t.endsWith('.XLON')) return `${t.slice(0, -5)}.L`
  return t
}

/** Supabase may store the same listing as CODE.T or CODE.XTKS — query both. */
export function fundSymbolLookupVariants(sym) {
  const raw = String(sym || '').trim()
  if (!raw) return []
  const upper = raw.toUpperCase()
  const norm = String(normalizeFundSymbolKey(upper))
  const set = new Set([raw, upper, norm])
  if (upper.endsWith('.T')) set.add(`${upper.slice(0, -2)}.XTKS`)
  if (upper.endsWith('.XTKS')) set.add(`${upper.slice(0, -5)}.T`)
  return [...set].filter(Boolean)
}

export function pickStockMetaRow(rows, preferredSymbol) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) return {}
  const pref = String(preferredSymbol || '').trim().toUpperCase()
  const normKey = normalizeFundSymbolKey(pref)
  return (
    list.find((r) => String(r?.symbol || '').trim().toUpperCase() === pref)
    || list.find((r) => normalizeFundSymbolKey(String(r?.symbol || '').trim().toUpperCase()) === normKey)
    || list[0]
  )
}

/**
 * NISA区分: DB → ローカルstub → JP上場CSV（etfListedNisaMap）
 */
export function resolveFundNisaCategory(symbol, dbNisa, etfStubNisa = null) {
  const fromDb = normalizeNisaCategoryField(dbNisa)
  if (fromDb !== '-') return fromDb
  const fromStub = normalizeNisaCategoryField(etfStubNisa)
  if (fromStub !== '-') return fromStub
  const sym = String(symbol || '').trim()
  const key = normalizeFundSymbolKey(sym)
  const listed = getEtfListedNisaCategory(key) || getEtfListedNisaCategory(sym)
  return normalizeNisaCategoryField(listed)
}

/**
 * Prefer human-readable JP labels:
 * US ticker map → JP上場CSV名 → stock_symbol_profiles.name_jp → stock_symbols.name (if Japanese) → xlsx stub (if Japanese)
 * → stock_symbols.name → profiles.name_en → xlsx stub → symbol.
 * Avoids ticker-only rows when profiles carry Japanese names but stock_symbols.name is empty.
 */
export function resolveFundDisplayName(symbol, meta = {}, etfMeta = null, profile = null) {
  const sym = String(symbol || '').trim()
  if (!sym) return ''
  const metaName = String(meta?.name ?? '').trim()
  const stubJp = etfMeta?.jpName != null ? String(etfMeta.jpName).trim() : ''
  const profJp = profile?.name_jp != null ? String(profile.name_jp).trim() : ''
  const profEn = profile?.name_en != null ? String(profile.name_en).trim() : ''
  const symKey = normalizeFundSymbolKey(sym)
  // JP上場CSVの正式和名を最優先（米株ティッカー向け別マップより先）
  const listedJa =
    getEtfListedJaName(symKey) || getEtfListedJaName(sym)
  const mapped = getEtfJpName(sym)

  let raw = listedJa && String(listedJa).trim()
  if (!raw && mapped) raw = String(mapped).trim()
  if (!raw && profJp) raw = profJp
  if (!raw && metaName && JP_CHAR_RE.test(metaName)) raw = metaName
  if (!raw && stubJp && JP_CHAR_RE.test(stubJp)) raw = stubJp
  if (!raw && metaName) raw = metaName
  if (!raw && profEn) raw = profEn
  if (!raw && stubJp) raw = stubJp
  if (!raw) raw = sym
  return normalizeFundDisplayName(raw)
}
