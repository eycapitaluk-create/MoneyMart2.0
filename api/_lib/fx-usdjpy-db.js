import { createClient } from '@supabase/supabase-js'

export function getFxSupabaseAdmin() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** @returns {Promise<Record<string, number>>} */
export async function selectUsdJpyRange(admin, startIso, endIso) {
  const { data, error } = await admin
    .from('fx_daily_usdjpy')
    .select('as_of_date,usd_jpy')
    .gte('as_of_date', startIso)
    .lte('as_of_date', endIso)
  if (error) return {}
  const out = {}
  for (const row of data || []) {
    const d = String(row?.as_of_date || '').slice(0, 10)
    const v = Number(row?.usd_jpy)
    if (d && Number.isFinite(v) && v > 0) out[d] = v
  }
  return out
}

export async function selectUsdJpyOne(admin, dateIso) {
  const { data, error } = await admin
    .from('fx_daily_usdjpy')
    .select('usd_jpy')
    .eq('as_of_date', dateIso)
    .maybeSingle()
  if (error || !data) return null
  const v = Number(data.usd_jpy)
  return Number.isFinite(v) && v > 0 ? v : null
}

/** as_of_date <= date の直近営業日。 */
export async function selectUsdJpyOnOrBefore(admin, dateIso) {
  const { data, error } = await admin
    .from('fx_daily_usdjpy')
    .select('as_of_date,usd_jpy')
    .lte('as_of_date', dateIso)
    .order('as_of_date', { ascending: false })
    .limit(1)
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row) return null
  const rate = Number(row.usd_jpy)
  if (!(Number.isFinite(rate) && rate > 0)) return null
  return { asOf: String(row.as_of_date || '').slice(0, 10), rate }
}
