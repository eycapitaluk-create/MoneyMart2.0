/**
 * US/USD 配当カレンダー用: 年間配当・直近1回配当・次回権利落日から
 * 「月 × 1株あたり金額」の一覧を一貫して組み立てる。
 * （XLSX の月別シート集計が複数年混在すると irregular になりやすいため、
 *   一覧シートの数値を優先して正規化する。）
 */

import { getAnnualDividendPerShare, getDividendCadence } from './dividendCalendar.js'

function parseMonthFromIso(iso) {
  if (!iso || typeof iso !== 'string') return null
  const s = iso.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const m = parseInt(s.slice(5, 7), 10)
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : null
}

/**
 * 年間配当 ÷ 直近1回配当 から年間回数を推定。
 * TTM と直近四半期がズレると ratio が 4 以外になりやすいのでレンジで吸収する。
 */
export function inferPaymentCountPerYear(annual, last) {
  const a = Number(annual)
  const l = Number(last)
  if (!Number.isFinite(a) || a <= 0) return 0
  if (!Number.isFinite(l) || l <= 0) return 4
  const r = a / l
  if (r >= 10) return 12
  if (r >= 4.0 && r <= 8.5) return 4
  if (r >= 3.0 && r < 4.0) return 4
  if (r >= 1.55 && r <= 2.45) return 2
  if (r <= 1.12) return 1
  const rounded = Math.round(r)
  if (rounded >= 3 && rounded <= 5) return 4
  return Math.max(1, Math.min(12, rounded))
}

function spreadMonths(M, n) {
  const months = []
  if (n === 1) months.push(M)
  else if (n === 2) months.push(M, ((M - 1 + 6) % 12) + 1)
  else if (n === 4) for (let k = 0; k < 4; k++) months.push(((M - 1 + k * 3) % 12) + 1)
  else if (n === 12) for (let m = 1; m <= 12; m++) months.push(m)
  else {
    const step = Math.max(1, Math.round(12 / n))
    for (let k = 0; k < n; k++) months.push(((M - 1 + k * step) % 12) + 1)
  }
  return [...new Set(months)].sort((a, b) => a - b)
}

/**
 * @param {{ annualDividend?: number, lastAmount?: number, nextExDate?: string|null, lastExDate?: string|null }} rec
 * @returns {{ month: number, amount: number }[]}
 */
function isUsLikeRecord(rec) {
  if (String(rec?.currency || '').toUpperCase() === 'USD') return true
  if (String(rec?.category || '').includes('米国')) return true
  return false
}

/**
 * 月別シート由来の行が年間配当と整合しない・irregular のときに正規化する。
 */
export function shouldNormalizeUsDividendRecord(rec, dividends) {
  if (!isUsLikeRecord(rec)) return false
  const annual = Number(rec?.annualDividend) || 0
  if (!(annual > 0)) return false
  const divs = Array.isArray(dividends) ? dividends : rec?.dividends
  const sum = getAnnualDividendPerShare(divs)
  const cad = getDividendCadence(divs)
  const rel = annual > 0 ? Math.abs(sum - annual) / annual : 1
  if (cad === 'irregular') return true
  if (rel > 0.04) return true
  if (!(sum > 0) && Array.isArray(divs) && divs.length > 0) return true
  return false
}

export function rebuildUsDividendScheduleFromRecord(rec) {
  const annual = Number(rec?.annualDividend)
  if (!Number.isFinite(annual) || annual <= 0) return []
  const last = Number(rec?.lastAmount)
  const iso = rec?.nextExDate || rec?.lastExDate || null
  const M = parseMonthFromIso(iso)
  if (!M) return []
  let n = inferPaymentCountPerYear(annual, last)
  if (n <= 0) n = 4
  const per = annual / n
  const amount = Math.round(per * 1e6) / 1e6
  const months = spreadMonths(M, n)
  return months.map((m) => ({ month: m, amount }))
}
