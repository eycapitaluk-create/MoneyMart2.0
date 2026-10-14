/** Stored trust fee is a percent (0.0495 = 0.0495%). Null is missing, not zero. */
export function parseTrustFeePercent(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Minimum three decimals, up to six. Trailing zeros stop at three.
 * 0.03025 stays 0.03025%. It is not rounded to 0.0303% or 0.030%.
 */
export function formatTrustFeePercent(value) {
  const n = parseTrustFeePercent(value)
  if (n == null) return '-'
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  let micros = Math.round(abs * 1e6)
  let decimals = 6
  while (decimals > 3 && micros % 10 === 0) {
    micros = Math.trunc(micros / 10)
    decimals -= 1
  }
  const at6 = Math.round(abs * 1e6) / 1e6
  return `${(sign * at6).toFixed(decimals)}%`
}

/**
 * Issuer tax-inclusive basic, approximate, or maximum reference.
 * Not a total-expense ratio and not today's effective fee.
 * 1308 is the published maximum basic fee; marginal tiers can make the actual rate lower.
 * Only these eight products are verified write targets.
 */
export const PROSPECTUS_INCLUSIVE_TRUST_FEE = {
  '1369.T': 0.0495,
  '1473.T': 0.0495,
  '1475.T': 0.0495,
  '1329.T': 0.0495,
  '1364.T': 0.0495,
  '449A.T': 0.03025,
  '450A.T': 0.03025,
  '1308.T': 0.0748,
}

/** Published maximum. A lower stored rate needs review; it is not by itself a tax error. */
export const VERIFIED_VARIABLE_CAP_SYMBOLS = new Set(['1308.T'])

export function feesMatch(left, right) {
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= 1e-9
}

/** JPX list rates are tax-exclusive. Do not round the inclusive estimate to 3 decimals. */
export function inclusiveFromExclusive(exclusive) {
  const n = Number(exclusive)
  if (!Number.isFinite(n)) return null
  return n * 1.1
}

/**
 * An exact stored pre-tax rate is a tax mismatch.
 * A rate merely below a variable cap is review_needed, not proof of a tax error.
 * An exact inclusive rate, or an exact verified issuer reference, is OK.
 */
export function classifyTrustFee({ symbol, stored, exclusive, within = false }) {
  const storedN = parseTrustFeePercent(stored)
  if (storedN == null) return 'mm_missing'
  const prospectus = PROSPECTUS_INCLUSIVE_TRUST_FEE[symbol]
  if (prospectus != null && feesMatch(storedN, prospectus)) return 'ok_prospectus'
  const ex = Number(exclusive)
  const hasEx = Number.isFinite(ex)
  if (hasEx && feesMatch(storedN, inclusiveFromExclusive(ex))) return 'ok_inc_tax'
  if (hasEx && feesMatch(storedN, ex)) return 'tax_mismatch_pre_tax'
  if (VERIFIED_VARIABLE_CAP_SYMBOLS.has(symbol) && prospectus != null && storedN < prospectus) return 'review_needed'
  if (!hasEx) return 'jpx_missing'
  if (within && storedN < ex) return 'review_needed'
  return 'mismatch'
}

export function isTrustFeeOk(status) {
  return status === 'ok_prospectus' || status === 'ok_inc_tax'
}

/**
 * Unverified JPX-derived rates are never writable here.
 * A prospectus symbol is writable only when the stored rate is not already that exact inclusive rate.
 */
/**
 * Replace only trustFee on records that have an exact symbol-row match.
 * A missing row leaves the cached record unchanged. A null fee stays null.
 * Price, return, and AUM fields are not read or written.
 */
export function refreshCachedTrustFees(funds, symbolRows, normalize = (value) => String(value || '').trim()) {
  const feeBySymbol = new Map()
  for (const row of symbolRows || []) {
    const key = normalize(row?.symbol)
    if (!key || feeBySymbol.has(key)) continue
    const parsed = parseTrustFeePercent(row?.trust_fee)
    feeBySymbol.set(key, Number.isFinite(parsed) ? parsed : null)
  }
  return (Array.isArray(funds) ? funds : []).map((fund) => {
    const key = normalize(fund?.id || fund?.symbol || fund?.fundCode)
    if (!key || !feeBySymbol.has(key)) return fund
    return { ...fund, trustFee: feeBySymbol.get(key) }
  })
}

export function planTrustFeeUpdate({ symbol, stored, exclusive }) {
  const prospectus = PROSPECTUS_INCLUSIVE_TRUST_FEE[symbol] ?? null
  const target = prospectus != null ? prospectus : inclusiveFromExclusive(exclusive)
  const status = classifyTrustFee({ symbol, stored, exclusive, within: false })
  const storedN = parseTrustFeePercent(stored)
  const writable = prospectus != null && !feesMatch(storedN, prospectus)
  return { status, target, verified: prospectus != null, writable }
}
