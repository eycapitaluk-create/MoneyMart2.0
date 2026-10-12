/**
 * GET /api/stock-daily-brief?symbol=AAPL
 * Authorization: Bearer <Supabase access_token>
 *
 * ログインユーザー向け。銘柄×JST日付で1日1回 Claude 生成（キャッシュ）。
 */
import {
  requireSupabaseUser,
  sendBillingJson,
} from './_lib/supabase-bearer-auth.js'
import { getOrCreateStockDailyBrief, normalizeStockSymbol } from './_lib/stock-daily-brief-core.js'

function normalizeSecret(value) {
  const raw = String(value || '').trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET') {
    return sendBillingJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  let admin
  try {
    const authResult = await requireSupabaseUser(req)
    admin = authResult.admin
  } catch (err) {
    return sendBillingJson(res, err.status || 401, { ok: false, error: err.message })
  }

  const url = new URL(req.url || '/', 'http://localhost')
  const symbol = normalizeStockSymbol(url.searchParams.get('symbol') || '')
  if (!symbol) {
    return sendBillingJson(res, 400, { ok: false, error: 'symbol is required' })
  }

  const anthropicKey = normalizeSecret(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY)
  const model = String(
    process.env.STOCK_DAILY_BRIEF_MODEL
    || process.env.COMPANY_NEWS_BRIEF_MODEL
    || 'claude-haiku-4-5-20251001',
  ).trim()

  try {
    const brief = await getOrCreateStockDailyBrief(admin, {
      symbol,
      anthropicKey,
      model,
      getEnv: (key) => normalizeSecret(process.env[key]),
    })
    return sendBillingJson(res, 200, { ok: true, brief })
  } catch (err) {
    const status = Number(err?.status) || 500
    return sendBillingJson(res, status, {
      ok: false,
      error: err?.message || 'Failed to load stock daily brief',
    })
  }
}
