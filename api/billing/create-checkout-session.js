/**
 * POST /api/billing/create-checkout-session
 * Stripe Checkout サブスク開始。Authorization: Bearer <supabase access_token>
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PREMIUM_MONTHLY,
 *      SUPABASE_URL, SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY
 *      PUBLIC_SITE_URL or VITE_PUBLIC_SITE_ORIGIN
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.end(JSON.stringify(payload))
}

function getSiteOrigin() {
  const o = String(
    process.env.PUBLIC_SITE_URL
    || process.env.VITE_PUBLIC_SITE_ORIGIN
    || 'http://localhost:5178',
  ).replace(/\/$/, '')
  return o
}

function stripeSearchValue(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
}

async function findActiveSubscription(stripe, userId) {
  const uid = stripeSearchValue(userId)
  for (const status of ['active', 'trialing']) {
    const result = await stripe.subscriptions.search({
      query: `status:'${status}' AND metadata['supabase_user_id']:'${uid}'`,
      limit: 1,
    })
    if (result.data?.[0]) return result.data[0]
  }
  return null
}

async function getOrCreateCustomer(stripe, user) {
  const uid = stripeSearchValue(user.id)
  const existing = await stripe.customers.search({
    query: `metadata['supabase_user_id']:'${uid}'`,
    limit: 1,
  })
  if (existing.data?.[0]) return existing.data[0]

  return stripe.customers.create(
    {
      email: user.email || undefined,
      metadata: { supabase_user_id: user.id },
    },
    { idempotencyKey: `moneymart-customer-${user.id}` },
  )
}

export async function createCheckoutForUser({ stripe, user, priceId, origin }) {
  const activeSubscription = await findActiveSubscription(stripe, user.id)
  if (activeSubscription) {
    const error = new Error('すでに有効なプレミアム契約があります。')
    error.statusCode = 409
    error.code = 'subscription_already_active'
    throw error
  }

  const customer = await getOrCreateCustomer(stripe, user)

  // Stripe Search is eventually consistent. Check this customer's subscriptions
  // directly as well so a second request cannot race a just-completed Checkout.
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 100,
  })
  const currentSubscription = subscriptions.data?.find((subscription) => (
    subscription.metadata?.supabase_user_id === user.id
    && (subscription.status === 'active' || subscription.status === 'trialing')
  ))
  if (currentSubscription) {
    const error = new Error('すでに有効なプレミアム契約があります。')
    error.statusCode = 409
    error.code = 'subscription_already_active'
    throw error
  }

  const sessions = await stripe.checkout.sessions.list({
    customer: customer.id,
    limit: 1,
  })
  const latestSession = sessions.data?.[0]
  if (latestSession?.status === 'open') {
    if (latestSession.url) return latestSession
    const error = new Error('決済セッションを処理中です。しばらくしてから再度お試しください。')
    error.statusCode = 409
    error.code = 'checkout_session_pending'
    throw error
  }

  return stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      client_reference_id: user.id,
      customer: customer.id,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/mypage?subscription=success`,
      cancel_url: `${origin}/premium?cancelled=1`,
      allow_promotion_codes: true,
    },
    {
      // Concurrent initial requests see the same previous session and collapse
      // to one Stripe object. Once it expires, its id becomes the next key.
      idempotencyKey: [
        'moneymart-premium-checkout',
        user.id,
        priceId,
        latestSession?.id || 'initial',
      ].join('-'),
    },
  )
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  const secret = String(process.env.STRIPE_SECRET_KEY || '').trim()
  const priceId = String(process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY || '').trim()
  if (!secret || !priceId) {
    return sendJson(res, 503, {
      code: 'stripe_env_missing',
      error: '決済機能はただいま準備中です。もうしばらくお待ちください。',
    })
  }

  const auth = String(req.headers.authorization || '')
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const supabaseAnon = String(
    process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || '',
  ).trim()
  if (!supabaseUrl || !supabaseAnon) {
    return sendJson(res, 500, { error: 'Supabase env missing (SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY)' })
  }

  const supabase = createClient(supabaseUrl, supabaseAnon)
  const { data: authData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authData?.user?.id) {
    return sendJson(res, 401, { error: 'Invalid session' })
  }
  const user = authData.user

  const stripe = new Stripe(secret)
  const origin = getSiteOrigin()

  try {
    const session = await createCheckoutForUser({
      stripe,
      user,
      priceId,
      origin,
    })
    return sendJson(res, 200, { url: session.url })
  } catch (err) {
    console.error('create-checkout-session', err?.message || err)
    return sendJson(res, err?.statusCode || 500, {
      ...(err?.code ? { code: err.code } : {}),
      error: err?.message || 'Stripe error',
    })
  }
}
