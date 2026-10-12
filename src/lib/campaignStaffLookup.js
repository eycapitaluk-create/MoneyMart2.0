import { classifyCampaignEntry } from './campaignEntryClassify.js'

export const STAFF_LIST_USERS_PER_PAGE = 200
export const STAFF_LIST_USERS_MAX_PAGES = 50

/**
 * Resolve staff user ids through Auth Admin listUsers.
 * Does not query the auth schema via PostgREST.
 * A failed or unfinished scan is unresolved so those users are not counted as customers.
 * A finished scan that simply has no matching account is resolved with the ids that exist.
 */
export async function resolveStaffIdsViaListUsers(listUsers, emails = []) {
  const wanted = [...new Set(
    (emails || []).map((email) => String(email || '').trim().toLowerCase()).filter(Boolean),
  )]
  const emailsById = {}
  const foundEmails = new Set()
  try {
    for (let page = 1; page <= STAFF_LIST_USERS_MAX_PAGES; page += 1) {
      const { data, error } = await listUsers({ page, perPage: STAFF_LIST_USERS_PER_PAGE })
      if (error) return { ok: false, ids: [], emailsById: {} }
      const users = Array.isArray(data?.users) ? data.users : []
      for (const user of users) {
        const email = String(user?.email || '').trim().toLowerCase()
        if (!user?.id || !wanted.includes(email) || emailsById[user.id]) continue
        emailsById[user.id] = email
        foundEmails.add(email)
      }
      if (foundEmails.size === wanted.length) {
        return { ok: true, ids: Object.keys(emailsById), emailsById }
      }
      if (users.length < STAFF_LIST_USERS_PER_PAGE) {
        return { ok: true, ids: Object.keys(emailsById), emailsById }
      }
    }
  } catch {
    return { ok: false, ids: [], emailsById: {} }
  }
  return { ok: false, ids: [], emailsById: {} }
}

/** Keep the email used for classification so a later CSV pass still sees staff. */
export function decorateCampaignRow(row, emailsById = {}) {
  const mapped = emailsById?.[row?.user_id]
  const email = mapped != null && String(mapped) !== ''
    ? String(mapped)
    : String(row?.email || '')
  const next = {
    ...row,
    email,
    emailLookupFailed: Boolean(row?.emailLookupFailed),
  }
  const mark = classifyCampaignEntry(next)
  return {
    ...next,
    ...mark,
    survey_completed: Boolean(row?.survey_completed_at),
  }
}

export function applyCampaignEntryOrder(query) {
  return query
    .order('applied_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
}

export function campaignEntryStatusLabel(row = {}) {
  if (row.staffUnresolved) return 'スタッフ判定不能'
  if (row.awarded) return '当選（最終）'
  if (row.autoReceipt) return '書類受付（抽選前）'
  if (row.status === 'rejected') return '対象外'
  if (row.status === 'draft') return '下書き'
  if (row.status === 'rewarded') return 'rewarded（受付条件未充足）'
  return row.status === 'eligible' ? 'eligible（受付条件未充足）' : (row.status || '—')
}

/** A saved URL is not a reviewed post and is not a win. */
export function snsPostReviewLabel(row = {}) {
  if (!String(row?.sns_url || '').trim()) return '投稿URLなし'
  return '投稿内容は未確認'
}
