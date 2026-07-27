import { supabase } from './supabase'

const jstDateKey = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export async function awardDailyLoginExp() {
  const { data, error } = await supabase.rpc('community_award_daily_login')
  if (error) {
    if (String(error.message || '').toLowerCase().includes('does not exist')) return null
    throw error
  }
  return data
}

export async function awardCommunityExp(actionType, idempotencyKey, meta = {}) {
  const { data, error } = await supabase.rpc('community_award_exp', {
    p_action_type: actionType,
    p_idempotency_key: idempotencyKey,
    p_meta: meta,
  })
  if (error) {
    if (String(error.message || '').toLowerCase().includes('does not exist')) return null
    throw error
  }
  return data
}

export async function awardEmailVerifiedExp(userId) {
  if (!userId) return null
  return awardCommunityExp('email_verified', 'email_verified:once', { user_id: userId })
}

export async function fetchCommunityPermissions(userId) {
  const { data, error } = await supabase.rpc('community_user_permissions', {
    p_user_id: userId || null,
  })
  if (error) {
    if (String(error.message || '').toLowerCase().includes('does not exist')) return null
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return row || null
}

export { jstDateKey }
