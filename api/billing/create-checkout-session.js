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
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/mypage?subscription=success`,
      cancel_url: `${origin}/premium?cancelled=1`,
      allow_promotion_codes: true,
    })
    return sendJson(res, 200, { url: session.url })
  } catch (err) {
    console.error('create-checkout-session', err?.message || err)
    return sendJson(res, 500, { error: err?.message || 'Stripe error' })
  }
}
