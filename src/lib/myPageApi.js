import { supabase } from './supabase'
import {
  isPaidFromUserProfileRow,
  ENFORCE_FREE_OWNED_DISTINCT_SYMBOL_CAPS,
  FREE_OWNED_DISTINCT_STOCK_SYMBOLS,
  FREE_OWNED_DISTINCT_FUND_SYMBOLS,
} from './membership'
import { decodeHtmlEntities } from './fundDisplayUtils'

const TABLE_NOT_FOUND_CODE = '42P01'
const COLUMN_NOT_FOUND_CODE = '42703'
/** Postgres unique_violation — e.g. concurrent replace: two clients interleave DELETE/INSERT */
const PG_UNIQUE_VIOLATION = '23505'
const EXPENSE_SELECT_WITH_RECURRING = 'id,spent_on,category,merchant,amount,payment_method,notes,created_at,recurring_type,recurring_anchor_day,recurring_start_on,recurring_end_on,recurring_parent_id'
const EXPENSE_SELECT_LEGACY = 'id,spent_on,category,merchant,amount,payment_method,notes,created_at'
const RECURRING_TYPES = ['weekly', 'monthly']
const RECURRING_MATERIALIZE_AHEAD_MONTHS = 1
const DEFAULT_REVOLVING_PROFILE = {
  balance_yen: 0,
  apr: 15,
  monthly_payment_yen: 0,
  remaining_months_assumed: 24,
  refinance_fee_yen: 0,
}
const DEFAULT_TAX_SHIELD_PROFILE = (taxYear) => ({
  tax_year: Math.max(2020, Math.floor(Number(taxYear || new Date().getFullYear()))),
  annual_income_yen: 0,
  ideco_paid_yen: 0,
  nisa_paid_yen: 0,
  insurance_paid_yen: 0,
  deduction_reflected: false,
})
const DEFAULT_CASHFLOW_OPTIMIZER_PROFILE = (taxYear) => ({
  tax_year: Math.max(2020, Math.floor(Number(taxYear || new Date().getFullYear()))),
  cash_balance_yen: 0,
  current_cash_rate: 0.001,
  high_yield_cash_rate: 0.003,
  reserve_month_multiplier: 1.5,
})
export const DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT = -5
/** null = 上昇アラート無効 */
export const DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT = null
/** DB の threshold_pct が 0 のとき = 下落アラート無効（列は NOT NULL のため NULL は使わない） */
export const PORTFOLIO_DROP_ALERT_DISABLED_DB_VALUE = 0

const normalizeDropThresholdPctFromDb = (raw) => {
  if (raw === null || raw === undefined) return DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT
  if (n === 0) return null
  const rounded = Math.round(n)
  return Math.max(-20, Math.min(-1, rounded))
}

const normalizeDropThresholdPctForSave = (raw) => {
  if (raw === null || raw === undefined || raw === 'off') return PORTFOLIO_DROP_ALERT_DISABLED_DB_VALUE
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT
  const rounded = Math.round(n)
  if (rounded === 0) return PORTFOLIO_DROP_ALERT_DISABLED_DB_VALUE
  return Math.max(-20, Math.min(-1, rounded))
}

const isTableMissingError = (error) => (
  error?.code === TABLE_NOT_FOUND_CODE || /does not exist|schema cache/i.test(error?.message || '')
)
const isMissingNisaColumnError = (error) => (
  error?.code === COLUMN_NOT_FOUND_CODE
  && /is_nisa/i.test(String(error?.message || ''))
)
const isMissingRecurringColumnError = (error) => (
  error?.code === COLUMN_NOT_FOUND_CODE
  && /recurring_/i.test(String(error?.message || ''))
)

const omitExpenseRecurringKeys = (row) => {
  const o = { ...(row || {}) }
  delete o.recurring_type
  delete o.recurring_anchor_day
  delete o.recurring_start_on
  delete o.recurring_end_on
  delete o.recurring_parent_id
  return o
}

const toIsoDate = (value) => {
  const base = String(value || '').slice(0, 10)
  if (!base) return ''
  const date = new Date(`${base}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const addDaysIso = (isoDate, days) => {
  const base = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return ''
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

const daysInMonthUtc = (year, monthIndex0) => {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

const addMonthsAnchoredIso = (isoDate, months, anchorDay = 1) => {
  const base = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return ''
  const y = base.getUTCFullYear()
  const m = base.getUTCMonth()
  const next = new Date(Date.UTC(y, m + months, 1))
  const dim = daysInMonthUtc(next.getUTCFullYear(), next.getUTCMonth())
  next.setUTCDate(Math.max(1, Math.min(Number(anchorDay || 1), dim)))
  return next.toISOString().slice(0, 10)
}

const endOfMonthAfterMonthsIso = (monthsAhead = 0) => {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + Number(monthsAhead || 0) + 1, 0)
  return end.toISOString().slice(0, 10)
}

const fetchExpensesRows = async (userId) => {
  const latest = await supabase
    .from('user_expenses')
    .select(EXPENSE_SELECT_WITH_RECURRING)
    .eq('user_id', userId)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300)

  if (!latest.error) return latest
  if (!isMissingRecurringColumnError(latest.error)) return latest

  const legacy = await supabase
    .from('user_expenses')
    .select(EXPENSE_SELECT_LEGACY)
    .eq('user_id', userId)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300)

  if (legacy.error) return legacy
  return {
    data: (legacy.data || []).map((row) => ({
      ...row,
      recurring_type: null,
      recurring_anchor_day: null,
      recurring_start_on: null,
      recurring_end_on: null,
      recurring_parent_id: null,
    })),
    error: null,
  }
}

const materializeRecurringExpenses = async (userId) => {
  const templateRes = await supabase
    .from('user_expenses')
    .select('id,spent_on,category,merchant,amount,payment_method,notes,recurring_type,recurring_anchor_day,recurring_start_on,recurring_end_on,recurring_parent_id')
    .eq('user_id', userId)
    .in('recurring_type', RECURRING_TYPES)
    .is('recurring_parent_id', null)
    .limit(300)

  if (templateRes.error) {
    if (isMissingRecurringColumnError(templateRes.error)) return
    throw templateRes.error
  }

  const templates = templateRes.data || []
  if (templates.length === 0) return
  const materializeUntilIso = endOfMonthAfterMonthsIso(RECURRING_MATERIALIZE_AHEAD_MONTHS)
  const pendingRows = []

  for (const tpl of templates) {
    const type = String(tpl.recurring_type || '')
    if (!RECURRING_TYPES.includes(type)) continue

    const startIso = toIsoDate(tpl.recurring_start_on || tpl.spent_on)
    const endIsoRaw = toIsoDate(tpl.recurring_end_on || '')
    const endIso = endIsoRaw && endIsoRaw < materializeUntilIso ? endIsoRaw : materializeUntilIso
    if (!startIso || startIso > endIso) continue

    const existingRes = await supabase
      .from('user_expenses')
      .select('spent_on')
      .eq('user_id', userId)
      .or(`id.eq.${tpl.id},recurring_parent_id.eq.${tpl.id}`)
      .limit(500)
    if (existingRes.error) throw existingRes.error

    const existingDates = new Set((existingRes.data || []).map((row) => String(row.spent_on || '').slice(0, 10)).filter(Boolean))
    let cursor = startIso
    const anchorDay = Number(tpl.recurring_anchor_day || startIso.slice(8, 10) || 1)
    let guard = 0

    while (guard < 1000) {
      guard += 1
      cursor = type === 'weekly' ? addDaysIso(cursor, 7) : addMonthsAnchoredIso(cursor, 1, anchorDay)
      if (!cursor || cursor > endIso) break
      if (existingDates.has(cursor)) continue
      pendingRows.push({
        user_id: userId,
        spent_on: cursor,
        category: tpl.category || 'その他',
        merchant: tpl.merchant || '',
        amount: Math.max(0, Number(tpl.amount || 0)),
        payment_method: tpl.payment_method || '',
        notes: tpl.notes || '',
        recurring_type: null,
        recurring_anchor_day: null,
        recurring_start_on: null,
        recurring_end_on: null,
        recurring_parent_id: tpl.id,
      })
      existingDates.add(cursor)
    }
  }

  if (pendingRows.length > 0) {
    const { error } = await supabase.from('user_expenses').insert(pendingRows)
    if (error) throw error
  }
}

export const loadMyPageData = async (userId) => {
  if (!userId) {
    return {
      expenses: [],
      insurances: [],
      assetPositions: [],
      pointAccounts: [],
      profile: { annual_income_manwon: 0, budget_target_yen: 0 },
      available: false,
    }
  }

  try {
    await materializeRecurringExpenses(userId)
  } catch (error) {
    if (!isMissingRecurringColumnError(error)) throw error
  }

  const [expenseRes, insuranceRes, assetRes, pointRes, profileRes] = await Promise.all([
    fetchExpensesRows(userId),
    supabase
      .from('user_insurances')
      .select('id,product_name,provider,monthly_premium,maturity_date,coverage_summary,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_asset_positions')
      .select('id,name,current_value,invest_value,color,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_point_accounts')
      .select('id,name,balance,expiry,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_finance_profiles')
      .select('annual_income_manwon,budget_target_yen,loan_remaining_yen')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const firstErr = expenseRes.error || insuranceRes.error || assetRes.error || pointRes.error || profileRes.error
  if (firstErr) {
    if (isTableMissingError(firstErr)) {
      return {
        expenses: [],
        insurances: [],
        assetPositions: [],
        pointAccounts: [],
        profile: { annual_income_manwon: 0, budget_target_yen: 0, loan_remaining_yen: 0 },
        available: false,
      }
    }
    throw firstErr
  }

  return {
    expenses: expenseRes.data || [],
    insurances: insuranceRes.data || [],
    assetPositions: assetRes.data || [],
    pointAccounts: pointRes.data || [],
    profile: profileRes.data || { annual_income_manwon: 0, budget_target_yen: 0, loan_remaining_yen: 0 },
    available: true,
  }
}

export const addExpense = async (payload) => {
  const hasRecurringPayload = ['recurring_type', 'recurring_anchor_day', 'recurring_start_on', 'recurring_end_on', 'recurring_parent_id']
    .some((key) => key in (payload || {}))

  const { data, error } = await supabase
    .from('user_expenses')
    .insert(payload)
    .select(EXPENSE_SELECT_WITH_RECURRING)
    .single()
  if (error) {
    if (isMissingRecurringColumnError(error)) {
      if (hasRecurringPayload) {
        throw new Error('定期支出機能を使うには、user_expenses の定期カラムSQLを適用してください。')
      }
      const legacyPayload = omitExpenseRecurringKeys(payload)
      const retry = await supabase
        .from('user_expenses')
        .insert(legacyPayload)
        .select(EXPENSE_SELECT_LEGACY)
        .single()
      if (retry.error) throw retry.error
      return {
        ...retry.data,
        recurring_type: null,
        recurring_anchor_day: null,
        recurring_start_on: null,
        recurring_end_on: null,
        recurring_parent_id: null,
      }
    }
    throw error
  }
  return data
}

export const deleteExpenseById = async (expenseId, userId) => {
  const { error } = await supabase
    .from('user_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', userId)
  if (error) throw error
}

export const updateExpense = async (expenseId, userId, payload) => {
  const updatePayload = {
    spent_on: payload.spent_on,
    category: payload.category,
    merchant: payload.merchant ?? null,
    amount: payload.amount,
    payment_method: payload.payment_method ?? null,
    notes: payload.notes ?? null,
  }
  if ('recurring_type' in payload) updatePayload.recurring_type = payload.recurring_type ?? null
  if ('recurring_anchor_day' in payload) updatePayload.recurring_anchor_day = payload.recurring_anchor_day ?? null
  if ('recurring_start_on' in payload) updatePayload.recurring_start_on = payload.recurring_start_on ?? null
  if ('recurring_end_on' in payload) updatePayload.recurring_end_on = payload.recurring_end_on ?? null
  const hasRecurringPayload = ['recurring_type', 'recurring_anchor_day', 'recurring_start_on', 'recurring_end_on']
    .some((key) => key in (payload || {}))

  const { data, error } = await supabase
    .from('user_expenses')
    .update(updatePayload)
    .eq('id', expenseId)
    .eq('user_id', userId)
    .select(EXPENSE_SELECT_WITH_RECURRING)
    .single()
  if (error) {
    if (isMissingRecurringColumnError(error)) {
      if (hasRecurringPayload) {
        throw new Error('定期支出機能を使うには、user_expenses の定期カラムSQLを適用してください。')
      }
      const legacyPayload = omitExpenseRecurringKeys(updatePayload)
      const retry = await supabase
        .from('user_expenses')
        .update(legacyPayload)
        .eq('id', expenseId)
        .eq('user_id', userId)
        .select(EXPENSE_SELECT_LEGACY)
        .single()
      if (retry.error) throw retry.error
      return {
        ...retry.data,
        recurring_type: null,
        recurring_anchor_day: null,
        recurring_start_on: null,
        recurring_end_on: null,
        recurring_parent_id: null,
      }
    }
    throw error
  }
  return data
}

export const addInsurance = async (payload) => {
  const { data, error } = await supabase
    .from('user_insurances')
    .insert(payload)
    .select('id,product_name,provider,monthly_premium,maturity_date,coverage_summary,created_at')
    .single()
  if (error) throw error
  return data
}

export const deleteInsuranceById = async (insuranceId, userId) => {
  const { error } = await supabase
    .from('user_insurances')
    .delete()
    .eq('id', insuranceId)
    .eq('user_id', userId)
  if (error) throw error
}

export const updateInsurance = async (insuranceId, userId, payload) => {
  const { data, error } = await supabase
    .from('user_insurances')
    .update({
      product_name: payload.product_name,
      provider: payload.provider ?? null,
      monthly_premium: payload.monthly_premium ?? null,
      maturity_date: payload.maturity_date ?? null,
      coverage_summary: payload.coverage_summary ?? null,
    })
    .eq('id', insuranceId)
    .eq('user_id', userId)
    .select('id,product_name,provider,monthly_premium,maturity_date,coverage_summary,created_at')
    .single()
  if (error) throw error
  return data
}

export const saveFinanceProfile = async ({ userId, annualIncomeManwon, budgetTargetYen, loanRemainingYen }) => {
  const payload = { user_id: userId }
  if (annualIncomeManwon != null) {
    payload.annual_income_manwon = Math.max(0, Number(annualIncomeManwon || 0))
  }
  if (budgetTargetYen != null) {
    payload.budget_target_yen = Math.max(0, Number(budgetTargetYen || 0))
  }
  if (loanRemainingYen != null) {
    payload.loan_remaining_yen = Math.max(0, Number(loanRemainingYen || 0))
  }
  const { data, error } = await supabase
    .from('user_finance_profiles')
    .upsert(payload)
    .select('annual_income_manwon,budget_target_yen,loan_remaining_yen')
    .single()
  if (error) throw error
  return data
}

export const addPointAccount = async (payload) => {
  const { data, error } = await supabase
    .from('user_point_accounts')
    .insert(payload)
    .select('id,name,balance,expiry,created_at')
    .single()
  if (error) throw error
  return data
}

export const deletePointAccountById = async (pointId, userId) => {
  const { error } = await supabase
    .from('user_point_accounts')
    .delete()
    .eq('id', pointId)
    .eq('user_id', userId)
  if (error) throw error
}

export const updatePointAccount = async (pointId, userId, payload) => {
  const { data, error } = await supabase
    .from('user_point_accounts')
    .update({
      name: payload.name,
      balance: payload.balance,
      expiry: payload.expiry ?? null,
    })
    .eq('id', pointId)
    .eq('user_id', userId)
    .select('id,name,balance,expiry,created_at')
    .single()
  if (error) throw error
  return data
}

export const addAssetPosition = async (payload) => {
  const { data, error } = await supabase
    .from('user_asset_positions')
    .insert(payload)
    .select('id,name,current_value,invest_value,color,created_at')
    .single()
  if (error) throw error
  return data
}

export const updateAssetPosition = async ({ id, userId, name, current_value, invest_value, color }) => {
  const { data, error } = await supabase
    .from('user_asset_positions')
    .update({
      name,
      current_value,
      invest_value,
      color,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id,name,current_value,invest_value,color,created_at')
    .single()
  if (error) throw error
  return data
}

export const deleteAssetPositionById = async (assetId, userId) => {
  const { error } = await supabase
    .from('user_asset_positions')
    .delete()
    .eq('id', assetId)
    .eq('user_id', userId)
  if (error) throw error
}

export const loadOwnedAssetPositions = async (userId) => {
  if (!userId) {
    return { ownedStocks: [], ownedFunds: [], available: false }
  }

  const [stockRes, fundRes] = await Promise.all([
    supabase
      .from('user_owned_stocks')
      .select('lot_id,symbol,buy_date,buy_price,qty,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('user_owned_funds')
      .select('fund_row_id,symbol,name,invest_amount,buy_date,buy_price,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ])

  const firstErr = stockRes.error || fundRes.error
  if (firstErr) {
    if (isTableMissingError(firstErr)) {
      return { ownedStocks: [], ownedFunds: [], available: false }
    }
    throw firstErr
  }

  const stockDedup = new Map()
  ;(stockRes.data || []).forEach((row) => {
    const id = String(row.lot_id || '').trim()
    if (!id) return
    const prev = stockDedup.get(id)
    if (!prev) {
      stockDedup.set(id, row)
      return
    }
    const tNew = new Date(row.created_at || 0).getTime()
    const tOld = new Date(prev.created_at || 0).getTime()
    if (tNew >= tOld) stockDedup.set(id, row)
  })

  const ownedStocks = [...stockDedup.values()].map((row) => ({
    lotId: String(row.lot_id || ''),
    symbol: String(row.symbol || '').toUpperCase(),
    buyDate: String(row.buy_date || ''),
    buyPrice: Number(row.buy_price || 0),
    qty: Number(row.qty || 0),
  }))

  /** 並行 replace で DB に重複行ができた場合も 1 件にまとめる（fund_row_id 単位・新しい created_at を優先） */
  const fundDedup = new Map()
  ;(fundRes.data || []).forEach((row) => {
    const id = String(row.fund_row_id || '').trim()
    if (!id) return
    const prev = fundDedup.get(id)
    if (!prev) {
      fundDedup.set(id, row)
      return
    }
    const tNew = new Date(row.created_at || 0).getTime()
    const tOld = new Date(prev.created_at || 0).getTime()
    if (tNew >= tOld) fundDedup.set(id, row)
  })

  const ownedFunds = [...fundDedup.values()].map((row) => ({
    id: String(row.fund_row_id || ''),
    symbol: String(row.symbol || '').toUpperCase(),
    name: decodeHtmlEntities(String(row.name || row.symbol || '')),
    investAmount: Number(row.invest_amount || 0),
    buyDate: String(row.buy_date || ''),
    buyPrice: Number(row.buy_price || 0),
  }))

  return { ownedStocks, ownedFunds, available: true }
}

/** 同テーブルへの replace が非同期で重なると delete→insert が交差し行が倍増するため、テーブル単位で直列化 */
let ownedStocksReplaceChain = Promise.resolve()
let ownedFundsReplaceChain = Promise.resolve()

const runSerializedOwnedStocksReplace = (fn) => {
  const p = ownedStocksReplaceChain.then(() => fn())
  ownedStocksReplaceChain = p.catch(() => {})
  return p
}

const runSerializedOwnedFundsReplace = (fn) => {
  const p = ownedFundsReplaceChain.then(() => fn())
  ownedFundsReplaceChain = p.catch(() => {})
  return p
}

const fetchUserProfilePaidFlag = async (userId) => {
  if (!userId) return false
  const { data, error } = await supabase
    .from('user_profiles')
    .select('plan_tier, membership_tier, subscription_tier, plan, is_premium, is_prime, prime_member')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return false
  return isPaidFromUserProfileRow(data)
}

/**
 * 保有株式・ファンドを DB に反映。
 * persistStocks / persistFunds を分けると、片方の state が一瞬空でも他テーブルを消さない（データ消失防止）。
 *
 * allowEmptyStocksReplace / allowEmptyFundsReplace:
 * false（既定）のとき、該当スナップショットが空配列なら DELETE を実行しない（誤った全消去を防ぐ）。
 * ユーザーが UI 上で最後の 1 件まで削除したときのみクライアントが true を渡す。
 */
export const replaceOwnedAssetPositions = async ({
  userId,
  ownedStocks = [],
  ownedFunds = [],
  persistStocks = true,
  persistFunds = true,
  allowEmptyStocksReplace = false,
  allowEmptyFundsReplace = false,
}) => {
  if (!userId) return

  const stockRows = (Array.isArray(ownedStocks) ? ownedStocks : [])
    .map((row, idx) => {
      const symbol = String(row?.symbol || '').trim().toUpperCase()
      let lotId = String(row?.lotId || '').trim()
      if (!lotId) lotId = `lot_${idx}`
      if (!symbol || !lotId) return null
      const buyDate = String(row?.buyDate || '').trim()
      const buyPrice = Number(row?.buyPrice || 0)
      const qty = Number(row?.qty || 0)
      return {
        user_id: userId,
        lot_id: lotId,
        symbol,
        buy_date: buyDate || null,
        buy_price: Number.isFinite(buyPrice) && buyPrice >= 0 ? buyPrice : 0,
        qty: Number.isFinite(qty) && qty >= 0 ? qty : 0,
      }
    })
    .filter(Boolean)

  const fundRows = (Array.isArray(ownedFunds) ? ownedFunds : [])
    .map((row, idx) => {
      const symbol = String(row?.symbol || '').trim().toUpperCase()
      let fundRowId = String(row?.id || '').trim()
      if (!fundRowId) fundRowId = `fund_${idx}`
      if (!symbol || !fundRowId) return null
      const investAmount = Number(row?.investAmount || 0)
      const buyPrice = Number(row?.buyPrice || 0)
      const buyDate = String(row?.buyDate || '').trim()
      return {
        user_id: userId,
        fund_row_id: fundRowId,
        symbol,
        name: decodeHtmlEntities(String(row?.name || symbol)),
        invest_amount: Number.isFinite(investAmount) && investAmount >= 0 ? investAmount : 0,
        buy_date: buyDate || null,
        buy_price: Number.isFinite(buyPrice) && buyPrice >= 0 ? buyPrice : 0,
      }
    })
    .filter(Boolean)

  const stockRowMap = new Map()
  stockRows.forEach((r) => {
    const k = String(r?.lot_id || '').trim()
    if (!k) return
    stockRowMap.set(k, { ...r, lot_id: k })
  })
  const stockRowsUnique = [...stockRowMap.values()]

  const fundRowMap = new Map()
  fundRows.forEach((r) => {
    const k = String(r?.fund_row_id || '').trim()
    if (!k) return
    fundRowMap.set(k, { ...r, fund_row_id: k })
  })
  const fundRowsUnique = [...fundRowMap.values()]

  const paid = await fetchUserProfilePaidFlag(userId)
  if (!paid && ENFORCE_FREE_OWNED_DISTINCT_SYMBOL_CAPS) {
    if (persistStocks) {
      const stockSymCount = new Set(stockRowsUnique.map((r) => String(r.symbol || '').toUpperCase())).size
      if (stockSymCount > FREE_OWNED_DISTINCT_STOCK_SYMBOLS) {
        throw new Error(
          `保有株式は銘柄種類${FREE_OWNED_DISTINCT_STOCK_SYMBOLS}件まで登録できます。`,
        )
      }
    }
    if (persistFunds) {
      const fundSymCount = new Set(fundRowsUnique.map((r) => String(r.symbol || '').toUpperCase())).size
      if (fundSymCount > FREE_OWNED_DISTINCT_FUND_SYMBOLS) {
        throw new Error(
          `保有ファンドは銘柄種類${FREE_OWNED_DISTINCT_FUND_SYMBOLS}件まで登録できます。`,
        )
      }
    }
  }

  const shouldWriteStocks =
    persistStocks && (stockRowsUnique.length > 0 || allowEmptyStocksReplace)
  const shouldWriteFunds =
    persistFunds && (fundRowsUnique.length > 0 || allowEmptyFundsReplace)

  const tasks = []
  if (shouldWriteStocks) {
    tasks.push(
      runSerializedOwnedStocksReplace(async () => {
        const { data: backupStockRows, error: backupStockErr } = await supabase
          .from('user_owned_stocks')
          .select('user_id,lot_id,symbol,buy_date,buy_price,qty')
          .eq('user_id', userId)
        if (backupStockErr) throw backupStockErr
        const backupStocks = Array.isArray(backupStockRows) ? backupStockRows : []

        const { error: delStockErr } = await supabase
          .from('user_owned_stocks')
          .delete()
          .eq('user_id', userId)
        if (delStockErr) throw delStockErr

        if (stockRowsUnique.length > 0) {
          const tryInsert = async () => supabase.from('user_owned_stocks').insert(stockRowsUnique)
          let ins = await tryInsert()
          if (ins.error?.code === PG_UNIQUE_VIOLATION) {
            const { error: del2 } = await supabase.from('user_owned_stocks').delete().eq('user_id', userId)
            if (del2) {
              if (backupStocks.length > 0) {
                const { error: reErr } = await supabase.from('user_owned_stocks').insert(backupStocks)
                if (reErr) {
                  throw new Error(
                    `保有株式の保存に失敗し、復元にも失敗しました: ${reErr.message}（元: ${del2.message}）`,
                  )
                }
              }
              throw del2
            }
            ins = await tryInsert()
          }
          if (ins.error) {
            if (backupStocks.length > 0) {
              const { error: reErr } = await supabase.from('user_owned_stocks').insert(backupStocks)
              if (reErr) {
                throw new Error(
                  `保有株式の保存に失敗し、直前のデータの復元にも失敗しました: ${reErr.message}（元: ${ins.error.message}）`,
                )
              }
            }
            throw ins.error
          }
        }
      }),
    )
  }

  if (shouldWriteFunds) {
    tasks.push(
      runSerializedOwnedFundsReplace(async () => {
        const { data: backupFundRows, error: backupFundErr } = await supabase
          .from('user_owned_funds')
          .select('user_id,fund_row_id,symbol,name,invest_amount,buy_date,buy_price')
          .eq('user_id', userId)
        if (backupFundErr) throw backupFundErr
        const backupFunds = Array.isArray(backupFundRows) ? backupFundRows : []

        const { error: delFundErr } = await supabase
          .from('user_owned_funds')
          .delete()
          .eq('user_id', userId)
        if (delFundErr) throw delFundErr

        if (fundRowsUnique.length > 0) {
          const tryInsert = async () => supabase.from('user_owned_funds').insert(fundRowsUnique)
          let ins = await tryInsert()
          if (ins.error?.code === PG_UNIQUE_VIOLATION) {
            const { error: del2 } = await supabase.from('user_owned_funds').delete().eq('user_id', userId)
            if (del2) {
              if (backupFunds.length > 0) {
                const { error: reErr } = await supabase.from('user_owned_funds').insert(backupFunds)
                if (reErr) {
                  throw new Error(
                    `保有ファンドの保存に失敗し、復元にも失敗しました: ${reErr.message}（元: ${del2.message}）`,
                  )
                }
              }
              throw del2
            }
            ins = await tryInsert()
          }
          if (ins.error) {
            if (backupFunds.length > 0) {
              const { error: reErr } = await supabase.from('user_owned_funds').insert(backupFunds)
              if (reErr) {
                throw new Error(
                  `保有ファンドの保存に失敗し、直前のデータの復元にも失敗しました: ${reErr.message}（元: ${ins.error.message}）`,
                )
              }
            }
            throw ins.error
          }
        }
      }),
    )
  }

  await Promise.all(tasks)
}

export const loadRefinanceProducts = async () => {
  const { data, error } = await supabase
    .from('loan_refinance_products')
    .select('id,bank_name,product_name,apr_min,apr_max,fees_yen,min_amount_yen,max_amount_yen,apply_url,source_type,notes,sort_order,is_active,updated_at')
    .eq('is_active', true)
    .order('apr_min', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) {
    if (isTableMissingError(error)) return { rows: [], available: false }
    throw error
  }
  return { rows: data || [], available: true }
}

export const loadUserRevolvingProfile = async (userId) => {
  if (!userId) return { profile: { ...DEFAULT_REVOLVING_PROFILE }, available: false }
  const { data, error } = await supabase
    .from('user_revolving_profiles')
    .select('balance_yen,apr,monthly_payment_yen,remaining_months_assumed,refinance_fee_yen,updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (isTableMissingError(error)) return { profile: { ...DEFAULT_REVOLVING_PROFILE }, available: false }
    throw error
  }
  return {
    profile: data || { ...DEFAULT_REVOLVING_PROFILE },
    available: true,
  }
}

export const saveUserRevolvingProfile = async ({ userId, balanceYen, apr, monthlyPaymentYen, remainingMonthsAssumed = 24, refinanceFeeYen = 0 }) => {
  const payload = {
    user_id: userId,
    balance_yen: Math.max(0, Number(balanceYen || 0)),
    apr: Math.max(0, Number(apr || 0)),
    monthly_payment_yen: Math.max(0, Number(monthlyPaymentYen || 0)),
    remaining_months_assumed: Math.max(1, Number(remainingMonthsAssumed || 24)),
    refinance_fee_yen: Math.max(0, Number(refinanceFeeYen || 0)),
  }
  const { data, error } = await supabase
    .from('user_revolving_profiles')
    .upsert(payload)
    .select('balance_yen,apr,monthly_payment_yen,remaining_months_assumed,refinance_fee_yen,updated_at')
    .single()
  if (error) throw error
  return data
}

export const saveRefinanceSimulation = async ({
  userId,
  bestProductId = null,
  currentTotalCost24mYen = 0,
  bestOfferTotalCost24mYen = 0,
  savings24mYen = 0,
  resultJson = {},
}) => {
  const { data, error } = await supabase
    .from('refinance_simulations')
    .insert([{
      user_id: userId,
      best_product_id: bestProductId,
      current_total_cost_24m: Math.round(Number(currentTotalCost24mYen || 0)),
      best_offer_total_cost_24m: Math.round(Number(bestOfferTotalCost24mYen || 0)),
      savings_24m: Math.round(Number(savings24mYen || 0)),
      result_json: resultJson || {},
    }])
    .select('id,created_at')
    .single()
  if (error) throw error
  return data
}

export const loadUserRevolvingDebts = async (userId) => {
  if (!userId) return { rows: [], available: false }
  const { data, error } = await supabase
    .from('user_revolving_debts')
    .select('id,provider,debt_type,balance_yen,interest_rate,monthly_payment_yen,created_at,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) {
    if (isTableMissingError(error)) return { rows: [], available: false }
    throw error
  }
  return { rows: data || [], available: true }
}

export const addRevolvingDebt = async ({ userId, provider = '', debtType = 'card', balanceYen = 0, interestRate = 0, monthlyPaymentYen = 0 }) => {
  const normalizedDebtType = ['mortgage', 'card', 'revolving', 'other'].includes(String(debtType || '').toLowerCase())
    ? String(debtType || '').toLowerCase()
    : 'card'
  const { data, error } = await supabase
    .from('user_revolving_debts')
    .insert({
      user_id: userId,
      provider: String(provider || '').trim() || '未設定',
      debt_type: normalizedDebtType,
      balance_yen: Math.max(0, Number(balanceYen || 0)),
      interest_rate: Math.max(0, Number(interestRate || 0)),
      monthly_payment_yen: Math.max(0, Number(monthlyPaymentYen || 0)),
    })
    .select('id,provider,debt_type,balance_yen,interest_rate,monthly_payment_yen,created_at,updated_at')
    .single()
  if (error) throw error
  return data
}

export const updateRevolvingDebt = async ({ userId, debtId, provider, debtType, balanceYen, interestRate, monthlyPaymentYen }) => {
  const payload = {}
  if (provider !== undefined) payload.provider = String(provider || '').trim() || '未設定'
  if (debtType !== undefined) {
    const normalizedDebtType = ['mortgage', 'card', 'revolving', 'other'].includes(String(debtType || '').toLowerCase())
      ? String(debtType || '').toLowerCase()
      : 'card'
    payload.debt_type = normalizedDebtType
  }
  if (balanceYen !== undefined) payload.balance_yen = Math.max(0, Number(balanceYen || 0))
  if (interestRate !== undefined) payload.interest_rate = Math.max(0, Number(interestRate || 0))
  if (monthlyPaymentYen !== undefined) payload.monthly_payment_yen = Math.max(0, Number(monthlyPaymentYen || 0))
  if (Object.keys(payload).length === 0) return null
  const { data, error } = await supabase
    .from('user_revolving_debts')
    .update(payload)
    .eq('id', debtId)
    .eq('user_id', userId)
    .select('id,provider,debt_type,balance_yen,interest_rate,monthly_payment_yen,created_at,updated_at')
    .single()
  if (error) throw error
  return data
}

export const deleteRevolvingDebt = async (userId, debtId) => {
  const { error } = await supabase
    .from('user_revolving_debts')
    .delete()
    .eq('id', debtId)
    .eq('user_id', userId)
  if (error) throw error
}

export const loadTaxShieldRules = async (taxYear = new Date().getFullYear()) => {
  const year = Math.floor(Number(taxYear || new Date().getFullYear()))
  const { data, error } = await supabase
    .from('tax_shield_rules')
    .select('id,tax_year,deduction_type,cap_yen,deduction_rate,deadline_month,deadline_day,note,sort_order,is_active,updated_at')
    .eq('tax_year', year)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('deduction_type', { ascending: true })
  if (error) {
    if (isTableMissingError(error)) return { rows: [], available: false }
    throw error
  }
  return { rows: data || [], available: true }
}

/** Admin: load all rules including inactive */
export const loadTaxShieldRulesForAdmin = async (taxYear = new Date().getFullYear()) => {
  const year = Math.floor(Number(taxYear || new Date().getFullYear()))
  const { data, error } = await supabase
    .from('tax_shield_rules')
    .select('id,tax_year,deduction_type,cap_yen,deduction_rate,deadline_month,deadline_day,note,sort_order,is_active,updated_at')
    .eq('tax_year', year)
    .order('sort_order', { ascending: true })
    .order('deduction_type', { ascending: true })
  if (error) {
    if (isTableMissingError(error)) return { rows: [], available: false }
    throw error
  }
  return { rows: data || [], available: true }
}

export const upsertTaxShieldRule = async (payload) => {
  const row = {
    tax_year: Math.floor(Number(payload.tax_year || new Date().getFullYear())),
    deduction_type: String(payload.deduction_type || 'ideco').toLowerCase(),
    cap_yen: Math.max(0, Number(payload.cap_yen || 0)),
    deduction_rate: Math.max(0, Math.min(1, Number(payload.deduction_rate ?? 0.1))),
    deadline_month: Math.min(12, Math.max(1, Number(payload.deadline_month ?? 12))),
    deadline_day: Math.min(31, Math.max(1, Number(payload.deadline_day ?? 31))),
    note: String(payload.note || ''),
    sort_order: Math.max(0, Number(payload.sort_order || 0)),
    is_active: Boolean(payload.is_active !== false),
  }
  if (payload.id) {
    const { data, error } = await supabase
      .from('tax_shield_rules')
      .update(row)
      .eq('id', payload.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from('tax_shield_rules')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteTaxShieldRule = async (id) => {
  const { error } = await supabase
    .from('tax_shield_rules')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export const loadUserTaxShieldProfile = async (userId, taxYear = new Date().getFullYear()) => {
  const year = Math.floor(Number(taxYear || new Date().getFullYear()))
  if (!userId) return { profile: DEFAULT_TAX_SHIELD_PROFILE(year), available: false }
  const { data, error } = await supabase
    .from('user_tax_shield_profiles')
    .select('tax_year,annual_income_yen,ideco_paid_yen,nisa_paid_yen,insurance_paid_yen,deduction_reflected,updated_at')
    .eq('user_id', userId)
    .eq('tax_year', year)
    .maybeSingle()
  if (error) {
    if (isTableMissingError(error)) return { profile: DEFAULT_TAX_SHIELD_PROFILE(year), available: false }
    throw error
  }
  const base = data || DEFAULT_TAX_SHIELD_PROFILE(year)
  const profile = {
    ...base,
    annual_income_manwon: Math.round((base.annual_income_yen || 0) / 10000),
  }
  return { profile, available: true }
}

export const saveUserTaxShieldProfile = async ({
  userId,
  taxYear = new Date().getFullYear(),
  annualIncomeYen = 0,
  annualIncomeManwon,
  idecoPaidYen = 0,
  nisaPaidYen = 0,
  insurancePaidYen = 0,
  deductionReflected = false,
}) => {
  const incomeYen = Number.isFinite(annualIncomeManwon) && annualIncomeManwon >= 0
    ? Math.max(0, annualIncomeManwon * 10000)
    : Math.max(0, Number(annualIncomeYen || 0))
  const payload = {
    user_id: userId,
    tax_year: Math.floor(Number(taxYear || new Date().getFullYear())),
    annual_income_yen: Math.max(0, incomeYen),
    ideco_paid_yen: Math.max(0, Number(idecoPaidYen || 0)),
    nisa_paid_yen: Math.max(0, Number(nisaPaidYen || 0)),
    insurance_paid_yen: Math.max(0, Number(insurancePaidYen || 0)),
    deduction_reflected: Boolean(deductionReflected),
  }
  const { data, error } = await supabase
    .from('user_tax_shield_profiles')
    .upsert(payload)
    .select('tax_year,annual_income_yen,ideco_paid_yen,nisa_paid_yen,insurance_paid_yen,deduction_reflected,updated_at')
    .single()
  if (error) throw error
  return data
}

export const saveTaxShieldSimulation = async ({
  userId,
  taxYear = new Date().getFullYear(),
  estimatedDeductionYen = 0,
  potentialTaxSavingYen = 0,
  status = 'opportunity',
  resultJson = {},
}) => {
  const { data, error } = await supabase
    .from('tax_shield_simulations')
    .insert([{
      user_id: userId,
      tax_year: Math.floor(Number(taxYear || new Date().getFullYear())),
      estimated_deduction_yen: Math.round(Number(estimatedDeductionYen || 0)),
      potential_tax_saving_yen: Math.round(Number(potentialTaxSavingYen || 0)),
      status: ['opportunity', 'deadline_soon', 'limit_exceeded', 'optimized'].includes(String(status))
        ? status
        : 'opportunity',
      result_json: resultJson || {},
    }])
    .select('id,created_at')
    .single()
  if (error) throw error
  return data
}

export const loadUserCashFlowOptimizerProfile = async (userId, taxYear = new Date().getFullYear()) => {
  const year = Math.floor(Number(taxYear || new Date().getFullYear()))
  if (!userId) return { profile: DEFAULT_CASHFLOW_OPTIMIZER_PROFILE(year), available: false }
  const { data, error } = await supabase
    .from('user_cashflow_optimizer_profiles')
    .select('tax_year,cash_balance_yen,current_cash_rate,high_yield_cash_rate,reserve_month_multiplier,updated_at')
    .eq('user_id', userId)
    .eq('tax_year', year)
    .maybeSingle()
  if (error) {
    if (isTableMissingError(error)) return { profile: DEFAULT_CASHFLOW_OPTIMIZER_PROFILE(year), available: false }
    throw error
  }
  return {
    profile: data || DEFAULT_CASHFLOW_OPTIMIZER_PROFILE(year),
    available: true,
  }
}

export const saveUserCashFlowOptimizerProfile = async ({
  userId,
  taxYear = new Date().getFullYear(),
  cashBalanceYen = 0,
  currentCashRate = 0.001,
  highYieldCashRate = 0.003,
  reserveMonthMultiplier = 1.5,
}) => {
  const payload = {
    user_id: userId,
    tax_year: Math.floor(Number(taxYear || new Date().getFullYear())),
    cash_balance_yen: Math.max(0, Number(cashBalanceYen || 0)),
    current_cash_rate: Math.max(0, Math.min(1, Number(currentCashRate || 0))),
    high_yield_cash_rate: Math.max(0, Math.min(1, Number(highYieldCashRate || 0))),
    reserve_month_multiplier: Math.max(0.5, Math.min(6, Number(reserveMonthMultiplier || 1.5))),
  }
  const { data, error } = await supabase
    .from('user_cashflow_optimizer_profiles')
    .upsert(payload)
    .select('tax_year,cash_balance_yen,current_cash_rate,high_yield_cash_rate,reserve_month_multiplier,updated_at')
    .single()
  if (error) throw error
  return data
}

export const saveCashFlowOptimizerSimulation = async ({
  userId,
  taxYear = new Date().getFullYear(),
  reserveTargetYen = 0,
  idleCashYen = 0,
  additionalInterestYen = 0,
  status = 'optimized',
  resultJson = {},
}) => {
  const safeStatus = ['opportunity', 'buffer_shortage', 'optimized'].includes(String(status))
    ? status
    : 'optimized'
  const { data, error } = await supabase
    .from('cashflow_optimizer_simulations')
    .insert([{
      user_id: userId,
      tax_year: Math.floor(Number(taxYear || new Date().getFullYear())),
      reserve_target_yen: Math.max(0, Math.round(Number(reserveTargetYen || 0))),
      idle_cash_yen: Math.max(0, Math.round(Number(idleCashYen || 0))),
      additional_interest_yen: Math.max(0, Math.round(Number(additionalInterestYen || 0))),
      status: safeStatus,
      result_json: resultJson || {},
    }])
    .select('id,created_at')
    .single()
  if (error) throw error
  return data
}


export const loadDbWatchlists = async (userId) => {
  if (!userId) return { fund: [], product: [], stock: [], available: false }
  const { data, error } = await supabase
    .from('user_watchlists')
    .select('item_type,item_id,item_name,metadata,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) {
    if (isTableMissingError(error)) return { fund: [], product: [], stock: [], available: false }
    throw error
  }

  const rows = data || []
  const fund = rows
    .filter((r) => r.item_type === 'fund')
    .map((r) => ({
      id: r.item_id,
      name: r.item_name || r.item_id,
      change: Number(r.metadata?.change || 0),
      trend: Number(r.metadata?.change || 0) >= 0 ? 'up' : 'down',
      watchGroup: String(r.metadata?.watchGroup || r.metadata?.watch_group || '').trim(),
    }))
  const product = rows
    .filter((r) => r.item_type === 'product')
    .map((r) => {
      const parsed = Number.parseInt(String(r.item_id), 10)
      return {
        id: Number.isNaN(parsed) ? String(r.item_id) : parsed,
        name: r.item_name || String(r.item_id),
        provider: String(r.metadata?.provider || ''),
        category: String(r.metadata?.category || ''),
      }
    })
  const stock = rows
    .filter((r) => r.item_type === 'stock')
    .map((r) => ({
      id: String(r.item_id || '').trim().toUpperCase(),
      name: String(r.item_name || r.item_id || '').trim() || String(r.item_id),
    }))
    .filter((r) => r.id)

  return { fund, product, stock, available: true }
}

export const addDbWatchlistItem = async ({ userId, itemType, itemId, itemName, metadata = {} }) => {
  const { error } = await supabase
    .from('user_watchlists')
    .upsert(
      {
        user_id: userId,
        item_type: itemType,
        item_id: String(itemId),
        item_name: itemName || String(itemId),
        metadata,
      },
      { onConflict: 'user_id,item_type,item_id' }
    )
  if (error) throw error
}

export const removeDbWatchlistItem = async ({ userId, itemType, itemId }) => {
  const { error } = await supabase
    .from('user_watchlists')
    .delete()
    .eq('user_id', userId)
    .eq('item_type', itemType)
    .eq('item_id', String(itemId))
  if (error) throw error
}

/** 株式ウォッチリスト（銘柄コードの配列）。ログインユーザーは DB を正とする。 */
export const loadStockWatchlistSymbolsFromDb = async (userId) => {
  if (!userId) return { symbols: [], available: false }
  const { data, error } = await supabase
    .from('user_watchlists')
    .select('item_id,created_at')
    .eq('user_id', userId)
    .eq('item_type', 'stock')
    .order('created_at', { ascending: true })
  if (error) {
    if (isTableMissingError(error)) return { symbols: [], available: false }
    return { symbols: [], available: false }
  }
  const symbols = (data || [])
    .map((r) => String(r.item_id || '').trim().toUpperCase())
    .filter(Boolean)
  return { symbols: [...new Set(symbols)], available: true }
}

export const replaceStockWatchlistInDb = async ({ userId, symbols = [] }) => {
  if (!userId) return
  const unique = [...new Set((symbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))]
  const { error: delErr } = await supabase
    .from('user_watchlists')
    .delete()
    .eq('user_id', userId)
    .eq('item_type', 'stock')
  if (delErr) throw delErr
  if (unique.length === 0) return
  const rows = unique.map((symbol) => ({
    user_id: userId,
    item_type: 'stock',
    item_id: symbol,
    item_name: symbol,
    metadata: {},
  }))
  const { error } = await supabase.from('user_watchlists').insert(rows)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
//  配当カレンダー (user_dividend_watchlist)
// ─────────────────────────────────────────────────────────────────────────────

export const loadDividendWatchlist = async (userId) => {
  const withNisa = await supabase
    .from('user_dividend_watchlist')
    .select('*,is_nisa')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (!withNisa.error) return withNisa.data || []
  if (!isMissingNisaColumnError(withNisa.error)) throw withNisa.error
  const legacy = await supabase
    .from('user_dividend_watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (legacy.error) throw legacy.error
  return (legacy.data || []).map((row) => ({ ...row, is_nisa: false }))
}

export const upsertDividendWatchlistItem = async (userId, item) => {
  const safeIsNisa = Boolean(item?.is_nisa)
  const payload = {
    user_id:    userId,
    stock_id:   item.stock_id,
    stock_name: item.stock_name,
    flag:       item.flag      || '🏳️',
    sector:     item.sector    || '',
    color:      item.color     || '#6b7280',
    price:      item.price     || 0,
    qty:        item.qty       ?? 10,
    is_nisa:    safeIsNisa,
    dividends:  item.dividends || [],
    notes:      item.notes     || '',
  }
  const withNisa = await supabase
    .from('user_dividend_watchlist')
    .upsert(payload, { onConflict: 'user_id,stock_id' })
  if (!withNisa.error) return
  if (!isMissingNisaColumnError(withNisa.error)) throw withNisa.error
  // Backward compatibility: DB not migrated yet.
  const legacyPayload = { ...payload }
  delete legacyPayload.is_nisa
  const { error } = await supabase
    .from('user_dividend_watchlist')
    .upsert(legacyPayload, { onConflict: 'user_id,stock_id' })
  if (error) throw error
}

export const updateDividendWatchlistQty = async (userId, stockId, qty) => {
  const { error } = await supabase
    .from('user_dividend_watchlist')
    .update({ qty })
    .eq('user_id', userId)
    .eq('stock_id', stockId)
  if (error) throw error
}

export const deleteDividendWatchlistItem = async (userId, stockId) => {
  const { error } = await supabase
    .from('user_dividend_watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('stock_id', stockId)
  if (error) throw error
}

/** null | 5 | 10。API/DB が文字列を返しても正規化（MyPage の strict 比較ズレ防止）。 */
export const normalizeRiseThresholdPct = (raw) => {
  if (raw === null || raw === undefined || raw === '' || raw === 'off') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded === 5 || rounded === 10) return rounded
  return null
}

export const loadUserPortfolioDropAlertSetting = async (userId) => {
  if (!userId) {
    return {
      thresholdPct: DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT,
      riseThresholdPct: DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT,
      available: false,
    }
  }
  const { data, error } = await supabase
    .from('user_portfolio_alert_settings')
    .select('threshold_pct, rise_threshold_pct')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (isTableMissingError(error)) {
      return {
        thresholdPct: DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT,
        riseThresholdPct: DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT,
        available: false,
      }
    }
    if (error?.code === COLUMN_NOT_FOUND_CODE && /rise_threshold_pct/i.test(String(error?.message || ''))) {
      const { data: legacy, error: legacyErr } = await supabase
        .from('user_portfolio_alert_settings')
        .select('threshold_pct')
        .eq('user_id', userId)
        .maybeSingle()
      if (legacyErr) throw legacyErr
      const thresholdPct = normalizeDropThresholdPctFromDb(legacy?.threshold_pct)
      return {
        thresholdPct,
        riseThresholdPct: DEFAULT_PORTFOLIO_RISE_ALERT_THRESHOLD_PCT,
        available: true,
      }
    }
    throw error
  }
  const thresholdPct = normalizeDropThresholdPctFromDb(data?.threshold_pct)
  const riseRaw = data?.rise_threshold_pct
  const riseThresholdPct = riseRaw == null ? null : normalizeRiseThresholdPct(riseRaw)
  return {
    thresholdPct,
    riseThresholdPct,
    available: true,
  }
}

export const saveUserPortfolioDropAlertSetting = async ({ userId, thresholdPct, riseThresholdPct }) => {
  const normalizedThresholdPct = normalizeDropThresholdPctForSave(thresholdPct)
  const normalizedRise = normalizeRiseThresholdPct(riseThresholdPct)
  const row = {
    user_id: userId,
    threshold_pct: normalizedThresholdPct,
    rise_threshold_pct: normalizedRise,
  }
  const { data, error } = await supabase
    .from('user_portfolio_alert_settings')
    .upsert(row)
    .select('threshold_pct, rise_threshold_pct')
    .single()
  if (error) {
    if (error?.code === COLUMN_NOT_FOUND_CODE && /rise_threshold_pct/i.test(String(error?.message || ''))) {
      const { data: legacyData, error: legacyErr } = await supabase
        .from('user_portfolio_alert_settings')
        .upsert({
          user_id: userId,
          threshold_pct: normalizedThresholdPct,
        })
        .select('threshold_pct')
        .single()
      if (legacyErr) throw legacyErr
      return {
        thresholdPct: normalizeDropThresholdPctFromDb(legacyData?.threshold_pct),
        // rise_threshold_pct 列なしでは永続化できないが、保存直後 UI が即オフに戻るのを避ける
        riseThresholdPct: normalizedRise,
      }
    }
    throw error
  }
  return {
    thresholdPct: normalizeDropThresholdPctFromDb(data?.threshold_pct),
    riseThresholdPct: normalizeRiseThresholdPct(data?.rise_threshold_pct),
  }
}

export const loadUnreadPortfolioDropAlertCount = async (userId) => {
  if (!userId) return { count: 0, available: false }
  const { count, error } = await supabase
    .from('user_portfolio_alert_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error) {
    if (isTableMissingError(error)) return { count: 0, available: false }
    throw error
  }
  return { count: Number(count || 0), available: true }
}

export const upsertPortfolioDropAlertHistory = async ({
  userId,
  alertDate,
  baselineType,
  thresholdPct,
  changePct,
  baseDate = null,
  asOfDate = null,
  baseValue = 0,
  currentValue = 0,
  payload = {},
}) => {
  const safeBaselineType = String(baselineType || '').trim().toLowerCase()
  const allowedBaselines = ['daily', 'weekly', 'daily_gain', 'weekly_gain']
  if (!userId || !alertDate || !allowedBaselines.includes(safeBaselineType)) return { available: false }
  const { data: existing, error: existingErr } = await supabase
    .from('user_portfolio_alert_history')
    .select('id,is_active,read_at')
    .eq('user_id', userId)
    .eq('alert_date', alertDate)
    .eq('baseline_type', safeBaselineType)
    .maybeSingle()
  if (existingErr) {
    if (isTableMissingError(existingErr)) return { available: false }
    throw existingErr
  }

  const rowPayload = {
    user_id: userId,
    alert_date: alertDate,
    baseline_type: safeBaselineType,
    threshold_pct: Number(thresholdPct || DEFAULT_PORTFOLIO_DROP_ALERT_THRESHOLD_PCT),
    change_pct: Number(changePct || 0),
    base_date: baseDate || null,
    as_of_date: asOfDate || null,
    base_value: Math.max(0, Number(baseValue || 0)),
    current_value: Math.max(0, Number(currentValue || 0)),
    payload: payload && typeof payload === 'object' ? payload : {},
  }

  if (!existing?.id) {
    const { error } = await supabase.from('user_portfolio_alert_history').insert({
      ...rowPayload,
      is_active: true,
    })
    if (error) throw error
    return { available: true, inserted: true }
  }

  const { error } = await supabase
    .from('user_portfolio_alert_history')
    .update(rowPayload)
    .eq('id', existing.id)
    .eq('user_id', userId)
  if (error) throw error
  return { available: true, inserted: false }
}

export const acknowledgePortfolioDropAlerts = async ({ userId, alertDate = null }) => {
  if (!userId) return
  let q = supabase
    .from('user_portfolio_alert_history')
    .update({
      is_active: false,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_active', true)
  if (alertDate) q = q.eq('alert_date', alertDate)
  const { error } = await q
  if (error) throw error
}
