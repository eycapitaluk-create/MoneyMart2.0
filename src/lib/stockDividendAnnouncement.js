import { getDividendCalendarDetailRecord } from './dividendCalendarDetailLookup'
import { lookupDividendStockBySymbol } from '../data/dividendStockUniverse'

function parseYmd(value) {
  const s = String(value || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map((x) => Number(x))
  if (!y || !m || !d) return null
  return { y, m, d }
}

function ymdFromParts(y, m, d) {
  const lastDay = new Date(y, m, 0).getDate()
  const safeDay = Math.min(Math.max(1, d), lastDay)
  const mm = String(m).padStart(2, '0')
  const dd = String(safeDay).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function startOfToday(ref = new Date()) {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  return d
}

function dividendMonthsFromRecord(rec) {
  const fromRows = (rec?.dividends || [])
    .map((row) => Number(row?.month))
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
  if (fromRows.length) return [...new Set(fromRows)].sort((a, b) => a - b)
  const preset = lookupDividendStockBySymbol(rec?.symbol)
  return (preset?.dividendMonths || [])
    .map((m) => Number(m))
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
    .sort((a, b) => a - b)
}

/** lastExDate の「日」と配当月パターンから次の権利落ち日を推定 */
export function estimateNextDividendExDate(lastExDate, dividendMonths, refDate = new Date()) {
  const last = parseYmd(lastExDate)
  const months = [...new Set(dividendMonths || [])].sort((a, b) => a - b)
  if (!last || !months.length) return null
  const today = startOfToday(refDate)
  const dom = last.d
  const startYear = today.getFullYear()

  for (let y = startYear; y <= startYear + 2; y += 1) {
    for (const month of months) {
      const candidate = ymdFromParts(y, month, dom)
      const dt = new Date(`${candidate}T00:00:00`)
      if (Number.isNaN(dt.getTime())) continue
      if (dt > today) return candidate
    }
  }
  return null
}

function amountForExMonth(rec, exDate) {
  const parsed = parseYmd(exDate)
  if (!parsed) return null
  const row = (rec?.dividends || []).find((d) => Number(d?.month) === parsed.m)
  const amt = Number(row?.amount ?? rec?.lastAmount ?? 0)
  return Number.isFinite(amt) && amt > 0 ? amt : null
}

function formatExDateJa(exDate) {
  const p = parseYmd(exDate)
  if (!p) return ''
  try {
    return new Date(p.y, p.m - 1, p.d).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return exDate
  }
}

function formatAmount(amount, currency = 'USD') {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return ''
  const cur = String(currency || 'USD').toUpperCase()
  if (cur === 'JPY' || cur === '¥') {
    const rounded = Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Math.round(n * 100) / 100
    return `¥${rounded.toLocaleString('ja-JP')}`
  }
  const digits = Math.abs(n) >= 100 ? 2 : 3
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits })}`
}

/**
 * 株ページ用: 次回（または直近発表）の現金配当バナー
 * @returns {null | { symbol: string, amount: number, amountLabel: string, exDate: string, exDateLabel: string, isEstimatedExDate: boolean }}
 */
export function getStockDividendAnnouncement(symbol, refDate = new Date()) {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) return null

  const rec = getDividendCalendarDetailRecord(sym)
  const preset = rec ? null : lookupDividendStockBySymbol(sym)
  const base = rec || preset
  if (!base) return null

  const months = dividendMonthsFromRecord(base)
  const today = startOfToday(refDate)

  let exDate = null
  let isEstimatedExDate = false

  const nextRaw = String(rec?.nextExDate || '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(nextRaw)) {
    const dt = new Date(`${nextRaw}T00:00:00`)
    if (!Number.isNaN(dt.getTime()) && dt > today) exDate = nextRaw
  }

  if (!exDate && rec?.lastExDate && months.length) {
    const estimated = estimateNextDividendExDate(rec.lastExDate, months, refDate)
    if (estimated) {
      exDate = estimated
      isEstimatedExDate = true
    }
  }

  if (!exDate) return null

  const amount = amountForExMonth(rec || {
    symbol: sym,
    dividends: preset?.dividends,
    lastAmount: preset?.dividendAmountPerShare,
  }, exDate) ?? Number(rec?.lastAmount ?? preset?.dividendAmountPerShare ?? 0)

  if (!Number.isFinite(amount) || amount <= 0) return null

  const currency = rec?.currency || (sym.endsWith('.T') ? 'JPY' : 'USD')

  return {
    symbol: sym,
    amount,
    amountLabel: formatAmount(amount, currency),
    exDate,
    exDateLabel: formatExDateJa(exDate),
    isEstimatedExDate,
    currency,
  }
}
