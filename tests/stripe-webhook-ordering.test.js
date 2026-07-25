import assert from 'node:assert/strict'
import test from 'node:test'

import { applyStripeWebhookEvent } from '../api/billing/stripe-webhook.js'

function createAdmin({ events, profileByUser = {}, selectError = null, writeError = null }) {
  return {
    from(table) {
      assert.equal(table, 'user_profiles')
      return {
        select(columns) {
          return {
            eq(_col, userId) {
              return {
                async maybeSingle() {
                  events.push(['profile-select', columns, userId])
                  if (selectError) return { data: null, error: selectError }
                  const profile = profileByUser[userId] || null
                  return { data: profile, error: null }
                },
              }
            },
          }
        },
        update(payload) {
          return {
            async eq(_col, userId) {
              events.push(['profile-update', userId, payload])
              if (writeError) return { error: writeError }
              profileByUser[userId] = {
                ...(profileByUser[userId] || { user_id: userId }),
                ...payload,
              }
              return { error: null }
            },
          }
        },
        async insert(payload) {
          events.push(['profile-insert', payload])
          if (writeError) return { error: writeError }
          profileByUser[payload.user_id] = { ...payload }
          return { error: null }
        },
      }
    },
  }
}

function createStripe({ events, subscriptions = {} }) {
  return {
    subscriptions: {
      async retrieve(subscriptionId) {
        events.push(['stripe-retrieve', subscriptionId])
        if (!(subscriptionId in subscriptions)) {
          const err = new Error(`No such subscription: ${subscriptionId}`)
          err.code = 'resource_missing'
          throw err
        }
        return subscriptions[subscriptionId]
      },
    },
  }
}

test('stale checkout.session.completed does not re-grant premium after cancel', async () => {
  const events = []
  const profileByUser = {
    'user-1': {
      user_id: 'user-1',
      is_premium: false,
      subscription_tier: 'free',
      stripe_subscription_id: 'sub_old',
    },
  }
  const admin = createAdmin({ events, profileByUser })
  const stripe = createStripe({
    events,
    subscriptions: {
      sub_old: {
        id: 'sub_old',
        status: 'canceled',
        metadata: { supabase_user_id: 'user-1' },
      },
    },
  })

  const result = await applyStripeWebhookEvent(admin, stripe, {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'subscription',
        metadata: { supabase_user_id: 'user-1' },
        customer: 'cus_1',
        subscription: 'sub_old',
      },
    },
  })

  assert.deepEqual(result, { applied: false, reason: 'subscription_not_active' })
  assert.equal(profileByUser['user-1'].is_premium, false)
  assert.ok(!events.some(([kind]) => kind === 'profile-update' || kind === 'profile-insert'))
})

test('checkout.session.completed grants premium only when Stripe subscription is active', async () => {
  const events = []
  const profileByUser = {}
  const admin = createAdmin({ events, profileByUser })
  const stripe = createStripe({
    events,
    subscriptions: {
      sub_live: {
        id: 'sub_live',
        status: 'active',
        metadata: { supabase_user_id: 'user-2' },
      },
    },
  })

  const result = await applyStripeWebhookEvent(admin, stripe, {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'subscription',
        metadata: { supabase_user_id: 'user-2' },
        customer: 'cus_2',
        subscription: 'sub_live',
      },
    },
  })

  assert.deepEqual(result, { applied: true, reason: 'checkout_granted' })
  assert.equal(profileByUser['user-2'].is_premium, true)
  assert.equal(profileByUser['user-2'].stripe_subscription_id, 'sub_live')
  assert.deepEqual(events[0], ['stripe-retrieve', 'sub_live'])
})

test('stale subscription.deleted for an old sub does not revoke a newer tracked sub', async () => {
  const events = []
  const profileByUser = {
    'user-3': {
      user_id: 'user-3',
      is_premium: true,
      subscription_tier: 'premium',
      stripe_subscription_id: 'sub_new',
      stripe_customer_id: 'cus_3',
    },
  }
  const admin = createAdmin({ events, profileByUser })
  const stripe = createStripe({ events })

  const result = await applyStripeWebhookEvent(admin, stripe, {
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_old',
        metadata: { supabase_user_id: 'user-3' },
        status: 'canceled',
      },
    },
  })

  assert.deepEqual(result, { applied: false, reason: 'stale_delete_event' })
  assert.equal(profileByUser['user-3'].is_premium, true)
  assert.equal(profileByUser['user-3'].stripe_subscription_id, 'sub_new')
})

test('matching subscription.deleted revokes premium for the tracked sub', async () => {
  const events = []
  const profileByUser = {
    'user-4': {
      user_id: 'user-4',
      is_premium: true,
      subscription_tier: 'premium',
      stripe_subscription_id: 'sub_current',
    },
  }
  const admin = createAdmin({ events, profileByUser })
  const stripe = createStripe({ events })

  const result = await applyStripeWebhookEvent(admin, stripe, {
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_current',
        metadata: { supabase_user_id: 'user-4' },
        status: 'canceled',
      },
    },
  })

  assert.deepEqual(result, { applied: true, reason: 'subscription_deleted' })
  assert.equal(profileByUser['user-4'].is_premium, false)
  assert.equal(profileByUser['user-4'].subscription_tier, 'free')
})

test('stale inactive subscription.updated for an old sub is ignored', async () => {
  const events = []
  const profileByUser = {
    'user-5': {
      user_id: 'user-5',
      is_premium: true,
      subscription_tier: 'premium',
      stripe_subscription_id: 'sub_new',
    },
  }
  const admin = createAdmin({ events, profileByUser })
  const stripe = createStripe({ events })

  const result = await applyStripeWebhookEvent(admin, stripe, {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_old',
        customer: 'cus_5',
        status: 'canceled',
        metadata: { supabase_user_id: 'user-5' },
      },
    },
  })

  assert.deepEqual(result, { applied: false, reason: 'stale_inactive_event' })
  assert.equal(profileByUser['user-5'].is_premium, true)
  assert.equal(profileByUser['user-5'].stripe_subscription_id, 'sub_new')
})

test('profile write failures propagate so Stripe can retry', async () => {
  const events = []
  const admin = createAdmin({
    events,
    profileByUser: {},
    writeError: { message: 'db down' },
  })
  const stripe = createStripe({
    events,
    subscriptions: {
      sub_x: {
        id: 'sub_x',
        status: 'trialing',
        metadata: { supabase_user_id: 'user-6' },
      },
    },
  })

  await assert.rejects(
    () => applyStripeWebhookEvent(admin, stripe, {
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          metadata: { supabase_user_id: 'user-6' },
          customer: 'cus_6',
          subscription: 'sub_x',
        },
      },
    }),
    (err) => err?.message === 'db down',
  )
})
