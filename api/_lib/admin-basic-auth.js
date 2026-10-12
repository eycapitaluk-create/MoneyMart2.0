/** Same HTTP Basic check as /api/admin-crm-insights and AdminIpGuard. */
export function assertAdminBasic(req) {
  const expectedUser = String(process.env.ADMIN_BASIC_USER || '').trim()
  const expectedPass = String(process.env.ADMIN_BASIC_PASS || '').trim()
  if (!expectedUser || !expectedPass) return false

  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || ''
  if (!String(authHeader).startsWith('Basic ')) return false
  let decoded = ''
  try {
    decoded = Buffer.from(String(authHeader).slice(6), 'base64').toString('utf8')
  } catch {
    return false
  }
  const idx = decoded.indexOf(':')
  const user = idx >= 0 ? decoded.slice(0, idx) : decoded
  const pass = idx >= 0 ? decoded.slice(idx + 1) : ''
  return user === expectedUser && pass === expectedPass
}

export function adminAuthFailure(req) {
  if (assertAdminBasic(req)) return null
  const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || '')
  if (/^Bearer\s+\S+/i.test(authHeader)) return 403
  return 401
}
