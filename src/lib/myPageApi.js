import { supabase } from './supabase'

const TABLE_NOT_FOUND_CODE = '42P01'

const isTableMissingError = (error) => (
  error?.code === TABLE_NOT_FOUND_CODE || /does not exist|schema cache/i.test(error?.message || '')
)

export const loadMyPageData = async (userId) => {
  if (!userId) {
    return {
      expenses: [],
      insurances: [],
      assetPositions: [],
      pointAccounts: [],
      profile: { annual_income_manwon: 0, budget_target_yen: 200000 },
      available: false,
    }
  }

  const [expenseRes, insuranceRes, assetRes, pointRes, profileRes] = await Promise.all([
    supabase
      .from('user_expenses')
      .select('id,spent_on,category,merchant,amount,payment_method,notes,created_at')
      .eq('user_id', userId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
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
      .select('annual_income_manwon,budget_target_yen')
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
        profile: { annual_income_manwon: 0, budget_target_yen: 200000 },
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
    profile: profileRes.data || { annual_income_manwon: 0, budget_target_yen: 200000 },
    available: true,
  }
}

export const addExpense = async (payload) => {
  const { data, error } = await supabase
    .from('user_expenses')
    .insert(payload)
    .select('id,spent_on,category,merchant,amount,payment_method,notes,created_at')
    .single()
  if (error) throw error
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

export const saveFinanceProfile = async ({ userId, annualIncomeManwon, budgetTargetYen }) => {
  const { data, error } = await supabase
    .from('user_finance_profiles')
    .upsert({
      user_id: userId,
      annual_income_manwon: Math.max(0, Number(annualIncomeManwon || 0)),
      budget_target_yen: Math.max(0, Number(budgetTargetYen || 0)),
    })
    .select('annual_income_manwon,budget_target_yen')
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

export const loadDbWatchlists = async (userId) => {
  if (!userId) return { fund: [], product: [], available: false }
  const { data, error } = await supabase
    .from('user_watchlists')
    .select('item_type,item_id,item_name,metadata,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) {
    if (isTableMissingError(error)) return { fund: [], product: [], available: false }
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

  return { fund, product, available: true }
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
