import pack from '../data/dividendCalendarDetail.generated.json'
import { DIVIDEND_STOCK_UNIVERSE } from '../data/dividendStockUniverse'

const records = Array.isArray(pack?.records) ? pack.records : []
const isDividendEligibleCategory = (category) => {
  const c = normalizeSearchText(category)
  if (!c) return true
  // 配当カレンダー銘柄追加では ETF/ETN を除外（個別株のみ表示）
  if (c.includes('etf') || c.includes('etn')) return false
  return true
}

function normalizeSearchText(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
}

/** @type {Map<string, object>} */
const bySymbol = new Map()
for (const r of records) {
    if (!isDividendEligibleCategory(r?.category)) continue
  const sym = String(r?.symbol || '').trim().toUpperCase()
  if (!sym) continue
  bySymbol.set(sym, r)
  if (sym.endsWith('.T')) {
    const code = sym.slice(0, -2)
    if (code && !bySymbol.has(code)) bySymbol.set(code, r)
  }
}

export function normalizeDividendDetailSymbol(input = '') {
  const t = String(input || '').trim().toUpperCase()
  if (!t) return ''
  if (/^\d{4}$/.test(t)) return `${t}.T`
  return t
}

export function getDividendCalendarDetailRecord(inputSymbol) {
  const k = normalizeDividendDetailSymbol(inputSymbol)
  if (!k) return null
  return bySymbol.get(k) || null
}

/**
 * @param {string} query
 * @param {number} limit
 * @returns {typeof records}
 */
export function searchDividendCalendarRecords(query, limit = 12) {
  const raw = String(query || '').trim()
  if (!raw) return []
  const nq = normalizeSearchText(raw)
  const parts = nq.split(/\s+/).filter(Boolean)
  if (parts.length < 1) return []
  const tightQuery = nq.replace(/\s+/g, '')
  const isShortAlphaQuery = /^[a-z]{1,2}$/.test(tightQuery)

  const matchHay = (hayNorm) => parts.every((p) => hayNorm.includes(p))
  const startsWithAny = (textNorm) => parts.some((p) => textNorm.startsWith(p))

  const scored = []
  const seen = new Map()

  const pushRec = (r, score) => {
    const sym = String(r?.symbol || '').trim().toUpperCase()
    if (!sym) return
    const prev = seen.get(sym)
    if (prev != null && prev >= score) return
    seen.set(sym, score)
    scored.push({ r, score, sym })
  }

  for (const r of records) {
    if (!isDividendEligibleCategory(r?.category)) continue
    const sym = normalizeSearchText(r.symbol)
    const name = normalizeSearchText(r.name)
    const cat = normalizeSearchText(r.category)
    const symNoDot = sym.replace(/\./g, '')
    const nameNoSpace = name.replace(/\s+/g, '')
    const symStarts = startsWithAny(sym) || startsWithAny(symNoDot)
    const nameStarts = startsWithAny(name) || startsWithAny(nameNoSpace)
    if (isShortAlphaQuery) {
      if (!symStarts && !nameStarts) continue
      const exactSym = sym === tightQuery || symNoDot === tightQuery
      pushRec(r, exactSym ? 400 : symStarts ? 300 : 220)
      continue
    }
    const hay = `${sym} ${name} ${cat}`
    if (!matchHay(hay)) continue
    let score = 100
    if (sym === tightQuery || symNoDot === tightQuery) score += 250
    else if (symStarts) score += 170
    else if (sym.includes(tightQuery) || symNoDot.includes(tightQuery)) score += 120
    if (nameStarts) score += 80
    else if (name.includes(tightQuery)) score += 40
    pushRec(r, score)
  }

  const uni = Array.isArray(DIVIDEND_STOCK_UNIVERSE) ? DIVIDEND_STOCK_UNIVERSE : []
  for (const u of uni) {
    const symRaw = String(u?.symbol || '').trim()
    if (!symRaw) continue
    const key = normalizeDividendDetailSymbol(symRaw)
    const rec = bySymbol.get(key)
    if (!rec) continue
    if (!isDividendEligibleCategory(rec?.category)) continue
    const symN = normalizeSearchText(symRaw)
    const symNoDot = symN.replace(/\./g, '')
    const nameJp = normalizeSearchText(u.name || '')
    const sector = normalizeSearchText(u.sector || '')
    const region = normalizeSearchText(u.region || '')
    const symStarts = startsWithAny(symN) || startsWithAny(symNoDot)
    const nameStarts = startsWithAny(nameJp)
    if (isShortAlphaQuery) {
      if (!symStarts && !nameStarts) continue
      const exactSym = symN === tightQuery || symNoDot === tightQuery
      pushRec(rec, exactSym ? 380 : symStarts ? 280 : 210)
      continue
    }
    const hay = `${symN} ${nameJp} ${sector} ${region}`
    if (!matchHay(hay)) continue
    let score = 90
    if (symN === tightQuery || symNoDot === tightQuery) score += 240
    else if (symStarts) score += 160
    else if (symN.includes(tightQuery) || symNoDot.includes(tightQuery)) score += 110
    if (nameStarts) score += 70
    else if (nameJp.includes(tightQuery)) score += 35
    pushRec(rec, score)
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.sym.localeCompare(b.sym)
    })
    .map((x) => x.r)
    .slice(0, limit)
}

export function isHighYieldDetailSymbol(stockId) {
  return Boolean(getDividendCalendarDetailRecord(stockId)?.highYield)
}

/** User-edited dividends vs xlsx master: same months & per-share amounts within epsilon */
export function dividendDetailMatchesUserInput(masterRec, userDividends, epsilon = 0.02) {
  if (!masterRec?.dividends?.length) return false
  const norm = (arr) => [...(Array.isArray(arr) ? arr : [])]
    .filter((d) => Number(d?.amount) > 0)
    .map((d) => ({ m: Math.min(12, Math.max(1, Number(d.month))), a: Number(d.amount) }))
    .filter((d) => Number.isFinite(d.m))
    .sort((x, y) => x.m - y.m)
  const u = norm(userDividends)
  const m = norm(masterRec.dividends)
  if (u.length === 0 || u.length !== m.length) return false
  for (let i = 0; i < u.length; i++) {
    if (u[i].m !== m[i].m) return false
    if (Math.abs(u[i].a - m[i].a) > epsilon) return false
  }
  return true
}

export function dividendCalendarDetailMeta() {
  return {
    recordCount: records.length,
    sourceFile: pack?.generatedFrom || null,
  }
}
