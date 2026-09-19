/**
 * GET /api/billing/payjp/plan-config
 * 運用確認用: Vercel の pln_ が PAY.JP API（secret と同じモード）に存在するか
 */
import { getPayjpPlanId, getPayjpSecretKey, payjpRequest } from '../../_lib/payjp-api.js'

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function planMeta(id) {
  const v = String(id || '').trim()
  if (!v) return { configured: false, suffix: null }
  return { configured: true, suffix: v.length > 8 ? v.slice(-8) : v }
}

async function planOnPayjp(planId) {
  const id = String(planId || '').trim()
  if (!id) {
    return { existsOnPayjp: false, payjpError: 'not_configured' }
  }
  try {
    const plan = await payjpRequest(`/plans/${encodeURIComponent(id)}`)
    return {
      existsOnPayjp: true,
      amount: plan?.amount ?? null,
      interval: plan?.interval ?? null,
      name: plan?.name ?? null,
    }
  } catch (err) {
    const msg = String(err?.message || '')
    return {
      existsOnPayjp: false,
      payjpError: /no such plan/i.test(msg) ? 'no_such_plan' : (err.code || 'payjp_api_error'),
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }
  const sk = getPayjpSecretKey()
  const skMode = sk.startsWith('sk_live_') ? 'live' : sk.startsWith('sk_test_') ? 'test' : sk ? 'unknown' : 'missing'
  const monthlyId = getPayjpPlanId('monthly')
  const annualId = getPayjpPlanId('annual')
  if (req.method === 'HEAD') {
    res.statusCode = sk && monthlyId ? 200 : 503
    res.end()
    return
  }

  const [monthlyPayjp, annualPayjp] = sk
    ? await Promise.all([planOnPayjp(monthlyId), planOnPayjp(annualId)])
    : [{ existsOnPayjp: false }, { existsOnPayjp: false }]

  const monthlyOk = Boolean(monthlyPayjp.existsOnPayjp)
  const annualOk = Boolean(annualPayjp.existsOnPayjp)
  const allOk = Boolean(sk && monthlyId && annualId && monthlyOk && annualOk)

  return sendJson(res, sk && monthlyId ? 200 : 503, {
    ok: allOk,
    secretMode: skMode,
    monthly: { ...planMeta(monthlyId), ...monthlyPayjp },
    annual: { ...planMeta(annualId), ...annualPayjp },
    hint: allOk
      ? 'プラン ID は PAY.JP と一致しています。'
      : 'Vercel の PAYJP_PLAN_ID_* を PAY.JP（Test OFF なら本番 pln_）の ID に合わせて Redeploy してください。',
  })
}
