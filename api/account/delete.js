import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const CLEANUP_TABLES = [
  'user_expenses',
  'user_insurances',
  'user_asset_positions',
  'user_point_accounts',
  'user_finance_profiles',
  'user_owned_stocks',
  'user_owned_funds',
  'user_revolving_profiles',
  'user_revolving_debts',
  'refinance_simulations',
  'user_tax_shield_profiles',
  'tax_shield_simulations',
  'user_cashflow_optimizer_profiles',
  'cashflow_optimizer_simulations',
  'user_watchlists',
  'lounge_posts',
  'lounge_post_likes',
  'lounge_post_bookmarks',
  'lounge_post_comments',
  'community_posts',
  'post_engagements',
]

function stripeSearchValue(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
}

function subscriptionOwnedByUser(subscription, userId) {
  return String(subscription?.metadata?.supabase_user_id || '').trim() === userId
}

async function collectOwnedSubscriptionIds(stripe, userId, profile = {}) {
  const ownedIds = new Set()
  const uid = stripeSearchValue(userId)

  for (const status of ['active', 'trialing']) {
    const result = await stripe.subscriptions.search({
      query: `status:'${status}' AND metadata['supabase_user_id']:'${uid}'`,
      limit: 100,
    })
    for (const subscription of result.data || []) {
      if (subscription?.id && subscriptionOwnedByUser(subscription, userId)) {
        ownedIds.add(subscription.id)
      }
    }
  }

  const customerId = String(profile?.stripe_customer_id || '').trim()
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      const customerUserId = String(customer?.metadata?.supabase_user_id || '').trim()
      // Only trust customer-scoped listing when the customer is bound to this user.
      // Checkout historically created customers via email alone; those still rely on
      // subscription metadata search above.
      if (!customer?.deleted && customerUserId === userId) {
        const listed = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 100,
        })
        for (const subscription of listed.data || []) {
          if (
            subscription?.id
            && (subscription.status === 'active' || subscription.status === 'trialing')
            && subscriptionOwnedByUser(subscription, userId)
          ) {
            ownedIds.add(subscription.id)
          }
        }
      }
    } catch (error) {
      if (error?.code !== 'resource_missing') throw error
    }
  }

  const profileSubscriptionId = String(profile?.stripe_subscription_id || '').trim()
  if (profileSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(profileSubscriptionId)
      if (subscriptionOwnedByUser(subscription, userId)) {
        ownedIds.add(profileSubscriptionId)
      } else {
        throw new Error('Stripe subscription ownership mismatch')
      }
    } catch (error) {
      // Stale profile ids should not block deletion once Stripe no longer has them.
      if (error?.code !== 'resource_missing') throw error
    }
  }

  return [...ownedIds]
}

async function cancelOwnedSubscriptions(stripe, subscriptionIds) {
  for (const subscriptionId of subscriptionIds) {
    try {
      await stripe.subscriptions.cancel(subscriptionId)
    } catch (error) {
      if (error?.code !== 'resource_missing') throw error
    }
  }
}

export async function deleteAccount({
  admin,
  userId,
  stripeSecret,
  createStripeClient = (secret) => new Stripe(secret),
}) {
  const { data: profile, error: profileErr } = await admin
    .from('user_profiles')
    .select('stripe_subscription_id, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (profileErr) {
    throw new Error(profileErr.message || 'Failed to check subscription')
  }

  const hasBillingHint = Boolean(
    String(profile?.stripe_subscription_id || '').trim()
    || String(profile?.stripe_customer_id || '').trim(),
  )

  if (hasBillingHint && !stripeSecret) {
    throw new Error('Missing Stripe server env')
  }

  if (stripeSecret) {
    const stripe = createStripeClient(stripeSecret)
    const subscriptionIds = await collectOwnedSubscriptionIds(stripe, userId, profile || {})
    await cancelOwnedSubscriptions(stripe, subscriptionIds)
  }

  // Delete the identity before explicit legacy-table cleanup so an Auth failure
  // cannot leave an active account whose personal data has already been erased.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId)
  if (deleteErr) {
    throw new Error(deleteErr.message || 'Failed to delete user')
  }

  // Most user-owned tables cascade from auth.users. Keep explicit cleanup for
  // older deployments whose tables may predate those foreign keys.
  for (const table of CLEANUP_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error && !String(error.message || '').toLowerCase().includes('does not exist')) {
      // Best-effort cleanup after the account is irreversibly deleted.
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRole) {
    return res.status(500).json({ ok: false, error: 'Missing SUPABASE server env' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' })

  try {
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return res.status(401).json({ ok: false, error: 'Invalid token' })
    }

    await deleteAccount({
      admin,
      userId: userData.user.id,
      stripeSecret: String(process.env.STRIPE_SECRET_KEY || '').trim(),
    })

    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Unexpected error' })
  }
}
