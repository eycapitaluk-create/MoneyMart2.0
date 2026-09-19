/**
 * US 배당 Summary 시트 → dividendStockUniverse.js + dividendCalendarDetail.generated.json
 *
 * 기대 형식 (Summary 시트):
 *   Ticker | Company | Frequency | Pay Months | Pay Count | Total/Share ($) | Last Amount ($) | Last Ex-Date
 *
 * 연간 추정: Total 열은 사용하지 않음. Last Amount × 분기4 / 반기2 (frequency 기준).
 * LII: Pay Months 5개(전환 분기) → 표준 분기 [3,6,9,12] + Last Amount로 정규화.
 *
 * MRSH 행이 있으면 동일 스케줄로 MMC도 갱신 (표준 티커).
 *
 *   node scripts/sync-us-dividends-summary-xlsx.mjs [/path/to/dividends.xlsx]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const roundAmt = (n) => Math.round(Math.max(0, Number(n) || 0) * 1e6) / 1e6

const normalizeDbSymbol = (raw) => {
  const u = String(raw ?? '').trim().toUpperCase()
  if (!u) return ''
  if (u === 'BRK/B' || u === 'BRK-B') return 'BRK.B'
  if (u === 'BF/B' || u === 'BF-B') return 'BF-B'
  if (u.includes('/')) return u.replace(/\//g, '-')
  return u
}

const parseIso = (v) => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = String(v ?? '').replace(/,/g, '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

/** "02, 05, 08, 11" → [2,5,8,11] */
const parsePayMonths = (s) => {
  const str = String(s ?? '').trim()
  if (!str || /no dividend/i.test(str)) return []
  const out = []
  for (const part of str.split(/[,，]/)) {
    const n = parseInt(String(part).trim(), 10)
    if (Number.isInteger(n) && n >= 1 && n <= 12) out.push(n)
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

const paymentsPerYearFromFrequency = (freqRaw) => {
  const f = String(freqRaw ?? '').trim().toLowerCase()
  if (f.includes('non')) return 0
  if (f.includes('semi')) return 2
  if (f.includes('month')) return 12
  if (f.includes('quarter')) return 4
  return 4
}

/** 신규 종목용 간단 섹터 (미국株universe 영문 라벨에 맞춤) */
const guessSector = (symbol, company = '') => {
  const c = String(company).toLowerCase()
  const s = String(symbol).toUpperCase()
  const map = {
    APO: 'Financials',
    APP: 'Information Technology',
    ARES: 'Financials',
    'BF-B': 'Consumer Staples',
    CASY: 'Consumer Staples',
    CIEN: 'Information Technology',
    COHR: 'Information Technology',
    COIN: 'Financials',
    CRH: 'Materials',
    CVNA: 'Consumer Discretionary',
    DELL: 'Information Technology',
    EME: 'Industrials',
    ERIE: 'Financials',
    EXE: 'Energy',
    FISV: 'Financials',
    FIX: 'Industrials',
    HOOD: 'Financials',
    IBKR: 'Financials',
    KKR: 'Financials',
    LII: 'Industrials',
    LITE: 'Information Technology',
    MRSH: 'Financials',
    PLTR: 'Information Technology',
    PSKY: 'Communication Services',
    Q: 'Information Technology',
    SATS: 'Communication Services',
    SNDK: 'Information Technology',
    TKO: 'Communication Services',
    TPL: 'Energy',
    TTD: 'Communication Services',
    VEEV: 'Health Care',
    XYZ: 'Financials',
  }
  if (map[s]) return map[s]
  if (c.includes('energy') || c.includes('oil')) return 'Energy'
  if (c.includes('bank') || c.includes('financial')) return 'Financials'
  return 'Consumer Discretionary'
}

const normalizeQuarterlyMonths = (symbol, months, freqRaw) => {
  const f = String(freqRaw ?? '').toLowerCase()
  if (!f.includes('quarter')) return months
  if (symbol === 'LII' && months.length > 4) return [3, 6, 9, 12]
  return months
}

const applyYieldAndHighYield = (rec, prevHighYield = false) => {
  const price = Number(rec?.price) || 0
  const annual = Number(rec?.annualDividend) || 0
  if (price > 0 && annual > 0) {
    rec.yieldPct = Math.round((annual / price) * 10000) / 100
  } else {
    rec.yieldPct = 0
  }
  const y = Number(rec.yieldPct)
  rec.highYield = (Number.isFinite(y) && y >= 4) || Boolean(prevHighYield)
}

/**
 * dividendStockUniverse.js の export 배열을 JSON으로 추출（import 없이 Node 단독 실행 가능）
 */
const extractUniverseArrayJson = (text) => {
  const needle = 'export const DIVIDEND_STOCK_UNIVERSE = '
  const head = text.indexOf(needle)
  if (head < 0) throw new Error('DIVIDEND_STOCK_UNIVERSE 선언 없음')
  let i = head + needle.length
  while (i < text.length && /\s/.test(text[i])) i += 1
  if (text[i] !== '[') throw new Error('[ 로 시작하지 않음')
  let depth = 0
  const start = i
  let inStr = false
  let q = ''
  let escape = false
  for (; i < text.length; i += 1) {
    const c = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (inStr) {
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === q) inStr = false
      continue
    }
    if (c === '"' || c === "'") {
      inStr = true
      q = c
      continue
    }
    if (c === '[') depth += 1
    else if (c === ']') {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  throw new Error('배열 닫힘 없음')
}

const parseUniverseJson = (raw) => {
  try {
    return JSON.parse(raw)
  } catch {
    const stripped = raw.replace(/,\s*(?=[}\]])/g, '')
    return JSON.parse(stripped)
  }
}

const readSummaryPatches = (xlsxPath) => {
  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const sh = wb.Sheets['Summary']
  if (!sh) throw new Error('Summary 시트 없음')
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true })
  const hdr = rows[0] || []
  const idx = (label) => hdr.findIndex((h) => String(h).trim() === label)
  const iSym = idx('Ticker')
  const iCo = idx('Company')
  const iFq = idx('Frequency')
  const iMonths = idx('Pay Months')
  const iLast = idx('Last Amount ($)')
  const iEx = idx('Last Ex-Date')
  if (iSym < 0 || iMonths < 0 || iLast < 0) throw new Error('Summary 헤더 불완전')

  /** @type {Map<string, object>} */
  const bySym = new Map()
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r]
    if (!Array.isArray(row)) continue
    const rawSym = row[iSym]
    const symbol = normalizeDbSymbol(rawSym)
    if (!symbol) continue
    const company = String(row[iCo] ?? '').trim()
    const freq = String(row[iFq] ?? '').trim()
    let months = parsePayMonths(row[iMonths])
    const nonDiv = freq.toLowerCase().includes('non-dividend') || freq.toLowerCase().includes('non dividend')
    const lastAmount = nonDiv ? 0 : roundAmt(row[iLast])
    const lastExDate = iEx >= 0 ? parseIso(row[iEx]) : null

    if (!nonDiv && lastAmount <= 0) continue

    months = normalizeQuarterlyMonths(symbol, months, freq)

    const payPerYear = nonDiv ? 0 : paymentsPerYearFromFrequency(freq)
    const annualDividend = nonDiv ? 0 : roundAmt(lastAmount * payPerYear)

    const dividends = nonDiv || months.length === 0
      ? []
      : months.map((month) => ({ month, amount: lastAmount }))

    bySym.set(symbol, {
      symbol,
      rawTicker: String(rawSym ?? '').trim(),
      company,
      freq,
      months,
      nonDiv,
      lastAmount,
      lastExDate,
      annualDividend,
      dividends,
      payPerYear,
    })
  }
  return bySym
}

const serializeUniverseRow = (row) => {
  const lines = JSON.stringify(row, null, 2).split('\n')
  return `${lines.map((line) => `  ${line}`).join('\n')}`
}

const main = async () => {
  const argPath = process.argv[2]
  const xlsxPath = argPath || path.join(process.env.HOME || '', 'Downloads/dividends_2025-04_to_2026-05.xlsx')
  if (!fs.existsSync(xlsxPath)) {
    console.error('xlsx 없음:', xlsxPath)
    process.exit(1)
  }

  const patches = readSummaryPatches(xlsxPath)
  console.log('Summary symbols:', patches.size)

  const universePath = path.join(ROOT, 'src/data/dividendStockUniverse.js')
  const universeText = fs.readFileSync(universePath, 'utf8')
  const footerMarker = '\n\nconst DIVIDEND_STOCK_BY_SYMBOL'
  const footerIdx = universeText.indexOf(footerMarker)
  if (footerIdx < 0) throw new Error('dividendStockUniverse.js footer marker 없음')
  const footer = universeText.slice(footerIdx)

  const arrJson = extractUniverseArrayJson(universeText)
  const rows = parseUniverseJson(arrJson)
  const bySym = new Map(rows.map((r) => [String(r.symbol || '').trim().toUpperCase(), r]))

  const mergePatchIntoRow = (row, p) => {
    if (!row || !p) return
    if (p.nonDiv) {
      row.dividendMonths = []
      delete row.dividendAmountPerShare
      return
    }
    row.dividendMonths = [...p.months]
    row.dividendAmountPerShare = p.lastAmount
  }

  for (const p of patches.values()) {
    const existing = bySym.get(p.symbol)
    if (existing) {
      mergePatchIntoRow(existing, p)
    } else {
      const nr = {
        symbol: p.symbol,
        name: p.company || p.symbol,
        region: 'US',
        sector: guessSector(p.symbol, p.company),
        indexTag: '',
        ...(p.nonDiv ? { dividendMonths: [] } : { dividendMonths: [...p.months], dividendAmountPerShare: p.lastAmount }),
      }
      let insertAt = rows.findIndex((r) => String(r.symbol || '').localeCompare(p.symbol) > 0)
      if (insertAt < 0) rows.push(nr)
      else rows.splice(insertAt, 0, nr)
      bySym.set(p.symbol, nr)
    }
  }

  const mrsh = patches.get('MRSH')
  if (mrsh && !mrsh.nonDiv) {
    const mmc = bySym.get('MMC')
    mergePatchIntoRow(mmc, mrsh)
  }

  const bfp = patches.get('BF-B')
  if (bfp && !bfp.nonDiv) {
    mergePatchIntoRow(bySym.get('BF.B'), bfp)
  }

  const header = `import { isRetiredStockSymbol } from '../lib/retiredStockSymbols'\n\nexport const DIVIDEND_STOCK_UNIVERSE = [\n`
  const body = rows.map((r) => serializeUniverseRow(r)).join(',\n')
  fs.writeFileSync(universePath, `${header}${body}\n]${footer}`, 'utf8')
  console.log('Wrote', universePath)

  const detailPath = path.join(ROOT, 'src/data/dividendCalendarDetail.generated.json')
  const pack = JSON.parse(fs.readFileSync(detailPath, 'utf8'))
  const records = Array.isArray(pack.records) ? pack.records : []
  const detailBy = new Map(records.map((r) => [String(r.symbol || '').trim().toUpperCase(), r]))

  let detailUpserts = 0
  for (const p of patches.values()) {
    if (p.nonDiv) {
      const rec = detailBy.get(p.symbol)
      if (rec) {
        const prevHy = Boolean(rec.highYield)
        rec.currency = 'USD'
        rec.lastAmount = 0
        rec.annualDividend = 0
        rec.dividends = []
        applyYieldAndHighYield(rec, prevHy)
        detailUpserts += 1
      }
      continue
    }

    const prev = detailBy.get(p.symbol)
    const prevHy = Boolean(prev?.highYield)
    const rec = prev || {
      symbol: p.symbol,
      name: '',
      category: '米国株',
      currency: 'USD',
      price: 0,
      annualDividend: 0,
      yieldPct: 0,
      lastAmount: 0,
      lastExDate: null,
      nextExDate: null,
      dividends: [],
      highYield: false,
    }
    rec.name = p.company || rec.name || p.symbol
    rec.category = rec.category || '米国株'
    rec.currency = 'USD'
    rec.lastAmount = p.lastAmount
    rec.annualDividend = p.annualDividend
    rec.dividends = p.dividends
    if (p.lastExDate) rec.lastExDate = p.lastExDate
    applyYieldAndHighYield(rec, prevHy)
    if (!detailBy.has(p.symbol)) {
      records.push(rec)
      detailBy.set(p.symbol, rec)
    }
    detailUpserts += 1
  }

  if (mrsh && !mrsh.nonDiv) {
    const mmcRec = detailBy.get('MMC')
    if (mmcRec) {
      mmcRec.lastAmount = mrsh.lastAmount
      mmcRec.annualDividend = mrsh.annualDividend
      mmcRec.dividends = mrsh.dividends.map((d) => ({ ...d }))
      if (mrsh.lastExDate) mmcRec.lastExDate = mrsh.lastExDate
      applyYieldAndHighYield(mmcRec, Boolean(mmcRec.highYield))
    }
  }

  const bfDetail = detailBy.get('BF-B')
  if (bfDetail) {
    const prevBfDot = detailBy.get('BF.B')
    if (!prevBfDot) {
      const clone = {
        ...bfDetail,
        symbol: 'BF.B',
        name: 'Brown-Forman Corp.',
      }
      records.push(clone)
      detailBy.set('BF.B', clone)
    } else {
      prevBfDot.lastAmount = bfDetail.lastAmount
      prevBfDot.annualDividend = bfDetail.annualDividend
      prevBfDot.dividends = (bfDetail.dividends || []).map((d) => ({ ...d }))
      prevBfDot.currency = 'USD'
      if (bfDetail.lastExDate) prevBfDot.lastExDate = bfDetail.lastExDate
      applyYieldAndHighYield(prevBfDot, Boolean(prevBfDot.highYield))
    }
  }

  records.sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)))
  pack.records = records
  pack.recordCount = records.length
  pack.generatedFrom = `${path.basename(xlsxPath)} (via sync-us-dividends-summary-xlsx.mjs)`

  fs.writeFileSync(detailPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')
  console.log('Wrote', detailPath, '| records:', records.length, '| patch rows:', detailUpserts)
}

try {
  main()
} catch (e) {
  console.error(e)
  process.exit(1)
}
