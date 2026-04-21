import { supabase } from './supabase'

/**
 * Curated dividend months per symbol (`dividend_master_schedule`).
 * `stock_id` must match `user_dividend_watchlist.stock_id` (e.g. AAPL, 8306, 2558.T).
 */
export async function fetchDividendMasterSchedule() {
  const { data, error } = await supabase
    .from('dividend_master_schedule')
    .select('*')
    .order('stock_id', { ascending: true })
    .order('dividend_month', { ascending: true })
    .order('calendar_year', { ascending: true, nullsFirst: true })
  if (error) throw error
  return data || []
}

/** Rows active for bell: given calendar month, recurring (year null) or matching calendar_year. */
export async function fetchDividendMasterScheduleForMonth(calendarYear, dividendMonth) {
  const y = Number(calendarYear)
  const m = Math.max(1, Math.min(12, Number(dividendMonth) || 1))
  if (!Number.isFinite(y)) throw new Error('calendarYear is required')
  const { data, error } = await supabase
    .from('dividend_master_schedule')
    .select('stock_id,asset_kind,name_hint,calendar_year,dividend_month')
    .eq('dividend_month', m)
    .or(`calendar_year.is.null,calendar_year.eq.${y}`)
  if (error) throw error
  return data || []
}

export async function insertDividendMasterRow(payload) {
  const row = {
    stock_id: String(payload.stock_id || '').trim(),
    asset_kind: ['us_stock', 'jp_stock', 'jp_fund'].includes(payload.asset_kind) ? payload.asset_kind : 'us_stock',
    dividend_month: Math.max(1, Math.min(12, Number(payload.dividend_month) || 1)),
    calendar_year: payload.calendar_year == null || payload.calendar_year === ''
      ? null
      : Math.max(2000, Math.min(2100, Number(payload.calendar_year))),
    name_hint: String(payload.name_hint || '').trim() || null,
    notes: String(payload.notes || '').trim() || null,
  }
  if (!row.stock_id) throw new Error('stock_id is required')
  const { error } = await supabase.from('dividend_master_schedule').insert([row])
  if (error) throw error
}

export async function updateDividendMasterRow(id, payload) {
  if (!id) throw new Error('id is required')
  const patch = {
    stock_id: String(payload.stock_id || '').trim(),
    asset_kind: ['us_stock', 'jp_stock', 'jp_fund'].includes(payload.asset_kind) ? payload.asset_kind : 'us_stock',
    dividend_month: Math.max(1, Math.min(12, Number(payload.dividend_month) || 1)),
    calendar_year: payload.calendar_year == null || payload.calendar_year === ''
      ? null
      : Math.max(2000, Math.min(2100, Number(payload.calendar_year))),
    name_hint: String(payload.name_hint || '').trim() || null,
    notes: String(payload.notes || '').trim() || null,
  }
  if (!patch.stock_id) throw new Error('stock_id is required')
  const { error } = await supabase.from('dividend_master_schedule').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteDividendMasterRow(id) {
  if (!id) throw new Error('id is required')
  const { error } = await supabase.from('dividend_master_schedule').delete().eq('id', id)
  if (error) throw error
}
