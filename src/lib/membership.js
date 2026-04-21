/** マイページ「保有」無料枠: 銘柄（株式）・ファンドはそれぞれ銘柄コードの種類数でカウント */
export const FREE_OWNED_DISTINCT_STOCK_SYMBOLS = 5
export const FREE_OWNED_DISTINCT_FUND_SYMBOLS = 5

/**
 * false の間は無料プランでも保有株式・ファンドの銘柄種類数上限をかけない（クライアント追加・DB 同期とも無効）。
 * 再開するときは true に戻す。
 */
export const ENFORCE_FREE_OWNED_DISTINCT_SYMBOL_CAPS = false

/**
 * 料金の UI 表示。実際の請求金額は Stripe の Price 設定に合わせること。
 */
export const PREMIUM_LIST_PRICE_YEN = 480
export const PREMIUM_SALE_PRICE_YEN = 480
export const PREMIUM_DISCOUNT_YEN = PREMIUM_LIST_PRICE_YEN - PREMIUM_SALE_PRICE_YEN
export const PREMIUM_FIRST_MONTH_PROMO_YEN = 100
export const PREMIUM_ANNUAL_PRICE_YEN = 3900
export const PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN = Math.round(PREMIUM_ANNUAL_PRICE_YEN / 12)

export const PREMIUM_PLAN_KEYS = ['prime', 'premium', 'pro', 'plus', 'paid']

export function isPaidPlanTier(planTierLower) {
  const k = String(planTierLower || '').toLowerCase()
  return PREMIUM_PLAN_KEYS.some((key) => k.includes(key))
}

export function isPaidFromUserProfileRow(profile) {
  if (!profile) return false
  if (profile.is_premium || profile.is_prime || profile.prime_member) return true
  const p = String(
    profile.plan_tier
    || profile.membership_tier
    || profile.subscription_tier
    || profile.plan
    || '',
  ).toLowerCase()
  return isPaidPlanTier(p)
}

export function canAddDistinctOwnedStock(existingLots, newSymbolUpper, isPaid) {
  if (isPaid || !ENFORCE_FREE_OWNED_DISTINCT_SYMBOL_CAPS) return { ok: true }
  const sym = String(newSymbolUpper || '').trim().toUpperCase()
  const set = new Set()
  ;(Array.isArray(existingLots) ? existingLots : []).forEach((row) => {
    const x = String(row?.symbol || '').trim().toUpperCase()
    if (x) set.add(x)
  })
  if (sym && set.has(sym)) return { ok: true }
  if (set.size >= FREE_OWNED_DISTINCT_STOCK_SYMBOLS) {
    return { ok: false, reason: 'stock_cap' }
  }
  return { ok: true }
}

export function canAddDistinctOwnedFund(existingFunds, newSymbolUpper, isPaid) {
  if (isPaid || !ENFORCE_FREE_OWNED_DISTINCT_SYMBOL_CAPS) return { ok: true }
  const sym = String(newSymbolUpper || '').trim().toUpperCase()
  const set = new Set()
  ;(Array.isArray(existingFunds) ? existingFunds : []).forEach((row) => {
    const x = String(row?.symbol || '').trim().toUpperCase()
    if (x) set.add(x)
  })
  if (sym && set.has(sym)) return { ok: true }
  if (set.size >= FREE_OWNED_DISTINCT_FUND_SYMBOLS) {
    return { ok: false, reason: 'fund_cap' }
  }
  return { ok: true }
}
