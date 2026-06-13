import { supabase } from './supabase'

const normalizeIds = (userIds = []) => [...new Set((userIds || []).filter(Boolean))]

const rowsToDisplayNameMap = (rows = [], fallback = 'Member') => new Map(
  (rows || []).map((row) => [
    row.user_id,
    row.nickname || row.full_name || fallback,
  ])
)

export async function fetchUserProfileDisplayNameMap(userIds = [], { fallback = 'Member' } = {}) {
  const ids = normalizeIds(userIds)
  if (ids.length === 0) return new Map()

  const rpcRes = await supabase.rpc('get_user_profile_display_names', { p_user_ids: ids })
  if (!rpcRes.error && Array.isArray(rpcRes.data)) {
    return rowsToDisplayNameMap(rpcRes.data, fallback)
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id,nickname,full_name')
    .in('user_id', ids)
  if (error) return new Map()
  return rowsToDisplayNameMap(data || [], fallback)
}
