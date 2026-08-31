/**
 * Guards for lounge/community trigger SQL: SECURITY INVOKER triggers that write
 * another user's rows are rolled back by RLS (likes/comments/follows vanish).
 */

const REQUIRED_DEFINER_FNS = [
  'refresh_lounge_post_stats',
  'create_lounge_notification_like',
  'create_lounge_notification_comment',
  'create_lounge_notification_follow',
  'refresh_portfolio_follower_count',
]

const extractFunctionBody = (sql, fnName) => {
  const re = new RegExp(
    `create or replace function public\\.${fnName}\\s*\\([^)]*\\)\\s*returns trigger([\\s\\S]*?)language plpgsql([\\s\\S]*?)as \\$\\$`,
    'i',
  )
  const m = String(sql || '').match(re)
  if (!m) return null
  return `${m[1]} ${m[2]}`
}

export const functionIsSecurityDefinerWithSafeSearchPath = (sql, fnName) => {
  const header = extractFunctionBody(sql, fnName)
  if (!header) return false
  const definer = /security\s+definer/i.test(header)
  const invoker = /security\s+invoker/i.test(header)
  const searchPath = /set\s+search_path\s*=\s*public/i.test(header)
  return definer && !invoker && searchPath
}

export const sqlHasOwnNotificationInsertPolicy = (sql) => {
  const text = String(sql || '')
  if (!/lounge_notifications_owner_insert/i.test(text)) return false
  if (!/for insert/i.test(text)) return false
  return /user_id\s*=\s*auth\.uid\(\)/i.test(text)
}

export const auditLoungeTriggerSql = (sql) => {
  const missing = REQUIRED_DEFINER_FNS.filter(
    (fn) => !functionIsSecurityDefinerWithSafeSearchPath(sql, fn),
  )
  return {
    ok: missing.length === 0 && sqlHasOwnNotificationInsertPolicy(sql),
    missingSecurityDefiner: missing,
    hasOwnNotificationInsertPolicy: sqlHasOwnNotificationInsertPolicy(sql),
  }
}

export { REQUIRED_DEFINER_FNS }
