/**
 * POST /api/apple/verify-subscription
 *
 * iOS（StoreKit 2）で購入した取引 ID を App Store Server API で照会し、
 * user_premium_entitlements + user_profiles を更新します。
 *
 * Body: { "transaction_id": "2000000..." }
 * Header: Authorization: Bearer <Supabase access_token>
 *
 * Env:
 *   APPLE_ISSUER_ID           App Store Connect API の Issuer ID
 *   APPLE_KEY_ID              .p8 の Key ID
 *   APPLE_PRIVATE_KEY         AuthKey_xxx.p8 の PEM 全文（Vercel では \\n で改行）
 *   APPLE_BUNDLE_ID           アプリの Bundle ID（例: jp.co.moneymart.app）
 *   APPLE_APP_STORE_SERVER_ENV  sandbox | production（省略時 sandbox）
 *   APPLE_IAP_PRODUCT_IDS     許可する自動更新サブスクの productId（カンマ区切り・必須）
 *
 * Supabase: SUPABASE_URL, SUPABASE_ANON_KEY（または VITE_*）, SUPABASE_SERVICE_ROLE_KEY
 *
 * @see https://developer.apple.com/documentation/appstoreserverapi/get_transaction_info
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { recomputeUserPremium } from '../_lib/premium-entitlements.js'

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req) {
  const raw = await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
  if (!raw || !String(raw).trim()) return {}
  return JSON.parse(raw)
}

function normalizeApplePrivateKey(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''
  if (s.includes('\\n')) s = s.replace(/\\n/g, '\n')
  return s
}

function base64UrlEncode(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signAppleAppStoreServerJwt({ issuerId, keyId, bundleId, privateKeyPem, audience }) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 60 * 20,
    aud: audience,
    bid: bundleId,
  }
  const encHeader = base64UrlEncode(JSON.stringify(header))
  const encPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encHeader}.${encPayload}`
  const key = crypto.createPrivateKey(privateKeyPem)
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' })
  return `${signingInput}.${base64UrlEncode(sig)}`
}

/** App Store Server API が返す signedTransactionInfo（JWS）のペイロードをデコード */
function decodeJwsPayloadUnsafe(jws) {
  const parts = String(jws || '').split('.')
  if (parts.length < 2) return null
  let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  try {
    const json = Buffer.from(b64, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

function parseProductAllowlist(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  }

  const issuerId = String(process.env.APPLE_ISSUER_ID || '').trim()
  const keyId = String(process.env.APPLE_KEY_ID || '').trim()
  const bundleId = String(process.env.APPLE_BUNDLE_ID || '').trim()
  const privateKeyPem = normalizeApplePrivateKey(process.env.APPLE_PRIVATE_KEY || '')
  const audience = String(process.env.APPLE_APP_STORE_AUDIENCE || 'appstoreconnect-v1').trim()
  const envLabel = String(process.env.APPLE_APP_STORE_SERVER_ENV || 'sandbox').trim().toLowerCase()
  const useSandbox = envLabel !== 'production' && envLabel !== 'live'
  const baseUrl = useSandbox
    ? 'https://api.storekit-sandbox.itunes.apple.com'
    : 'https://api.storekit.itunes.apple.com'

  if (!issuerId || !keyId || !bundleId || !privateKeyPem) {
    return sendJson(res, 503, {
      ok: false,
      code: 'apple_env_missing',
      error: 'APPLE_ISSUER_ID / APPLE_KEY_ID / APPLE_BUNDLE_ID / APPLE_PRIVATE_KEY を設定してください。',
    })
  }

  const allowedProducts = parseProductAllowlist(process.env.APPLE_IAP_PRODUCT_IDS || '')
  if (allowedProducts.length === 0) {
    return sendJson(res, 503, {
      ok: false,
      code: 'apple_product_allowlist_missing',
      error: 'APPLE_IAP_PRODUCT_IDS（カンマ区切りの product id）を設定してください。',
    })
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const supabaseAnon = String(
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  ).trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()

  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Supabase URL / anon / service role が不足しています。',
    })
  }

  const auth = String(req.headers.authorization || '')
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  if (!bearer) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' })
  }

  let body = {}
  try {
    body = await readJsonBody(req)
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON body' })
  }

  const transactionId = String(body.transaction_id || body.transactionId || '').trim()
  if (!transactionId) {
    return sendJson(res, 400, { ok: false, error: 'transaction_id が必要です。' })
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnon)
  const { data: authData, error: authErr } = await supabaseUser.auth.getUser(bearer)
  if (authErr || !authData?.user?.id) {
    return sendJson(res, 401, { ok: false, error: 'Invalid session' })
  }
  const userId = authData.user.id

  let jwt
  try {
    jwt = signAppleAppStoreServerJwt({
      issuerId,
      keyId,
      bundleId,
      privateKeyPem,
      audience,
    })
  } catch (err) {
    console.error('[apple/verify-subscription] jwt_sign_failed', err?.message || err)
    return sendJson(res, 500, { ok: false, error: 'Apple JWT の生成に失敗しました。.p8 と Key ID を確認してください。' })
  }

  const txUrl = `${baseUrl}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`
  let ar
  try {
    ar = await fetch(txUrl, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    console.error('[apple/verify-subscription] fetch_failed', err?.message || err)
    return sendJson(res, 502, { ok: false, error: 'App Store Server API に接続できませんでした。' })
  }

  const arText = await ar.text()
  let arJson = null
  try {
    arJson = arText ? JSON.parse(arText) : null
  } catch {
    arJson = { raw: arText }
  }

  if (!ar.ok) {
    console.error('[apple/verify-subscription] apple_http_error', ar.status, arText?.slice?.(0, 800))
    return sendJson(res, 502, {
      ok: false,
      code: 'apple_transaction_fetch_failed',
      status: ar.status,
      error: typeof arJson?.error === 'string' ? arJson.error : '取引情報の取得に失敗しました。',
    })
  }

  const signedTx = arJson?.signedTransactionInfo || arJson?.signedTransaction
  const tx = typeof signedTx === 'string' ? decodeJwsPayloadUnsafe(signedTx) : null
  if (!tx) {
    return sendJson(res, 502, { ok: false, error: 'signedTransactionInfo を解釈できませんでした。' })
  }

  const txBundle = String(tx.bundleId || '').trim()
  if (txBundle && txBundle !== bundleId) {
    return sendJson(res, 400, { ok: false, error: 'Bundle ID が一致しません。' })
  }

  const productId = String(tx.productId || '').trim()
  if (!productId || !allowedProducts.includes(productId)) {
    return sendJson(res, 400, { ok: false, error: '許可されていない product_id です。' })
  }

  const originalTransactionId = String(tx.originalTransactionId || '').trim()
  if (!originalTransactionId) {
    return sendJson(res, 400, { ok: false, error: 'originalTransactionId がありません。' })
  }

  // appAccountToken が付いている場合はログイン中のユーザーと一致必須
  const appAccountToken = String(tx.appAccountToken || body.app_account_token || body.appAccountToken || '').trim()
  if (appAccountToken && appAccountToken.toLowerCase() !== String(userId).toLowerCase()) {
    return sendJson(res, 403, {
      ok: false,
      code: 'apple_account_token_mismatch',
      error: 'この Apple 取引は別のアカウント向けです。',
    })
  }

  const expiresMs = Number(tx.expiresDate)
  if (!Number.isFinite(expiresMs)) {
    return sendJson(res, 400, {
      ok: false,
      error: 'サブスクリプションの expiresDate が無い取引です（消耗型など）。product を確認してください。',
    })
  }

  const expiresAt = new Date(expiresMs)
  const isActive = expiresAt.getTime() > Date.now()

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // 同一 originalTransactionId を別アカウントへ付け替え禁止
  const { data: existingEnt, error: existingErr } = await admin
    .from('user_premium_entitlements')
    .select('user_id')
    .eq('provider', 'apple')
    .eq('external_subscription_key', originalTransactionId)
    .maybeSingle()
  if (existingErr) {
    console.error('[apple/verify-subscription] entitlement_lookup', existingErr)
    return sendJson(res, 500, { ok: false, error: existingErr.message || '既存契約の確認に失敗しました。' })
  }
  if (existingEnt?.user_id && existingEnt.user_id !== userId) {
    return sendJson(res, 409, {
      ok: false,
      code: 'apple_subscription_bound',
      error: 'この Apple 取引は別のアカウントに既に登録されています。',
    })
  }

  const { error: upErr } = await admin.from('user_premium_entitlements').upsert(
    {
      user_id: userId,
      provider: 'apple',
      external_subscription_key: originalTransactionId,
      status: isActive ? 'active' : 'expired',
      current_period_end: expiresAt.toISOString(),
      product_id: productId,
      raw_payload: tx,
    },
    { onConflict: 'user_id,provider,external_subscription_key' },
  )
  if (upErr) {
    console.error('[apple/verify-subscription] entitlement_upsert', upErr)
    return sendJson(res, 500, { ok: false, error: upErr.message || 'DB の更新に失敗しました。' })
  }

  let recomputed
  try {
    recomputed = await recomputeUserPremium(admin, userId)
  } catch (err) {
    console.error('[apple/verify-subscription] recompute', err?.message || err)
    return sendJson(res, 500, { ok: false, error: err?.message || 'プレミアム集計に失敗しました。' })
  }

  return sendJson(res, 200, {
    ok: true,
    environment: useSandbox ? 'sandbox' : 'production',
    original_transaction_id: originalTransactionId,
    product_id: productId,
    current_period_end: expiresAt.toISOString(),
    entitlement_active: isActive,
    profile: recomputed,
  })
}
