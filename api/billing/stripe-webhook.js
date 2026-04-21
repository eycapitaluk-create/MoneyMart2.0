/**
 * POST /api/billing/stripe-webhook
 * Raw body required for signature verification.
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY if service role)
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function bufferRequest(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function setUserPremium(admin, userId, active, extra = {}) {
  const uid = String(userId || '').trim()
  if (!uid) return
  const row = {
    user_id: uid,
    is_premium: active,
    subscription_tier: active ? 'premium' : 'free',
    ...extra,
  }
  const { data: existing, error: selErr } = await admin
    .from('user_profiles')
    .select('user_id')
    .eq('user_id', uid)
    .maybeSingle()
  if (selErr) {
    console.error('stripe-webhook profile select', selErr)
    return
  }
  if (existing?.user_id) {
    const { error } = await admin
      .from('user_profiles')
      .update({
        is_premium: row.is_premium,
        subscription_tier: row.subscription_tier,
        ...(extra.stripe_customer_id != null ? { stripe_customer_id: extra.stripe_customer_id } : {}),
        ...(extra.stripe_subscription_id != null ? { stripe_subscription_id: extra.stripe_subscription_id } : {}),
      })
      .eq('user_id', uid)
    if (error) console.error('stripe-webhook profile update', error)
  } else {
    const ins = {
      user_id: uid,
      full_name: '',
      nickname: '',
      is_premium: row.is_premium,
      subscription_tier: row.subscription_tier,
      ...(extra.stripe_customer_id != null ? { stripe_customer_id: extra.stripe_customer_id } : {}),
      ...(extra.stripe_subscription_id != null ? { stripe_subscription_id: extra.stripe_subscription_id } : {}),
    }
    const { error } = await admin.from('user_profiles').insert(ins)
    if (error) console.error('stripe-webhook profile insert', error)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end()
    return
  }

  const secret = String(process.env.STRIPE_SECRET_KEY || '').trim()
  const whSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  const sig = req.headers['stripe-signature']
  if (!secret || !whSecret || !sig) {
    res.statusCode = 503
    res.end('misconfigured')
    return
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
  const serviceKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
    || '',
  ).trim()
  if (!supabaseUrl || !serviceKey) {
    res.statusCode = 500
    res.end('supabase misconfigured')
    return
  }

  let buf
  try {
    buf = await bufferRequest(req)
  } catch {
    res.statusCode = 400
    res.end('body read error')
    return
  }

  const stripe = new Stripe(secret)
  let event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, whSecret)
  } catch (err) {
    console.error('stripe webhook sig', err?.message)
    res.statusCode = 400
    res.end(`signature: ${err?.message || 'invalid'}`)
    return
  }

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break
        const userId = String(session.metadata?.supabase_user_id || session.client_reference_id || '').trim()
        const customerId = String(session.customer || '').trim()
        const subId = String(session.subscription || '').trim()
        if (userId) {
          await setUserPremium(admin, userId, true, {
            ...(customerId ? { stripe_customer_id: customerId } : {}),
            ...(subId ? { stripe_subscription_id: subId } : {}),
          })
        }
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const userId = String(sub.metadata?.supabase_user_id || '').trim()
        if (!userId) break
        const status = String(sub.status || '')
        const active = status === 'active' || status === 'trialing'
        await setUserPremium(admin, userId, active, {
          stripe_customer_id: String(sub.customer || '').trim() || undefined,
          stripe_subscription_id: String(sub.id || '').trim() || undefined,
        })
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const userId = String(sub.metadata?.supabase_user_id || '').trim()
        if (userId) await setUserPremium(admin, userId, false, {})
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('stripe-webhook handler', err?.message || err)
    res.statusCode = 500
    res.end('handler error')
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ received: true }))
}
