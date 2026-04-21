import { supabase } from './supabase'
import { clearPendingReferralCode, getPendingReferralCode } from './referralStorage'

const DEFAULT_CAMPAIGN = 'default'

/**
 * OAuth / returning users: attach pending ?ref= to this account (idempotent).
 * Clears localStorage when the server accepts or reports already_attributed.
 */
export async function claimPendingReferralAttribution() {
  const code = getPendingReferralCode()
  if (!code) return { skipped: true }

  const { data, error } = await supabase.rpc('claim_referral_attribution', {
    p_code: code,
    p_campaign: DEFAULT_CAMPAIGN,
  })

  if (error) {
    return { skipped: false, error: error.message, data: null }
  }

  const reason = data?.reason
  const terminal =
    (data?.ok && (reason === 'attached' || reason === 'already_attributed'))
    || reason === 'self_referral'
    || reason === 'unknown_code'
  if (terminal) clearPendingReferralCode()

  return { skipped: false, error: null, data }
}

/**
 * Invite link code for the signed-in user (creates row for legacy accounts via RPC).
 */
export async function fetchMyReferralCode() {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData?.session?.user?.id
  if (!uid) return null

  const { data: row, error: selErr } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', uid)
    .maybeSingle()

  if (!selErr && row?.code) return String(row.code)

  const { data: ensured, error: rpcErr } = await supabase.rpc('ensure_my_referral_code')
  if (rpcErr) return null
  return ensured ? String(ensured) : null
}

/**
 * Referrer: rows where this user referred someone (for dashboards / rewards export).
 */
export async function fetchReferralsISent() {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData?.session?.user?.id
  if (!uid) return []

  const { data, error } = await supabase
    .from('referral_attributions')
    .select('id,referred_user_id,ref_code_used,campaign_id,created_at,qualifying_event_count,qualified_at')
    .eq('referrer_user_id', uid)
    .order('created_at', { ascending: false })

  if (error) return []
  return data || []
}

/**
 * Referred user: own attribution row (if any).
 */
export async function fetchMyReferralAttribution() {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData?.session?.user?.id
  if (!uid) return null

  const { data, error } = await supabase
    .from('referral_attributions')
    .select('referrer_user_id,ref_code_used,campaign_id,created_at,qualifying_event_count,qualified_at')
    .eq('referred_user_id', uid)
    .eq('campaign_id', DEFAULT_CAMPAIGN)
    .maybeSingle()

  if (error) return null
  return data
}
