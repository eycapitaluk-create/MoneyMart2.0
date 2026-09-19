/** マイページ「保有」無料枠: 銘柄（株式）・ファンドはそれぞれ銘柄コードの種類数でカウント */
export const FREE_OWNED_DISTINCT_STOCK_SYMBOLS = 5
export const FREE_OWNED_DISTINCT_FUND_SYMBOLS = 5

/**
 * false の間は無料プランでも保有株式・ファンドの銘柄種類数上限をかけない（クライアント追加・DB 同期とも無効）。
 * 再開するときは true に戻す。
 */
export const ENFORCE_FREE_OWNED_DISTINCT_SYMBOL_CAPS = false

/**
 * 本体価格は税抜（消費税 10%）。LP などの表示は PREMIUM_*_INCL_TAX_* を使うこと。
 * 実請求はウェブ（PAY.JP）・iOS（App Store サブスク）の実運用とこの定数を一致させること。
 */
export const PREMIUM_CONSUMPTION_TAX_RATE = 0.1
/** 税抜（税込月額 ¥530 ＝ 482 × 1.1 を四捨五入） */
export const PREMIUM_LIST_PRICE_YEN = 482
export const PREMIUM_SALE_PRICE_YEN = 482
export const PREMIUM_DISCOUNT_YEN = PREMIUM_LIST_PRICE_YEN - PREMIUM_SALE_PRICE_YEN
/** 月額（税込）＝本体 482 円 × 1.1 → ¥530 */
export const PREMIUM_MONTHLY_PRICE_INCL_TAX_YEN = Math.round(PREMIUM_SALE_PRICE_YEN * (1 + PREMIUM_CONSUMPTION_TAX_RATE))
/** 年額一括（税抜） */
export const PREMIUM_ANNUAL_EX_VAT_YEN = 3900
/** 年額一括（税込） */
export const PREMIUM_ANNUAL_PRICE_INCL_TAX_YEN = Math.round(PREMIUM_ANNUAL_EX_VAT_YEN * (1 + PREMIUM_CONSUMPTION_TAX_RATE))
/** 年額を月割りした税込換算（表記用） */
export const PREMIUM_ANNUAL_MONTHLY_EQUIV_YEN = 357
/** @deprecated 税抜年額。新規は PREMIUM_ANNUAL_EX_VAT_YEN を使う */
export const PREMIUM_ANNUAL_PRICE_YEN = PREMIUM_ANNUAL_EX_VAT_YEN

export const PREMIUM_PLAN_KEYS = ['prime', 'premium', 'pro', 'plus', 'paid']

/** 新規登録の無料お試し日数（user_profiles.premium_trial_ends_at と一致させる） */
export const PREMIUM_TRIAL_DAYS = 7

export function isPremiumTrialActive(premiumTrialEndsAt, nowMs = Date.now()) {
  if (premiumTrialEndsAt == null || premiumTrialEndsAt === '') return false
  const t = new Date(premiumTrialEndsAt).getTime()
  return Number.isFinite(t) && nowMs < t
}

/**
 * 課金または無料お試し中なら Premium 機能を開く。
 * planTier は App が user_profiles（および auth メタデータ）から正規化した値を渡すこと。
 */
export function hasPremiumEntitlement({
  planTier = '',
  premiumTrialEndsAt = null,
} = {}) {
  const pt = String(planTier || '').toLowerCase()
  if (isPaidPlanTier(pt)) return true
  if (isPremiumTrialActive(premiumTrialEndsAt)) return true
  return false
}

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
